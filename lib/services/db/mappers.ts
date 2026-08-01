import { format, parseISO } from 'date-fns';

import { pillColorKeys, type PillColorKey } from '@/lib/theme';
import type {
  AdherenceStats,
  CareAlert,
  CareTask,
  DayAdherence,
  DayPart,
  DayPartMisses,
  Dose,
  DoseOutcome,
  InventoryProjection,
  Medication,
  Note,
  Person,
  PillForm,
  ReminderChannel,
  ReminderEvent,
  ReminderStatus,
} from '@/lib/types';

import type {
  AdherenceDailyRow,
  AdherenceStatsRow,
  AppointmentRow,
  CareAlertRow,
  CareTaskRow,
  DbDayPart,
  DbDoseStatus,
  DbFoodRule,
  DbNoteType,
  DbReminderChannel,
  DeliveryStatus,
  DoseScheduleRow,
  DoseTimelineRow,
  InventoryStatusRow,
  MedicationForm,
  MedicationInventoryRow,
  MedicationRow,
  MissesByDayPartRow,
  NoteRow,
  Numeric,
  PatientMedicationRow,
  ProfileRow,
  ReminderEventRow,
  ScheduledDoseRow,
} from './schema';

/* ------------------------------------------------------------------ */
/* primitives                                                          */
/* ------------------------------------------------------------------ */

export function toNumber(value: Numeric | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** '08:00:00' -> '08:00' */
export function toClock(timeOfDay: string): string {
  return timeOfDay.slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* enum bridges                                                        */
/* ------------------------------------------------------------------ */

const FORM_TO_APP: Record<MedicationForm, PillForm> = {
  tablet: 'tablet',
  capsule: 'capsule',
  liquid: 'drops',
  drops: 'drops',
  sachet: 'sachet',
  injection: 'tablet',
  inhaler: 'tablet',
  cream: 'tablet',
  patch: 'tablet',
  other: 'tablet',
};

const FORM_TO_DB: Record<PillForm, MedicationForm> = {
  tablet: 'tablet',
  capsule: 'capsule',
  drops: 'drops',
  sachet: 'sachet',
};

const FOOD_RULE_TO_APP: Record<DbFoodRule, Medication['foodRule']> = {
  before_food: 'before-food',
  with_food: 'with-food',
  after_food: 'after-food',
  any_time: 'any-time',
};

const FOOD_RULE_TO_DB: Record<Medication['foodRule'], DbFoodRule> = {
  'before-food': 'before_food',
  'with-food': 'with_food',
  'after-food': 'after_food',
  'any-time': 'any_time',
};

const OUTCOME_FROM_STATUS: Record<DbDoseStatus, DoseOutcome> = {
  scheduled: 'pending',
  due: 'pending',
  late: 'pending',
  taken: 'taken',
  missed: 'missed',
  skipped: 'skipped',
};

const DAY_PART_TO_APP: Record<DbDayPart, DayPart> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'evening',
};

const CHANNEL_TO_APP: Record<DbReminderChannel, ReminderChannel> = {
  push: 'push',
  sms: 'sms',
  voice_call: 'call',
  in_app: 'manual',
};

const DELIVERY_TO_APP: Record<DeliveryStatus, ReminderStatus> = {
  scheduled: 'scheduled',
  sent: 'sent',
  delivered: 'delivered',
  failed: 'no-answer',
  answered: 'answered',
  no_answer: 'no-answer',
  resolved: 'delivered',
};

const NOTE_TYPE_TO_APP: Record<DbNoteType, Note['category']> = {
  symptom: 'symptom',
  side_effect: 'side-effect',
  care: 'care',
  follow_up: 'follow-up',
};

const NOTE_TYPE_TO_DB: Record<Note['category'], DbNoteType> = {
  symptom: 'symptom',
  'side-effect': 'side_effect',
  care: 'care',
  'follow-up': 'follow_up',
};

const TASK_KIND_TO_APP: Record<CareTaskRow['task_type'], CareTask['kind']> = {
  refill: 'refill',
  pharmacy_pickup: 'pickup',
  prescription_renewal: 'renewal',
  appointment_prep: 'appointment',
  follow_up: 'appointment',
  other: 'refill',
};

const TASK_KIND_TO_DB: Record<CareTask['kind'], CareTaskRow['task_type']> = {
  refill: 'refill',
  pickup: 'pharmacy_pickup',
  renewal: 'prescription_renewal',
  appointment: 'appointment_prep',
};

const ALERT_KIND_TO_APP: Record<CareAlertRow['kind'], CareAlert['kind'] | null> = {
  missed_dose: 'missed-dose',
  late_dose: 'late-dose',
  consecutive_misses: 'consecutive-misses',
  low_stock: 'low-stock',
  refill_due: 'low-stock',
  // Appointment reminders live on the care plan screen, not in the alert centre.
  appointment_soon: null,
};

const PROVIDER_TO_APP: Record<string, ReminderEvent['provider']> = {
  'expo-notifications': 'expo-notifications',
  'sms-provider': 'sms-provider',
  elevenlabs: 'elevenlabs',
  'in-app': 'in-app',
};

function toPillColor(colorKey: string | null): PillColorKey {
  return pillColorKeys.find((key) => key === colorKey) ?? 'blue';
}

/* ------------------------------------------------------------------ */
/* rows -> app types                                                   */
/* ------------------------------------------------------------------ */

export function mapProfile(row: ProfileRow, relationshipLabel?: string): Person {
  return {
    id: row.id,
    name: row.full_name.split(' ')[0] ?? row.full_name,
    role: row.role === 'caregiver' ? 'caregiver' : 'senior',
    relationship: relationshipLabel ?? (row.role === 'caregiver' ? 'Caregiver' : 'Care recipient'),
    phone: row.phone ?? '',
    avatarInitials: row.avatar_initials ?? row.full_name.slice(0, 1).toUpperCase(),
    city: row.city ?? '',
  };
}

export type MedicationBundle = {
  patientMedication: PatientMedicationRow;
  medication: MedicationRow;
  schedules: DoseScheduleRow[];
  inventory?: MedicationInventoryRow;
};

/**
 * The app's `Medication` is a flattened join of patient_medications +
 * medications + dose_schedules + medication_inventory.
 */
export function mapMedication(bundle: MedicationBundle): Medication {
  const { patientMedication: pm, medication, schedules, inventory } = bundle;
  const times = schedules
    .filter((schedule) => schedule.is_active && !schedule.is_prn)
    .map((schedule) => toClock(schedule.time_of_day))
    .sort((a, b) => a.localeCompare(b));

  return {
    id: pm.id,
    name: medication.name,
    strength: medication.strength ?? '',
    purpose: medication.purpose ?? '',
    form: FORM_TO_APP[medication.form],
    unitsPerIntake: toNumber(pm.dose_amount, 1),
    times,
    frequencyLabel: pm.frequency_label ?? '',
    instruction: pm.instructions ?? '',
    foodRule: FOOD_RULE_TO_APP[pm.food_rule],
    packSize: toNumber(inventory?.pack_size ?? pm.total_quantity, 0),
    remainingUnits: toNumber(inventory?.remaining_quantity ?? pm.remaining_quantity, 0),
    prescriber: pm.prescriber_name ?? '',
    color: toPillColor(medication.color_key),
    createdVia: pm.source_type === 'ocr' ? 'scan' : pm.source_type === 'seed' ? 'seed' : 'manual',
    createdAt: pm.created_at,
  };
}

export function mapDose(row: ScheduledDoseRow): Dose {
  return {
    id: row.id,
    medicationId: row.patient_medication_id,
    scheduledFor: row.scheduled_for,
    units: toNumber(row.dose_amount, 1),
    outcome: OUTCOME_FROM_STATUS[row.status],
    takenAt: row.taken_at,
    confirmedBy: row.confirmed_by_profile_id
      ? row.confirmed_by_profile_id === row.recipient_profile_id
        ? 'senior'
        : 'caregiver'
      : null,
    snoozedUntil: row.snoozed_until,
  };
}

export function mapTimelineDose(row: DoseTimelineRow): Dose {
  return {
    id: row.scheduled_dose_id,
    medicationId: row.patient_medication_id,
    scheduledFor: row.scheduled_for,
    units: toNumber(row.dose_amount, 1),
    outcome: OUTCOME_FROM_STATUS[row.stored_status],
    takenAt: row.taken_at,
    confirmedBy: row.confirmed_by_profile_id
      ? row.confirmed_by_profile_id === row.recipient_profile_id
        ? 'senior'
        : 'caregiver'
      : null,
    snoozedUntil: row.snoozed_until,
  };
}

export function mapCareTask(row: CareTaskRow): CareTask {
  return {
    id: row.id,
    kind: TASK_KIND_TO_APP[row.task_type],
    title: row.title,
    detail: row.detail ?? '',
    dueAt: row.due_at,
    location: row.location ?? undefined,
    medicationId: row.patient_medication_id ?? undefined,
    done: row.status === 'done',
  };
}

export function mapAppointment(row: AppointmentRow): CareTask {
  return {
    id: row.id,
    kind: 'appointment',
    title: row.title,
    detail: row.notes ?? '',
    dueAt: row.starts_at,
    location: row.location ?? undefined,
    done: row.status === 'completed',
  };
}

export function mapNote(row: NoteRow, authorName: string): Note {
  return {
    id: row.id,
    category: NOTE_TYPE_TO_APP[row.note_type],
    title: row.title ?? '',
    body: row.content,
    createdAt: row.created_at,
    author: authorName,
  };
}

/** Returns null for alert kinds the mobile alert centre does not render. */
export function mapAlert(row: CareAlertRow): CareAlert | null {
  const kind = ALERT_KIND_TO_APP[row.kind];
  if (!kind) return null;

  return {
    id: row.id,
    kind,
    severity: row.severity,
    title: row.title,
    message: row.message ?? '',
    createdAt: row.created_at,
    medicationId: row.patient_medication_id ?? undefined,
    doseId: row.scheduled_dose_id ?? undefined,
    acknowledged: row.acknowledged_at !== null,
  };
}

export function mapReminder(row: ReminderEventRow, medicationId: string): ReminderEvent {
  return {
    id: row.id,
    doseId: row.scheduled_dose_id ?? '',
    medicationId,
    channel: CHANNEL_TO_APP[row.channel],
    status: DELIVERY_TO_APP[row.delivery_status],
    at: row.sent_at ?? row.scheduled_for ?? row.created_at,
    detail: row.detail ?? '',
    provider: (row.provider && PROVIDER_TO_APP[row.provider]) || 'in-app',
  };
}

export function mapInventoryProjection(row: InventoryStatusRow): InventoryProjection {
  const dailyUnits = toNumber(row.daily_units, 0);
  const remainingUnits = toNumber(row.remaining_quantity, 0);
  const daysLeft = row.days_left ?? (dailyUnits > 0 ? Math.floor(remainingUnits / dailyUnits) : 0);

  return {
    medicationId: row.patient_medication_id,
    dailyUnits,
    remainingUnits,
    packSize: toNumber(row.pack_size, 0),
    daysLeft,
    runoutISO: row.projected_runout_date ?? '',
    risk: row.refill_risk,
  };
}

export function mapAdherenceStats(row: AdherenceStatsRow): AdherenceStats {
  return {
    windowDays: row.window_days,
    total: row.total_doses,
    taken: row.taken_doses,
    missed: row.missed_doses,
    score: row.adherence_score,
  };
}

export function mapAdherenceDay(row: AdherenceDailyRow): DayAdherence {
  return {
    dateISO: row.scheduled_local_date,
    label: format(parseISO(row.scheduled_local_date), 'EEE'),
    total: row.total_doses,
    taken: row.taken_doses,
    score: row.adherence_score,
  };
}

export function mapMissesByDayPart(rows: MissesByDayPartRow[]): DayPartMisses[] {
  const parts: DayPart[] = ['morning', 'afternoon', 'evening'];

  return parts.map((part) => {
    const matching = rows.filter((row) => DAY_PART_TO_APP[row.part] === part);
    return {
      part,
      missed: matching.reduce((sum, row) => sum + row.missed_doses, 0),
      total: matching.reduce((sum, row) => sum + row.total_doses, 0),
    };
  });
}

/* ------------------------------------------------------------------ */
/* app types -> insert payloads                                        */
/* ------------------------------------------------------------------ */

export type MedicationInsertPayload = {
  medication: {
    name: string;
    form: MedicationForm;
    strength: string | null;
    dose_unit: string;
    purpose: string | null;
    color_key: string;
    source_type: PatientMedicationRow['source_type'];
    created_by_profile_id: string;
  };
  patientMedication: {
    recipient_profile_id: string;
    display_name: string;
    instructions: string;
    prescribed_dose: string;
    dose_amount: number;
    dose_unit: string;
    frequency_label: string;
    food_rule: DbFoodRule;
    prescriber_name: string;
    total_quantity: number;
    remaining_quantity: number;
    source_type: PatientMedicationRow['source_type'];
    created_by_profile_id: string;
  };
  schedules: {
    time_of_day: string;
    dose_amount: number;
    dose_unit: string;
    food_rule: DbFoodRule;
  }[];
};

/** Splits an app-shaped medication into the rows the schema expects. */
export function toMedicationInsert(
  medication: Omit<Medication, 'id' | 'createdAt'>,
  options: { recipientProfileId: string; createdByProfileId: string },
): MedicationInsertPayload {
  const source: PatientMedicationRow['source_type'] =
    medication.createdVia === 'scan' ? 'ocr' : medication.createdVia === 'seed' ? 'seed' : 'manual';
  const doseUnit = medication.form === 'capsule' ? 'capsule' : medication.form;
  const foodRule = FOOD_RULE_TO_DB[medication.foodRule];

  return {
    medication: {
      name: medication.name,
      form: FORM_TO_DB[medication.form],
      strength: medication.strength || null,
      dose_unit: doseUnit,
      purpose: medication.purpose || null,
      color_key: medication.color,
      source_type: source,
      created_by_profile_id: options.createdByProfileId,
    },
    patientMedication: {
      recipient_profile_id: options.recipientProfileId,
      display_name: [medication.name, medication.strength].filter(Boolean).join(' '),
      instructions: medication.instruction,
      prescribed_dose: `${medication.unitsPerIntake} ${doseUnit}`,
      dose_amount: medication.unitsPerIntake,
      dose_unit: doseUnit,
      frequency_label: medication.frequencyLabel,
      food_rule: foodRule,
      prescriber_name: medication.prescriber,
      total_quantity: medication.packSize,
      remaining_quantity: medication.remainingUnits,
      source_type: source,
      created_by_profile_id: options.createdByProfileId,
    },
    schedules: medication.times.map((time) => ({
      time_of_day: `${time}:00`,
      dose_amount: medication.unitsPerIntake,
      dose_unit: doseUnit,
      food_rule: foodRule,
    })),
  };
}

export type NoteInsert = {
  recipient_profile_id: string;
  author_profile_id: string;
  note_type: DbNoteType;
  title: string;
  content: string;
};

export type CareTaskInsert = {
  recipient_profile_id: string;
  created_by_profile_id: string;
  task_type: CareTaskRow['task_type'];
  title: string;
  detail: string;
  due_at: string;
  location: string | null;
  patient_medication_id: string | null;
};

export function toNoteInsert(
  note: Pick<Note, 'category' | 'title' | 'body'>,
  options: { recipientProfileId: string; authorProfileId: string },
): NoteInsert {
  return {
    recipient_profile_id: options.recipientProfileId,
    author_profile_id: options.authorProfileId,
    note_type: NOTE_TYPE_TO_DB[note.category],
    title: note.title,
    content: note.body,
  };
}

export function toCareTaskInsert(
  task: Pick<CareTask, 'kind' | 'title' | 'detail' | 'dueAt' | 'location' | 'medicationId'>,
  options: { recipientProfileId: string; createdByProfileId: string },
): CareTaskInsert {
  return {
    recipient_profile_id: options.recipientProfileId,
    created_by_profile_id: options.createdByProfileId,
    task_type: TASK_KIND_TO_DB[task.kind],
    title: task.title,
    detail: task.detail,
    due_at: task.dueAt,
    location: task.location ?? null,
    patient_medication_id: task.medicationId ?? null,
  };
}
