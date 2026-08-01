import type { PillColorKey } from '@/lib/theme';

/** Who is using the app right now. */
export type Role = 'caregiver' | 'senior';

/** Coarse day buckets used by the senior summary and adherence patterns. */
export type DayPart = 'morning' | 'afternoon' | 'evening';

export type PillForm = 'tablet' | 'capsule' | 'drops' | 'sachet';

export type Person = {
  id: string;
  name: string;
  role: Role;
  relationship: string;
  phone: string;
  avatarInitials: string;
  city: string;
};

export type Medication = {
  id: string;
  name: string;
  strength: string;
  purpose: string;
  form: PillForm;
  /** Units taken at each intake (pills, capsules, sachets). */
  unitsPerIntake: number;
  /** 24h clock times, e.g. ['08:00', '21:00']. */
  times: string[];
  frequencyLabel: string;
  instruction: string;
  foodRule: 'before-food' | 'with-food' | 'after-food' | 'any-time';
  packSize: number;
  remainingUnits: number;
  prescriber: string;
  color: PillColorKey;
  createdVia: 'manual' | 'scan' | 'seed';
  createdAt: string;
};

export type DoseOutcome = 'pending' | 'taken' | 'missed' | 'skipped';

/** Live status shown in the UI; derived from outcome + current time. */
export type DoseStatus = 'upcoming' | 'due' | 'late' | 'taken' | 'missed' | 'skipped';

export type Dose = {
  id: string;
  medicationId: string;
  /** ISO timestamp of the scheduled intake. */
  scheduledFor: string;
  units: number;
  outcome: DoseOutcome;
  /** Exact ISO timestamp saved when the dose was confirmed. */
  takenAt: string | null;
  confirmedBy: Role | null;
  snoozedUntil: string | null;
};

export type CareTaskKind = 'refill' | 'appointment' | 'renewal' | 'pickup';

export type CareTask = {
  id: string;
  kind: CareTaskKind;
  title: string;
  detail: string;
  dueAt: string;
  location?: string;
  medicationId?: string;
  done: boolean;
};

export type NoteCategory = 'symptom' | 'side-effect' | 'care' | 'follow-up';

export type Note = {
  id: string;
  category: NoteCategory;
  title: string;
  body: string;
  createdAt: string;
  author: string;
};

export type ReminderChannel = 'push' | 'sms' | 'call' | 'manual';

export type ReminderStatus = 'scheduled' | 'sent' | 'delivered' | 'answered' | 'no-answer';

/** One entry of the reminder / escalation ladder for a specific dose. */
export type ReminderEvent = {
  id: string;
  doseId: string;
  medicationId: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  at: string;
  detail: string;
  /** Provider that would handle this in production. */
  provider: 'expo-notifications' | 'sms-provider' | 'elevenlabs' | 'in-app';
};

export type AlertKind = 'missed-dose' | 'late-dose' | 'consecutive-misses' | 'low-stock';

export type AlertSeverity = 'info' | 'attention' | 'urgent';

export type CareAlert = {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  message: string;
  createdAt: string;
  medicationId?: string;
  doseId?: string;
  acknowledged: boolean;
};

/** Structured output of the (mocked) prescription OCR pipeline. */
export type ScanExtractedMedicine = {
  name: string;
  strength: string;
  purpose: string;
  form: PillForm;
  unitsPerIntake: number;
  times: string[];
  frequencyLabel: string;
  packSize: number;
  instruction: string;
  foodRule: Medication['foodRule'];
  prescriber: string;
  color: PillColorKey;
  confidence: number;
  predictedRunoutISO: string;
};

export type ScanResult = {
  id: string;
  sourceLabel: string;
  scannedAt: string;
  documentType: 'prescription' | 'medicine-sheet' | 'discharge-note';
  medicines: ScanExtractedMedicine[];
};

export type InventoryProjection = {
  medicationId: string;
  dailyUnits: number;
  remainingUnits: number;
  packSize: number;
  daysLeft: number;
  runoutISO: string;
  risk: 'ok' | 'soon' | 'critical';
};

export type AdherenceStats = {
  windowDays: number;
  total: number;
  taken: number;
  missed: number;
  score: number;
};

export type DayAdherence = {
  dateISO: string;
  label: string;
  total: number;
  taken: number;
  score: number;
};

export type DayPartMisses = {
  part: DayPart;
  missed: number;
  total: number;
};
