import { differenceInMinutes, parseISO, subDays } from 'date-fns';

import { isBiltConfigured } from '@/lib/services/bilt';
import {
  acknowledgeAlert,
  confirmDose,
  createCareTask,
  createNote,
  createPatientMedication,
  fetchAlerts,
  fetchAppointmentsAsTasks,
  fetchCareTasks,
  fetchDoses,
  fetchMedications,
  fetchNotes,
  fetchReminders,
  logReminderEvent,
  setCareTaskDone,
  setDoseStatus,
  snoozeDose,
  subscribeToDoses,
  toCareTaskInsert,
  toMedicationInsert,
  toNoteInsert,
  undoDoseConfirmation,
} from '@/lib/services/db';
import type { CareAlert, CareTask, Dose, Medication, Note, ReminderEvent } from '@/lib/types';

/**
 * Data gateway boundary.
 *
 * The demo runs on seeded local state (see `lib/store.ts`). The same interface
 * is implemented against the hosted Postgres schema in `createBiltBackend`, so
 * going live is an implementation swap instead of a rewrite.
 *
 * Table mapping (see `lib/services/db/schema.ts` for the full column list):
 *   profiles                 people, with role caregiver | recipient
 *   caregiver_relationships  Lorenzo -> Massimo, with per-link permissions
 *   medications              reusable catalog entry (name, form, strength)
 *   patient_medications      Massimo's prescription: dose, stock, prescriber
 *   dose_schedules           recurrence rules (08:00, 21:00, ...)
 *   scheduled_doses          concrete dose instances -> app `Dose`
 *   dose_logs                append-only confirmation history
 *   reminder_events          push -> SMS -> voice call ladder
 *   medication_inventory     stock snapshot + runout projection
 *   inventory_transactions   append-only stock ledger
 *   appointments, care_tasks care plan
 *   notes, care_alerts       notes area and alert centre
 *   documents, ocr_extractions  prescription scan onboarding
 *   audit_logs               append-only action trail
 *
 * Realtime: `subscribeToDoses` listens on `scheduled_doses`, so the caregiver
 * view updates the moment Massimo confirms a dose.
 */
export type MedimoSnapshot = {
  medications: Medication[];
  doses: Dose[];
  tasks: CareTask[];
  notes: Note[];
  alerts: CareAlert[];
  reminders: ReminderEvent[];
};

export type MedimoBackend = {
  name: string;
  isRemote: boolean;
  loadSnapshot: (patientId: string) => Promise<MedimoSnapshot>;
  upsertMedication: (medication: Medication) => Promise<void>;
  upsertDose: (dose: Dose) => Promise<void>;
  upsertTask: (task: CareTask) => Promise<void>;
  upsertNote: (note: Note) => Promise<void>;
  upsertAlert: (alert: CareAlert) => Promise<void>;
  appendReminder: (reminder: ReminderEvent) => Promise<void>;
  /** Returns an unsubscribe function. */
  subscribeToDoses?: (patientId: string, onChange: (dose: Dose) => void) => () => void;
};

/**
 * Local demo backend: every write is a no-op because the Zustand store is the
 * source of truth. Kept so screens can already call the gateway if wanted.
 */
const noop = async () => {};

export function createLocalBackend(snapshot: () => MedimoSnapshot): MedimoBackend {
  return {
    name: 'local-demo',
    isRemote: false,
    loadSnapshot: async () => snapshot(),
    upsertMedication: noop,
    upsertDose: noop,
    upsertTask: noop,
    upsertNote: noop,
    upsertAlert: noop,
    appendReminder: noop,
  };
}

const REMINDER_CHANNEL_TO_DB = {
  push: { channel: 'push', eventType: 'due_reminder' },
  sms: { channel: 'sms', eventType: 'escalation_sms' },
  call: { channel: 'voice_call', eventType: 'escalation_call' },
  manual: { channel: 'in_app', eventType: 'caregiver_nudge' },
} as const;

const REMINDER_STATUS_TO_DB = {
  scheduled: 'scheduled',
  sent: 'sent',
  delivered: 'delivered',
  answered: 'answered',
  'no-answer': 'no_answer',
} as const;

/**
 * Hosted backend, running on the Medimo Postgres schema.
 *
 * `actorProfileId` is the signed-in person (Lorenzo on the caregiver side,
 * Massimo on the senior side); `recipientProfileId` is whose care data is read.
 */
export function createBiltBackend(options: {
  recipientProfileId: string;
  actorProfileId: string;
  historyDays?: number;
}): MedimoBackend {
  const historyDays = options.historyDays ?? 30;

  return {
    name: 'bilt-postgres',
    isRemote: true,

    loadSnapshot: async (patientId: string) => {
      const recipientId = patientId || options.recipientProfileId;
      const from = subDays(new Date(), historyDays - 1).toISOString();
      const to = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

      const [medications, doses, careTasks, appointments, notes, alerts, reminders] =
        await Promise.all([
          fetchMedications(recipientId),
          fetchDoses(recipientId, from, to),
          fetchCareTasks(recipientId),
          fetchAppointmentsAsTasks(recipientId),
          fetchNotes(recipientId),
          fetchAlerts(recipientId),
          fetchReminders(recipientId),
        ]);

      return {
        medications,
        doses,
        tasks: [...careTasks, ...appointments].sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
        notes,
        alerts,
        reminders,
      };
    },

    upsertMedication: async (medication: Medication) => {
      await createPatientMedication(
        toMedicationInsert(medication, {
          recipientProfileId: options.recipientProfileId,
          createdByProfileId: options.actorProfileId,
        }),
      );
    },

    upsertDose: async (dose: Dose) => {
      if (dose.outcome === 'taken') {
        await confirmDose({
          scheduledDoseId: dose.id,
          confirmedByProfileId:
            dose.confirmedBy === 'caregiver' ? options.actorProfileId : undefined,
          method: dose.confirmedBy === 'caregiver' ? 'caregiver_manual' : 'app_tap',
        });
        return;
      }

      if (dose.outcome === 'missed' || dose.outcome === 'skipped') {
        await setDoseStatus(dose.id, dose.outcome);
        return;
      }

      if (dose.snoozedUntil) {
        const minutes = Math.max(1, differenceInMinutes(parseISO(dose.snoozedUntil), new Date()));
        await snoozeDose(dose.id, minutes, options.actorProfileId);
        return;
      }

      await undoDoseConfirmation(dose.id, options.actorProfileId);
    },

    upsertTask: async (task: CareTask) => {
      if (task.done) {
        await setCareTaskDone(task.id, true, options.actorProfileId);
        return;
      }

      await createCareTask(
        toCareTaskInsert(task, {
          recipientProfileId: options.recipientProfileId,
          createdByProfileId: options.actorProfileId,
        }),
      );
    },

    upsertNote: async (note: Note) => {
      await createNote(
        toNoteInsert(note, {
          recipientProfileId: options.recipientProfileId,
          authorProfileId: options.actorProfileId,
        }),
        note.author,
      );
    },

    upsertAlert: async (alert: CareAlert) => {
      if (alert.acknowledged) await acknowledgeAlert(alert.id, options.actorProfileId);
    },

    appendReminder: async (reminder: ReminderEvent) => {
      const mapping = REMINDER_CHANNEL_TO_DB[reminder.channel];
      await logReminderEvent({
        scheduledDoseId: reminder.doseId,
        recipientProfileId: options.recipientProfileId,
        eventType: mapping.eventType,
        channel: mapping.channel,
        provider: reminder.provider,
        deliveryStatus: REMINDER_STATUS_TO_DB[reminder.status],
        detail: reminder.detail,
      });
    },

    subscribeToDoses: (patientId: string, onChange: (dose: Dose) => void) =>
      subscribeToDoses(patientId || options.recipientProfileId, onChange),
  };
}

/** True once the hosted backend can be reached. */
export function isRemoteBackendConfigured(): boolean {
  return isBiltConfigured || Boolean(process.env.EXPO_PUBLIC_BACKEND_URL);
}

/**
 * Picks the gateway the app should use. Without linked profile ids the demo
 * keeps running on the seeded local store.
 */
export function selectBackend(input: {
  snapshot: () => MedimoSnapshot;
  recipientProfileId?: string | null;
  actorProfileId?: string | null;
}): MedimoBackend {
  if (isBiltConfigured && input.recipientProfileId && input.actorProfileId) {
    return createBiltBackend({
      recipientProfileId: input.recipientProfileId,
      actorProfileId: input.actorProfileId,
    });
  }

  return createLocalBackend(input.snapshot);
}
