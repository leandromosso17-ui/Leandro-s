import { addDays, format } from 'date-fns';

import { getBilt } from '@/lib/services/bilt';
import type {
  AdherenceStats,
  CareAlert,
  CareTask,
  DayAdherence,
  DayPartMisses,
  Dose,
  InventoryProjection,
  Medication,
  Note,
  Person,
} from '@/lib/types';

import {
  mapAdherenceDay,
  mapAdherenceStats,
  mapAlert,
  mapAppointment,
  mapCareTask,
  mapDose,
  mapInventoryProjection,
  mapMedication,
  mapMissesByDayPart,
  mapNote,
  mapProfile,
  mapReminder,
  mapTimelineDose,
  toNumber,
  type CareTaskInsert,
  type MedicationBundle,
  type MedicationInsertPayload,
  type NoteInsert,
} from './mappers';
import type {
  AdherenceDailyRow,
  AdherenceStatsRow,
  AppointmentRow,
  CareAgendaRow,
  CareAlertRow,
  CareTaskRow,
  CaregiverRelationshipRow,
  ConfirmationMethod,
  DocumentRow,
  DoseScheduleRow,
  DoseTimelineRow,
  InventoryStatusRow,
  MedicationInventoryRow,
  MedicationRow,
  MissesByDayPartRow,
  NoteRow,
  OcrExtractionRow,
  OcrReviewStatus,
  OcrStructured,
  PatientMedicationRow,
  ProfileRow,
  ReminderEventRow,
  ScheduledDoseRow,
} from './schema';

/** Seeded demo profiles, so the role switcher can claim a real account later. */
export const DEMO_PROFILE_IDS = {
  caregiver: '11111111-1111-4111-8111-111111111111',
  recipient: '22222222-2222-4222-8222-222222222222',
} as const;

export const DOCUMENTS_BUCKET = 'medimo-documents';

/* ------------------------------------------------------------------ */
/* plumbing                                                            */
/* ------------------------------------------------------------------ */

type QueryLike<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
type MutationLike = PromiseLike<{ error: { message: string } | null }>;

async function rows<T>(query: QueryLike<T>, context: string): Promise<T[]> {
  const result = await query;
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data ?? [];
}

async function maybeRow<T>(query: QueryLike<T>, context: string): Promise<T | null> {
  const result = await query;
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data?.[0] ?? null;
}

async function mutate(query: MutationLike, context: string): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(`${context}: ${error.message}`);
}

function localDay(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/* ------------------------------------------------------------------ */
/* profiles + care circle                                              */
/* ------------------------------------------------------------------ */

export async function fetchMyProfile(): Promise<ProfileRow | null> {
  const bilt = getBilt();
  const { data } = await bilt.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null;

  return maybeRow<ProfileRow>(
    bilt.from('profiles').select('*').eq('auth_user_id', userId).limit(1),
    'fetchMyProfile',
  );
}

/** Idempotent profile bootstrap; call once after sign-in. */
export async function ensureProfile(input: {
  fullName: string;
  role: ProfileRow['role'];
  phone?: string;
  timezone?: string;
  language?: string;
}): Promise<ProfileRow | null> {
  return maybeRow<ProfileRow>(
    getBilt().rpc('ensure_profile', {
      p_full_name: input.fullName,
      p_role: input.role,
      p_phone: input.phone ?? null,
      p_timezone: input.timezone ?? 'Europe/Rome',
      p_language: input.language ?? 'it',
    }),
    'ensureProfile',
  );
}

/** Demo-only: attach the signed-in account to a seeded Lorenzo/Massimo profile. */
export async function claimDemoProfile(profileId: string): Promise<ProfileRow | null> {
  return maybeRow<ProfileRow>(
    getBilt().rpc('claim_demo_profile', { p_profile_id: profileId }),
    'claimDemoProfile',
  );
}

export type CareCircleEntry = {
  relationship: CaregiverRelationshipRow;
  person: Person;
};

/** Every recipient the caregiver is linked to (multi-parent ready). */
export async function fetchCareCircle(caregiverProfileId: string): Promise<CareCircleEntry[]> {
  const bilt = getBilt();
  const relationships = await rows<CaregiverRelationshipRow>(
    bilt
      .from('caregiver_relationships')
      .select('*')
      .eq('caregiver_profile_id', caregiverProfileId)
      .eq('status', 'active'),
    'fetchCareCircle.relationships',
  );
  if (relationships.length === 0) return [];

  const profiles = await rows<ProfileRow>(
    bilt
      .from('profiles')
      .select('*')
      .in(
        'id',
        relationships.map((relationship) => relationship.recipient_profile_id),
      ),
    'fetchCareCircle.profiles',
  );

  return relationships.flatMap((relationship) => {
    const profile = profiles.find((row) => row.id === relationship.recipient_profile_id);
    if (!profile) return [];
    return [{ relationship, person: mapProfile(profile, relationship.relationship_label) }];
  });
}

export async function fetchProfiles(ids: string[]): Promise<ProfileRow[]> {
  if (ids.length === 0) return [];
  return rows<ProfileRow>(getBilt().from('profiles').select('*').in('id', ids), 'fetchProfiles');
}

/* ------------------------------------------------------------------ */
/* medications                                                         */
/* ------------------------------------------------------------------ */

export async function fetchMedicationBundles(
  recipientProfileId: string,
): Promise<MedicationBundle[]> {
  const bilt = getBilt();
  const patientMedications = await rows<PatientMedicationRow>(
    bilt
      .from('patient_medications')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: true }),
    'fetchMedicationBundles.patientMedications',
  );
  if (patientMedications.length === 0) return [];

  const patientMedicationIds = patientMedications.map((row) => row.id);
  const medicationIds = [...new Set(patientMedications.map((row) => row.medication_id))];

  const [medications, schedules, inventories] = await Promise.all([
    rows<MedicationRow>(
      bilt.from('medications').select('*').in('id', medicationIds),
      'fetchMedicationBundles.medications',
    ),
    rows<DoseScheduleRow>(
      bilt.from('dose_schedules').select('*').in('patient_medication_id', patientMedicationIds),
      'fetchMedicationBundles.schedules',
    ),
    rows<MedicationInventoryRow>(
      bilt
        .from('medication_inventory')
        .select('*')
        .in('patient_medication_id', patientMedicationIds),
      'fetchMedicationBundles.inventory',
    ),
  ]);

  return patientMedications.flatMap((patientMedication) => {
    const medication = medications.find((row) => row.id === patientMedication.medication_id);
    if (!medication) return [];
    return [
      {
        patientMedication,
        medication,
        schedules: schedules.filter(
          (schedule) => schedule.patient_medication_id === patientMedication.id,
        ),
        inventory: inventories.find(
          (inventory) => inventory.patient_medication_id === patientMedication.id,
        ),
      },
    ];
  });
}

export async function fetchMedications(recipientProfileId: string): Promise<Medication[]> {
  const bundles = await fetchMedicationBundles(recipientProfileId);
  return bundles.map(mapMedication);
}

/**
 * Manual add + "apply scanned prescription" both land here: catalog entry,
 * prescription, recurrence rules, inventory, then the concrete dose instances.
 */
export async function createPatientMedication(
  payload: MedicationInsertPayload,
  options: { horizonDays?: number } = {},
): Promise<PatientMedicationRow> {
  const bilt = getBilt();
  const horizonDays = options.horizonDays ?? 30;

  const existing = await maybeRow<MedicationRow>(
    bilt.from('medications').select('*').ilike('name', payload.medication.name).limit(1),
    'createPatientMedication.findMedication',
  );

  const medication =
    existing ??
    (await maybeRow<MedicationRow>(
      bilt.from('medications').insert(payload.medication).select('*'),
      'createPatientMedication.insertMedication',
    ));
  if (!medication) throw new Error('createPatientMedication: medication could not be created');

  const patientMedication = await maybeRow<PatientMedicationRow>(
    bilt
      .from('patient_medications')
      .insert({ ...payload.patientMedication, medication_id: medication.id })
      .select('*'),
    'createPatientMedication.insertPatientMedication',
  );
  if (!patientMedication) throw new Error('createPatientMedication: prescription not created');

  if (payload.schedules.length > 0) {
    await rows<DoseScheduleRow>(
      bilt
        .from('dose_schedules')
        .insert(
          payload.schedules.map((schedule) => ({
            ...schedule,
            patient_medication_id: patientMedication.id,
          })),
        )
        .select('*'),
      'createPatientMedication.insertSchedules',
    );
  }

  await rows<MedicationInventoryRow>(
    bilt
      .from('medication_inventory')
      .insert({
        patient_medication_id: patientMedication.id,
        initial_quantity: payload.patientMedication.total_quantity,
        remaining_quantity: payload.patientMedication.remaining_quantity,
        unit: payload.patientMedication.dose_unit,
        pack_size: payload.patientMedication.total_quantity,
      })
      .select('*'),
    'createPatientMedication.insertInventory',
  );

  await generateScheduledDoses(patientMedication.id, new Date(), horizonDays);
  await refreshRunoutProjection(patientMedication.id);

  return patientMedication;
}

/** Expands the recurrence rules into scheduled_doses. Safe to call repeatedly. */
export async function generateScheduledDoses(
  patientMedicationId: string,
  from: Date,
  horizonDays: number,
): Promise<number> {
  const created = await rows<ScheduledDoseRow>(
    getBilt().rpc('generate_scheduled_doses', {
      p_patient_medication_id: patientMedicationId,
      p_from: localDay(from),
      p_to: localDay(addDays(from, horizonDays)),
    }),
    'generateScheduledDoses',
  );
  return created.length;
}

export async function refreshRunoutProjection(patientMedicationId: string): Promise<void> {
  await rows<MedicationInventoryRow>(
    getBilt().rpc('refresh_runout_projection', {
      p_patient_medication_id: patientMedicationId,
    }),
    'refreshRunoutProjection',
  );
}

export async function updatePatientMedicationStatus(
  patientMedicationId: string,
  status: PatientMedicationRow['status'],
): Promise<void> {
  await mutate(
    getBilt().from('patient_medications').update({ status }).eq('id', patientMedicationId),
    'updatePatientMedicationStatus',
  );
}

/* ------------------------------------------------------------------ */
/* doses                                                               */
/* ------------------------------------------------------------------ */

export async function fetchDoseTimeline(
  recipientProfileId: string,
  fromISO: string,
  toISO: string,
): Promise<DoseTimelineRow[]> {
  return rows<DoseTimelineRow>(
    getBilt()
      .from('v_dose_timeline')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .gte('scheduled_for', fromISO)
      .lte('scheduled_for', toISO)
      .order('scheduled_for', { ascending: true }),
    'fetchDoseTimeline',
  );
}

/** Lorenzo's dashboard: today's chronological timeline. */
export async function fetchTodayTimeline(
  recipientProfileId: string,
  day: Date = new Date(),
): Promise<DoseTimelineRow[]> {
  return rows<DoseTimelineRow>(
    getBilt()
      .from('v_dose_timeline')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .eq('scheduled_local_date', localDay(day))
      .order('scheduled_for', { ascending: true }),
    'fetchTodayTimeline',
  );
}

export async function fetchDoses(
  recipientProfileId: string,
  fromISO: string,
  toISO: string,
): Promise<Dose[]> {
  const timeline = await fetchDoseTimeline(recipientProfileId, fromISO, toISO);
  return timeline.map(mapTimelineDose);
}

/** Massimo's Today screen: the one medicine to take now. */
export async function fetchCurrentDose(
  recipientProfileId: string,
): Promise<DoseTimelineRow | null> {
  return maybeRow<DoseTimelineRow>(
    getBilt()
      .from('v_dose_timeline')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .in('live_status', ['due', 'late'])
      .order('scheduled_for', { ascending: true })
      .limit(1),
    'fetchCurrentDose',
  );
}

export async function fetchNextDose(recipientProfileId: string): Promise<DoseTimelineRow | null> {
  return maybeRow<DoseTimelineRow>(
    getBilt()
      .from('v_dose_timeline')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .eq('live_status', 'scheduled')
      .gt('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(1),
    'fetchNextDose',
  );
}

/**
 * The double-confirmation "Yes, I took it" writes through one function so the
 * exact timestamp, the history row, the stock movement and the reminder
 * resolution always stay consistent.
 */
export async function confirmDose(input: {
  scheduledDoseId: string;
  confirmedByProfileId?: string;
  method?: ConfirmationMethod;
  note?: string;
}): Promise<Dose | null> {
  const row = await maybeRow<ScheduledDoseRow>(
    getBilt().rpc('confirm_dose', {
      p_scheduled_dose_id: input.scheduledDoseId,
      p_confirmed_by_profile_id: input.confirmedByProfileId ?? null,
      p_method: input.method ?? 'app_tap',
      p_note: input.note ?? null,
    }),
    'confirmDose',
  );
  return row ? mapDose(row) : null;
}

export async function undoDoseConfirmation(
  scheduledDoseId: string,
  actorProfileId?: string,
): Promise<Dose | null> {
  const row = await maybeRow<ScheduledDoseRow>(
    getBilt().rpc('undo_dose_confirmation', {
      p_scheduled_dose_id: scheduledDoseId,
      p_actor_profile_id: actorProfileId ?? null,
    }),
    'undoDoseConfirmation',
  );
  return row ? mapDose(row) : null;
}

export async function snoozeDose(
  scheduledDoseId: string,
  minutes = 10,
  actorProfileId?: string,
): Promise<Dose | null> {
  const row = await maybeRow<ScheduledDoseRow>(
    getBilt().rpc('snooze_dose', {
      p_scheduled_dose_id: scheduledDoseId,
      p_minutes: minutes,
      p_actor_profile_id: actorProfileId ?? null,
    }),
    'snoozeDose',
  );
  return row ? mapDose(row) : null;
}

/** Caregiver correction: mark a dose as missed or skipped without a confirmation. */
export async function setDoseStatus(
  scheduledDoseId: string,
  status: Extract<ScheduledDoseRow['status'], 'missed' | 'skipped' | 'scheduled'>,
): Promise<void> {
  await mutate(
    getBilt()
      .from('scheduled_doses')
      .update({ status, taken_at: null, confirmed_by_profile_id: null, confirmation_method: null })
      .eq('id', scheduledDoseId),
    'setDoseStatus',
  );
}

function isScheduledDoseRow(value: unknown): value is ScheduledDoseRow {
  return (
    typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
  );
}

/** Realtime: the caregiver view updates the moment a dose is confirmed. */
export function subscribeToDoses(
  recipientProfileId: string,
  onChange: (dose: Dose) => void,
): () => void {
  const bilt = getBilt();
  const channel = bilt
    .channel(`scheduled_doses:${recipientProfileId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'scheduled_doses',
        filter: `recipient_profile_id=eq.${recipientProfileId}`,
      },
      (payload) => {
        if (isScheduledDoseRow(payload.new)) onChange(mapDose(payload.new));
      },
    )
    .subscribe();

  return () => {
    void bilt.removeChannel(channel);
  };
}

/* ------------------------------------------------------------------ */
/* reminders + escalation                                              */
/* ------------------------------------------------------------------ */

export async function fetchReminderEvents(
  recipientProfileId: string,
  limit = 60,
): Promise<ReminderEventRow[]> {
  return rows<ReminderEventRow>(
    getBilt()
      .from('reminder_events')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .order('created_at', { ascending: false })
      .limit(limit),
    'fetchReminderEvents',
  );
}

/** Reminder ladder mapped into the app's shape (needs the dose -> medicine link). */
export async function fetchReminders(recipientProfileId: string, limit = 60) {
  const rowList = await fetchReminderEvents(recipientProfileId, limit);
  const doseIds = [
    ...new Set(rowList.flatMap((row) => (row.scheduled_dose_id ? [row.scheduled_dose_id] : []))),
  ];
  const doses =
    doseIds.length === 0
      ? []
      : await rows<ScheduledDoseRow>(
          getBilt().from('scheduled_doses').select('*').in('id', doseIds),
          'fetchReminders.doses',
        );

  return rowList.map((row) => {
    const dose = doses.find((candidate) => candidate.id === row.scheduled_dose_id);
    return mapReminder(row, dose?.patient_medication_id ?? '');
  });
}

export async function logReminderEvent(input: {
  scheduledDoseId: string;
  recipientProfileId: string;
  targetProfileId?: string;
  eventType: ReminderEventRow['event_type'];
  channel: ReminderEventRow['channel'];
  provider: string;
  deliveryStatus: ReminderEventRow['delivery_status'];
  detail?: string;
  providerMessageId?: string;
  attempt?: number;
}): Promise<ReminderEventRow | null> {
  return maybeRow<ReminderEventRow>(
    getBilt()
      .from('reminder_events')
      .insert({
        scheduled_dose_id: input.scheduledDoseId,
        recipient_profile_id: input.recipientProfileId,
        target_profile_id: input.targetProfileId ?? input.recipientProfileId,
        event_type: input.eventType,
        channel: input.channel,
        provider: input.provider,
        provider_message_id: input.providerMessageId ?? null,
        attempt: input.attempt ?? 1,
        sent_at: new Date().toISOString(),
        delivery_status: input.deliveryStatus,
        detail: input.detail ?? null,
      })
      .select('*'),
    'logReminderEvent',
  );
}

/* ------------------------------------------------------------------ */
/* alerts                                                              */
/* ------------------------------------------------------------------ */

export async function fetchAlerts(
  recipientProfileId: string,
  options: { openOnly?: boolean } = {},
): Promise<CareAlert[]> {
  const bilt = getBilt();
  let query = bilt
    .from('care_alerts')
    .select('*')
    .eq('recipient_profile_id', recipientProfileId)
    .order('created_at', { ascending: false });
  if (options.openOnly) query = query.is('acknowledged_at', null);

  const rowList = await rows<CareAlertRow>(query, 'fetchAlerts');
  return rowList.flatMap((row) => {
    const alert = mapAlert(row);
    return alert ? [alert] : [];
  });
}

export async function acknowledgeAlert(alertId: string, profileId: string): Promise<void> {
  await mutate(
    getBilt()
      .from('care_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_profile_id: profileId,
      })
      .eq('id', alertId),
    'acknowledgeAlert',
  );
}

/* ------------------------------------------------------------------ */
/* inventory + refills                                                 */
/* ------------------------------------------------------------------ */

export async function fetchInventoryStatus(
  recipientProfileId: string,
): Promise<InventoryStatusRow[]> {
  return rows<InventoryStatusRow>(
    getBilt()
      .from('v_inventory_status')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .order('days_left', { ascending: true, nullsFirst: false }),
    'fetchInventoryStatus',
  );
}

export async function fetchInventoryProjections(
  recipientProfileId: string,
): Promise<InventoryProjection[]> {
  const rowList = await fetchInventoryStatus(recipientProfileId);
  return rowList.map(mapInventoryProjection);
}

/** Records a refill: ledger entry, new balance, refreshed runout date. */
export async function recordRefill(input: {
  patientMedicationId: string;
  quantity: number;
  createdByProfileId: string;
  reason?: string;
}): Promise<void> {
  const bilt = getBilt();
  const inventory = await maybeRow<MedicationInventoryRow>(
    bilt
      .from('medication_inventory')
      .select('*')
      .eq('patient_medication_id', input.patientMedicationId)
      .limit(1),
    'recordRefill.inventory',
  );
  if (!inventory) throw new Error('recordRefill: no inventory row for this prescription');

  const balanceAfter = toNumber(inventory.remaining_quantity) + input.quantity;

  await mutate(
    bilt
      .from('medication_inventory')
      .update({
        remaining_quantity: balanceAfter,
        last_refill_at: new Date().toISOString(),
      })
      .eq('id', inventory.id),
    'recordRefill.updateInventory',
  );

  await mutate(
    bilt.from('inventory_transactions').insert({
      patient_medication_id: input.patientMedicationId,
      transaction_type: 'refill',
      quantity_delta: input.quantity,
      balance_after: balanceAfter,
      unit: inventory.unit,
      reason: input.reason ?? 'Refill collected',
      created_by_profile_id: input.createdByProfileId,
    }),
    'recordRefill.ledger',
  );

  await refreshRunoutProjection(input.patientMedicationId);
}

/* ------------------------------------------------------------------ */
/* adherence                                                           */
/* ------------------------------------------------------------------ */

export async function fetchAdherenceStats(
  recipientProfileId: string,
  days = 7,
): Promise<AdherenceStats> {
  const row = await maybeRow<AdherenceStatsRow>(
    getBilt().rpc('adherence_stats', {
      p_recipient_profile_id: recipientProfileId,
      p_days: days,
    }),
    'fetchAdherenceStats',
  );

  return row
    ? mapAdherenceStats(row)
    : { windowDays: days, total: 0, taken: 0, missed: 0, score: 0 };
}

export async function fetchAdherenceByDay(
  recipientProfileId: string,
  days = 7,
): Promise<DayAdherence[]> {
  const from = localDay(addDays(new Date(), -(days - 1)));
  const rowList = await rows<AdherenceDailyRow>(
    getBilt()
      .from('v_adherence_daily')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .gte('scheduled_local_date', from)
      .order('scheduled_local_date', { ascending: true }),
    'fetchAdherenceByDay',
  );
  return rowList.map(mapAdherenceDay);
}

export async function fetchMissesByDayPart(
  recipientProfileId: string,
  days = 30,
): Promise<DayPartMisses[]> {
  const rowList = await rows<MissesByDayPartRow>(
    getBilt().rpc('misses_by_day_part', {
      p_recipient_profile_id: recipientProfileId,
      p_days: days,
    }),
    'fetchMissesByDayPart',
  );
  return mapMissesByDayPart(rowList);
}

/* ------------------------------------------------------------------ */
/* care plan: appointments + tasks                                     */
/* ------------------------------------------------------------------ */

export async function fetchCareAgenda(
  recipientProfileId: string,
  from: Date,
  to: Date,
): Promise<CareAgendaRow[]> {
  return rows<CareAgendaRow>(
    getBilt()
      .from('v_care_agenda')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .gte('due_at', from.toISOString())
      .lte('due_at', to.toISOString())
      .order('due_at', { ascending: true }),
    'fetchCareAgenda',
  );
}

export async function fetchCareTasks(recipientProfileId: string): Promise<CareTask[]> {
  const rowList = await rows<CareTaskRow>(
    getBilt()
      .from('care_tasks')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .order('due_at', { ascending: true }),
    'fetchCareTasks',
  );
  return rowList.map(mapCareTask);
}

export async function fetchAppointmentsAsTasks(recipientProfileId: string): Promise<CareTask[]> {
  const rowList = await rows<AppointmentRow>(
    getBilt()
      .from('appointments')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .order('starts_at', { ascending: true }),
    'fetchAppointmentsAsTasks',
  );
  return rowList.map(mapAppointment);
}

export async function createCareTask(payload: CareTaskInsert): Promise<CareTask | null> {
  const row = await maybeRow<CareTaskRow>(
    getBilt().from('care_tasks').insert(payload).select('*'),
    'createCareTask',
  );
  return row ? mapCareTask(row) : null;
}

export async function setCareTaskDone(
  taskId: string,
  done: boolean,
  profileId: string,
): Promise<void> {
  await mutate(
    getBilt()
      .from('care_tasks')
      .update({
        status: done ? 'done' : 'open',
        completed_at: done ? new Date().toISOString() : null,
        completed_by_profile_id: done ? profileId : null,
      })
      .eq('id', taskId),
    'setCareTaskDone',
  );
}

export async function createAppointment(input: {
  recipientProfileId: string;
  createdByProfileId: string;
  title: string;
  appointmentType: AppointmentRow['appointment_type'];
  startsAt: string;
  location?: string;
  practitioner?: string;
  notes?: string;
}): Promise<AppointmentRow | null> {
  return maybeRow<AppointmentRow>(
    getBilt()
      .from('appointments')
      .insert({
        recipient_profile_id: input.recipientProfileId,
        created_by_profile_id: input.createdByProfileId,
        title: input.title,
        appointment_type: input.appointmentType,
        starts_at: input.startsAt,
        location: input.location ?? null,
        practitioner_name: input.practitioner ?? null,
        notes: input.notes ?? null,
      })
      .select('*'),
    'createAppointment',
  );
}

/* ------------------------------------------------------------------ */
/* notes                                                               */
/* ------------------------------------------------------------------ */

export async function fetchNotes(recipientProfileId: string, limit = 50): Promise<Note[]> {
  const rowList = await rows<NoteRow>(
    getBilt()
      .from('notes')
      .select('*')
      .eq('recipient_profile_id', recipientProfileId)
      .order('created_at', { ascending: false })
      .limit(limit),
    'fetchNotes',
  );
  if (rowList.length === 0) return [];

  const authorIds = [
    ...new Set(rowList.flatMap((row) => (row.author_profile_id ? [row.author_profile_id] : []))),
  ];
  const authors = await fetchProfiles(authorIds);

  return rowList.map((row) => {
    const author = authors.find((profile) => profile.id === row.author_profile_id);
    return mapNote(row, author?.full_name.split(' ')[0] ?? 'Caregiver');
  });
}

export async function createNote(payload: NoteInsert, authorName: string): Promise<Note | null> {
  const row = await maybeRow<NoteRow>(
    getBilt().from('notes').insert(payload).select('*'),
    'createNote',
  );
  return row ? mapNote(row, authorName) : null;
}

/* ------------------------------------------------------------------ */
/* prescription scan: documents + OCR                                  */
/* ------------------------------------------------------------------ */

/** Uploads the captured image to the private bucket and records the document. */
export async function uploadPrescription(input: {
  recipientProfileId: string;
  uploadedByProfileId: string;
  file: Blob;
  fileName: string;
  contentType: string;
  documentType?: DocumentRow['document_type'];
  sourceLabel?: string;
}): Promise<DocumentRow | null> {
  const bilt = getBilt();
  const path = `${input.recipientProfileId}/${Date.now()}-${input.fileName}`;

  const upload = await bilt.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, input.file, { contentType: input.contentType, upsert: false });
  if (upload.error) throw new Error(`uploadPrescription: ${upload.error.message}`);

  return maybeRow<DocumentRow>(
    bilt
      .from('documents')
      .insert({
        recipient_profile_id: input.recipientProfileId,
        uploaded_by_profile_id: input.uploadedByProfileId,
        document_type: input.documentType ?? 'prescription',
        storage_bucket: DOCUMENTS_BUCKET,
        storage_path: path,
        mime_type: input.contentType,
        size_bytes: input.file.size,
        source_label: input.sourceLabel ?? null,
      })
      .select('*'),
    'uploadPrescription.document',
  );
}

export async function createSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await getBilt()
    .storage.from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(`createSignedDocumentUrl: ${error.message}`);
  return data?.signedUrl ?? null;
}

export async function saveOcrExtraction(input: {
  documentId: string;
  provider: string;
  rawText: string;
  structured: OcrStructured;
  confidence?: number;
}): Promise<OcrExtractionRow | null> {
  return maybeRow<OcrExtractionRow>(
    getBilt()
      .from('ocr_extractions')
      .insert({
        document_id: input.documentId,
        provider: input.provider,
        raw_text: input.rawText,
        structured: input.structured,
        confidence: input.confidence ?? null,
        review_status: 'pending',
      })
      .select('*'),
    'saveOcrExtraction',
  );
}

export async function fetchPendingExtractions(
  recipientProfileId: string,
): Promise<OcrExtractionRow[]> {
  const bilt = getBilt();
  const documents = await rows<DocumentRow>(
    bilt.from('documents').select('*').eq('recipient_profile_id', recipientProfileId),
    'fetchPendingExtractions.documents',
  );
  if (documents.length === 0) return [];

  return rows<OcrExtractionRow>(
    bilt
      .from('ocr_extractions')
      .select('*')
      .in(
        'document_id',
        documents.map((document) => document.id),
      )
      .in('review_status', ['pending', 'in_review'])
      .order('created_at', { ascending: false }),
    'fetchPendingExtractions.extractions',
  );
}

/** Lorenzo reviewed the extracted medicines before they become prescriptions. */
export async function setExtractionReviewStatus(input: {
  extractionId: string;
  status: OcrReviewStatus;
  reviewedByProfileId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await mutate(
    getBilt()
      .from('ocr_extractions')
      .update({
        review_status: input.status,
        reviewed_by_profile_id: input.reviewedByProfileId,
        reviewed_at: now,
        applied_at: input.status === 'applied' ? now : null,
      })
      .eq('id', input.extractionId),
    'setExtractionReviewStatus',
  );
}

/* ------------------------------------------------------------------ */
/* audit trail                                                         */
/* ------------------------------------------------------------------ */

export async function logAudit(input: {
  actorProfileId: string | null;
  recipientProfileId: string | null;
  entityType: string;
  entityId?: string;
  action: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await mutate(
    getBilt()
      .from('audit_logs')
      .insert({
        actor_profile_id: input.actorProfileId,
        recipient_profile_id: input.recipientProfileId,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        action: input.action,
        payload: input.payload ?? {},
      }),
    'logAudit',
  );
}
