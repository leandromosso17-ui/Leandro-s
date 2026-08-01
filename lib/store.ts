import { addDays, addMinutes, startOfDay } from 'date-fns';
import { create } from 'zustand';

import { doseReminderSms, getSmsProvider } from '@/lib/services/sms';
import { doseCallScript, getVoiceProvider } from '@/lib/services/voice';
import { buildDoses, projectInventory } from '@/lib/schedule';
import { clockOf } from '@/lib/time';
import { caregiver, seedDemo, senior } from '@/lib/seed';
import type {
  CareAlert,
  CareTask,
  CareTaskKind,
  Dose,
  Medication,
  Note,
  NoteCategory,
  ReminderEvent,
  Role,
  ScanExtractedMedicine,
  ScanResult,
} from '@/lib/types';

/** Days of future doses materialised when a medicine is created. */
const FUTURE_DAYS = 14;

export type MedicationDraft = {
  name: string;
  strength: string;
  purpose: string;
  form: Medication['form'];
  unitsPerIntake: number;
  times: string[];
  instruction: string;
  foodRule: Medication['foodRule'];
  packSize: number;
  remainingUnits: number;
  prescriber: string;
  color: Medication['color'];
  createdVia: Medication['createdVia'];
};

export type TaskDraft = {
  kind: CareTaskKind;
  title: string;
  detail: string;
  dueAt: string;
  location?: string;
  medicationId?: string;
};

export type NoteDraft = {
  category: NoteCategory;
  title: string;
  body: string;
};

type MedimoState = {
  role: Role | null;
  caregiver: typeof caregiver;
  senior: typeof senior;
  medications: Medication[];
  doses: Dose[];
  tasks: CareTask[];
  notes: Note[];
  alerts: CareAlert[];
  reminders: ReminderEvent[];
  pendingScan: ScanResult | null;
  busyDoseId: string | null;

  setRole: (role: Role | null) => void;
  resetDemo: () => void;

  markDoseTaken: (doseId: string, by: Role) => void;
  undoDoseTaken: (doseId: string) => void;
  markDoseMissed: (doseId: string) => void;
  snoozeDose: (doseId: string, minutes: number) => void;

  addMedication: (draft: MedicationDraft) => Medication;
  refillMedication: (medicationId: string, units: number) => void;

  addTask: (draft: TaskDraft) => void;
  toggleTask: (taskId: string) => void;
  addNote: (draft: NoteDraft) => void;
  acknowledgeAlert: (alertId: string) => void;
  acknowledgeAllAlerts: () => void;

  setPendingScan: (scan: ScanResult | null) => void;
  applyScan: (medicines: ScanExtractedMedicine[]) => void;

  sendSmsReminder: (doseId: string) => Promise<void>;
  placeEscalationCall: (doseId: string) => Promise<void>;
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function frequencyLabelFor(times: string[]): string {
  if (times.length === 1) return `Once daily at ${times[0]}`;
  if (times.length === 2) return `Twice daily at ${times.join(' and ')}`;
  return `${times.length} times daily`;
}

function adjustStock(medications: Medication[], medicationId: string, delta: number): Medication[] {
  return medications.map((medication) =>
    medication.id === medicationId
      ? { ...medication, remainingUnits: Math.max(0, medication.remainingUnits + delta) }
      : medication,
  );
}

function initialState(now: Date = new Date()) {
  const seeded = seedDemo(now);
  return {
    role: null as Role | null,
    caregiver,
    senior,
    medications: seeded.medications,
    doses: seeded.doses,
    tasks: seeded.tasks,
    notes: seeded.notes,
    alerts: seeded.alerts,
    reminders: seeded.reminders,
    pendingScan: null as ScanResult | null,
    busyDoseId: null as string | null,
  };
}

export const useMedimoStore = create<MedimoState>()((set, get) => ({
  ...initialState(),

  setRole: (role) => set({ role }),

  resetDemo: () => set({ ...initialState(), role: get().role }),

  markDoseTaken: (doseId, by) => {
    const dose = get().doses.find((item) => item.id === doseId);
    if (!dose || dose.outcome === 'taken') return;
    const takenAt = new Date().toISOString();

    set((state) => ({
      doses: state.doses.map((item) =>
        item.id === doseId
          ? { ...item, outcome: 'taken', takenAt, confirmedBy: by, snoozedUntil: null }
          : item,
      ),
      medications: adjustStock(state.medications, dose.medicationId, -dose.units),
      alerts: state.alerts.map((alert) =>
        alert.doseId === doseId ? { ...alert, acknowledged: true } : alert,
      ),
      reminders: [
        ...state.reminders,
        {
          id: makeId('rem'),
          doseId,
          medicationId: dose.medicationId,
          channel: 'manual',
          status: 'answered',
          at: takenAt,
          detail:
            by === 'senior' ? 'Massimo confirmed the dose' : 'Lorenzo marked the dose as taken',
          provider: 'in-app',
        },
      ],
    }));
  },

  undoDoseTaken: (doseId) => {
    const dose = get().doses.find((item) => item.id === doseId);
    if (!dose || dose.outcome !== 'taken') return;

    set((state) => ({
      doses: state.doses.map((item) =>
        item.id === doseId
          ? { ...item, outcome: 'pending', takenAt: null, confirmedBy: null }
          : item,
      ),
      medications: adjustStock(state.medications, dose.medicationId, dose.units),
      reminders: [
        ...state.reminders,
        {
          id: makeId('rem'),
          doseId,
          medicationId: dose.medicationId,
          channel: 'manual',
          status: 'answered',
          at: new Date().toISOString(),
          detail: 'Confirmation undone — dose is open again',
          provider: 'in-app',
        },
      ],
    }));
  },

  markDoseMissed: (doseId) =>
    set((state) => ({
      doses: state.doses.map((item) =>
        item.id === doseId ? { ...item, outcome: 'missed', takenAt: null } : item,
      ),
    })),

  snoozeDose: (doseId, minutes) =>
    set((state) => ({
      doses: state.doses.map((item) =>
        item.id === doseId
          ? { ...item, snoozedUntil: addMinutes(new Date(), minutes).toISOString() }
          : item,
      ),
    })),

  addMedication: (draft) => {
    const now = new Date();
    const medication: Medication = {
      id: makeId('med'),
      name: draft.name,
      strength: draft.strength,
      purpose: draft.purpose,
      form: draft.form,
      unitsPerIntake: draft.unitsPerIntake,
      times: [...draft.times].sort((a, b) => a.localeCompare(b)),
      frequencyLabel: frequencyLabelFor(draft.times),
      instruction: draft.instruction,
      foodRule: draft.foodRule,
      packSize: draft.packSize,
      remainingUnits: draft.remainingUnits,
      prescriber: draft.prescriber,
      color: draft.color,
      createdVia: draft.createdVia,
      createdAt: now.toISOString(),
    };

    const newDoses = buildDoses(medication, startOfDay(now), addDays(startOfDay(now), FUTURE_DAYS));

    set((state) => ({
      medications: [...state.medications, medication],
      doses: [...state.doses, ...newDoses],
    }));

    return medication;
  },

  refillMedication: (medicationId, units) =>
    set((state) => ({
      medications: state.medications.map((medication) =>
        medication.id === medicationId
          ? { ...medication, remainingUnits: medication.remainingUnits + units }
          : medication,
      ),
      alerts: state.alerts.map((alert) =>
        alert.kind === 'low-stock' && alert.medicationId === medicationId
          ? { ...alert, acknowledged: true }
          : alert,
      ),
    })),

  addTask: (draft) =>
    set((state) => ({
      tasks: [...state.tasks, { ...draft, id: makeId('task'), done: false }],
    })),

  toggleTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
    })),

  addNote: (draft) =>
    set((state) => ({
      notes: [
        {
          ...draft,
          id: makeId('note'),
          createdAt: new Date().toISOString(),
          author: state.caregiver.name,
        },
        ...state.notes,
      ],
    })),

  acknowledgeAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert,
      ),
    })),

  acknowledgeAllAlerts: () =>
    set((state) => ({
      alerts: state.alerts.map((alert) => ({ ...alert, acknowledged: true })),
    })),

  setPendingScan: (scan) => set({ pendingScan: scan }),

  applyScan: (medicines) => {
    const add = get().addMedication;
    for (const medicine of medicines) {
      add({
        name: medicine.name,
        strength: medicine.strength,
        purpose: medicine.purpose,
        form: medicine.form,
        unitsPerIntake: medicine.unitsPerIntake,
        times: medicine.times,
        instruction: medicine.instruction,
        foodRule: medicine.foodRule,
        packSize: medicine.packSize,
        remainingUnits: medicine.packSize,
        prescriber: medicine.prescriber,
        color: medicine.color,
        createdVia: 'scan',
      });
    }
    set({ pendingScan: null });
  },

  sendSmsReminder: async (doseId) => {
    const state = get();
    const dose = state.doses.find((item) => item.id === doseId);
    const medication = state.medications.find((item) => item.id === dose?.medicationId);
    if (!dose || !medication) return;

    set({ busyDoseId: doseId });
    const provider = getSmsProvider();
    const body = doseReminderSms(medication.name, medication.strength, clockOf(dose.scheduledFor));

    try {
      const result = await provider.sendSms({
        to: state.senior.phone,
        body,
        reference: doseId,
      });

      set((current) => ({
        busyDoseId: null,
        reminders: [
          ...current.reminders,
          {
            id: makeId('rem'),
            doseId,
            medicationId: medication.id,
            channel: 'sms',
            status: result.status === 'failed' ? 'sent' : 'delivered',
            at: result.sentAt,
            detail: `SMS sent to Massimo: “${body}”`,
            provider: 'sms-provider',
          },
        ],
      }));
    } catch {
      set({ busyDoseId: null });
    }
  },

  placeEscalationCall: async (doseId) => {
    const state = get();
    const dose = state.doses.find((item) => item.id === doseId);
    const medication = state.medications.find((item) => item.id === dose?.medicationId);
    if (!dose || !medication) return;

    set({ busyDoseId: doseId });
    const provider = getVoiceProvider();
    const script = doseCallScript(medication.name, medication.strength, state.senior.name);

    try {
      const result = await provider.placeCall({
        to: state.senior.phone,
        script,
        language: 'it',
        reference: doseId,
      });

      set((current) => ({
        busyDoseId: null,
        reminders: [
          ...current.reminders,
          {
            id: makeId('rem'),
            doseId,
            medicationId: medication.id,
            channel: 'call',
            status: result.status === 'answered' ? 'answered' : 'no-answer',
            at: result.startedAt,
            detail:
              result.status === 'answered'
                ? `Voice call answered (${result.durationSeconds}s) — Massimo said he is taking it now`
                : 'Voice call placed — no answer',
            provider: 'elevenlabs',
          },
        ],
      }));
    } catch {
      set({ busyDoseId: null });
    }
  },
}));

/** Helper used by inventory and dashboard screens. */
export function inventoryFor(medications: Medication[], now: Date) {
  return medications.map((medication) => projectInventory(medication, now));
}
