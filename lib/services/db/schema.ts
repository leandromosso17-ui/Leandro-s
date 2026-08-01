/**
 * Row and enum types for the Medimo Postgres schema.
 *
 * Kept hand-written (instead of generated) so the shape is readable and stays
 * next to the mappers. Every name matches the database exactly, so a generated
 * type file can replace this later without touching the query layer.
 *
 * Tables
 *   profiles                 one row per person, optionally linked to an auth user
 *   caregiver_relationships  caregiver <-> recipient links with permissions
 *   medications              reusable medication catalog
 *   patient_medications      what a recipient is actually taking
 *   dose_schedules           recurrence rules per prescription
 *   scheduled_doses          concrete dose instances
 *   dose_logs                append-only history of confirmations/corrections
 *   reminder_events          reminder + escalation ladder
 *   medication_inventory     current stock snapshot
 *   inventory_transactions   append-only stock ledger
 *   appointments             doctor visits, lab tests, pickups
 *   care_tasks               refills, renewals, follow-ups
 *   notes                    symptoms, side effects, care notes
 *   care_alerts              derived caregiver alerts
 *   documents                uploaded prescription scans
 *   ocr_extractions          structured OCR output awaiting review
 *   audit_logs               append-only action trail
 *
 * Views      v_dose_timeline, v_inventory_status, v_adherence_daily,
 *            v_care_agenda, v_medication_daily_usage
 * Functions  confirm_dose, undo_dose_confirmation, snooze_dose,
 *            generate_scheduled_doses, adherence_stats, misses_by_day_part,
 *            refresh_runout_projection, ensure_profile, claim_demo_profile
 */

export type UserRole = 'caregiver' | 'recipient';
export type RelationshipStatus = 'pending' | 'active' | 'revoked';
export type MedicationForm =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'drops'
  | 'sachet'
  | 'injection'
  | 'inhaler'
  | 'cream'
  | 'patch'
  | 'other';
export type MedicationSource = 'manual' | 'ocr' | 'imported' | 'seed';
export type PatientMedicationStatus = 'active' | 'paused' | 'completed' | 'discontinued';
export type ScheduleType = 'daily' | 'specific_days' | 'interval_days' | 'as_needed';
export type DbFoodRule = 'before_food' | 'with_food' | 'after_food' | 'any_time';
export type DbDayPart = 'morning' | 'afternoon' | 'evening' | 'night';
export type DbDoseStatus = 'scheduled' | 'due' | 'taken' | 'late' | 'missed' | 'skipped';
export type DoseLogAction =
  | 'confirmed_taken'
  | 'marked_missed'
  | 'marked_skipped'
  | 'snoozed'
  | 'corrected'
  | 'undone';
export type ConfirmationMethod =
  | 'app_tap'
  | 'caregiver_manual'
  | 'sms_reply'
  | 'voice_call'
  | 'auto';
export type ReminderEventType =
  | 'pre_reminder'
  | 'due_reminder'
  | 'late_reminder'
  | 'escalation_sms'
  | 'escalation_call'
  | 'caregiver_nudge';
export type DbReminderChannel = 'push' | 'sms' | 'voice_call' | 'in_app';
export type DeliveryStatus =
  | 'scheduled'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'answered'
  | 'no_answer'
  | 'resolved';
export type InventoryTransactionType =
  | 'initial_stock'
  | 'refill'
  | 'dose_taken'
  | 'dose_reverted'
  | 'adjustment'
  | 'loss';
export type AppointmentType =
  | 'doctor_visit'
  | 'specialist'
  | 'pharmacy_pickup'
  | 'lab_test'
  | 'other';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'missed';
export type CareTaskType =
  | 'refill'
  | 'pharmacy_pickup'
  | 'prescription_renewal'
  | 'appointment_prep'
  | 'follow_up'
  | 'other';
export type CareTaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type DbNoteType = 'symptom' | 'side_effect' | 'care' | 'follow_up';
export type NoteSeverity = 'mild' | 'moderate' | 'severe';
export type DbDocumentType =
  | 'prescription'
  | 'medicine_sheet'
  | 'discharge_note'
  | 'pill_photo'
  | 'other';
export type OcrReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'applied';
export type DbAlertKind =
  | 'missed_dose'
  | 'late_dose'
  | 'consecutive_misses'
  | 'low_stock'
  | 'refill_due'
  | 'appointment_soon';
export type DbAlertSeverity = 'info' | 'attention' | 'urgent';

/** Postgres `numeric` arrives as a string over the wire in some drivers. */
export type Numeric = number | string;

export type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  avatar_initials: string | null;
  timezone: string;
  preferred_language: string;
  city: string | null;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
};

export type CaregiverRelationshipRow = {
  id: string;
  caregiver_profile_id: string;
  recipient_profile_id: string;
  relationship_label: string;
  status: RelationshipStatus;
  is_primary_caregiver: boolean;
  can_edit: boolean;
  can_message: boolean;
  can_view_documents: boolean;
  created_at: string;
  updated_at: string;
};

export type MedicationRow = {
  id: string;
  name: string;
  form: MedicationForm;
  strength: string | null;
  strength_value: Numeric | null;
  strength_unit: string | null;
  dose_unit: string;
  purpose: string | null;
  image_url: string | null;
  color_key: string | null;
  source_type: MedicationSource;
  is_catalog: boolean;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PatientMedicationRow = {
  id: string;
  recipient_profile_id: string;
  medication_id: string;
  display_name: string;
  instructions: string | null;
  prescribed_dose: string | null;
  dose_amount: Numeric;
  dose_unit: string;
  frequency_label: string | null;
  food_rule: DbFoodRule;
  start_date: string;
  end_date: string | null;
  status: PatientMedicationStatus;
  prescriber_name: string | null;
  pharmacy_name: string | null;
  total_quantity: Numeric | null;
  remaining_quantity: Numeric | null;
  low_stock_threshold: Numeric;
  predicted_runout_date: string | null;
  refill_lead_days: number;
  late_after_minutes: number;
  missed_after_minutes: number;
  source_type: MedicationSource;
  source_document_id: string | null;
  source_extraction_id: string | null;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DoseScheduleRow = {
  id: string;
  patient_medication_id: string;
  schedule_type: ScheduleType;
  dose_amount: Numeric;
  dose_unit: string;
  time_of_day: string;
  days_of_week: number[] | null;
  interval_days: number | null;
  start_date: string;
  end_date: string | null;
  food_rule: DbFoodRule;
  is_prn: boolean;
  timezone: string;
  is_active: boolean;
  label: string | null;
  day_part: DbDayPart;
  created_at: string;
  updated_at: string;
};

export type ScheduledDoseRow = {
  id: string;
  patient_medication_id: string;
  dose_schedule_id: string | null;
  recipient_profile_id: string;
  scheduled_for: string;
  scheduled_local_date: string;
  day_part: DbDayPart;
  dose_amount: Numeric;
  dose_unit: string;
  status: DbDoseStatus;
  taken_at: string | null;
  snoozed_until: string | null;
  confirmed_by_profile_id: string | null;
  confirmation_method: ConfirmationMethod | null;
  is_prn: boolean;
  created_at: string;
  updated_at: string;
};

export type DoseLogRow = {
  id: string;
  scheduled_dose_id: string | null;
  patient_medication_id: string;
  recipient_profile_id: string;
  confirmed_by_profile_id: string | null;
  action: DoseLogAction;
  confirmed_at: string;
  dose_amount: Numeric | null;
  method: ConfirmationMethod;
  previous_status: DbDoseStatus | null;
  new_status: DbDoseStatus | null;
  note: string | null;
  created_at: string;
};

export type ReminderEventRow = {
  id: string;
  scheduled_dose_id: string | null;
  recipient_profile_id: string;
  target_profile_id: string | null;
  event_type: ReminderEventType;
  channel: DbReminderChannel;
  provider: string | null;
  provider_message_id: string | null;
  attempt: number;
  scheduled_for: string | null;
  sent_at: string | null;
  delivery_status: DeliveryStatus;
  detail: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MedicationInventoryRow = {
  id: string;
  patient_medication_id: string;
  initial_quantity: Numeric;
  remaining_quantity: Numeric;
  unit: string;
  pack_size: Numeric | null;
  low_stock_threshold: Numeric;
  predicted_runout_date: string | null;
  daily_usage: Numeric | null;
  last_refill_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryTransactionRow = {
  id: string;
  patient_medication_id: string;
  transaction_type: InventoryTransactionType;
  quantity_delta: Numeric;
  balance_after: Numeric | null;
  unit: string;
  reason: string | null;
  scheduled_dose_id: string | null;
  created_by_profile_id: string | null;
  created_at: string;
};

export type AppointmentRow = {
  id: string;
  recipient_profile_id: string;
  created_by_profile_id: string | null;
  title: string;
  appointment_type: AppointmentType;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  practitioner_name: string | null;
  notes: string | null;
  status: AppointmentStatus;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CareTaskRow = {
  id: string;
  recipient_profile_id: string;
  created_by_profile_id: string | null;
  task_type: CareTaskType;
  title: string;
  detail: string | null;
  due_at: string;
  status: CareTaskStatus;
  patient_medication_id: string | null;
  appointment_id: string | null;
  location: string | null;
  completed_at: string | null;
  completed_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteRow = {
  id: string;
  recipient_profile_id: string;
  author_profile_id: string | null;
  note_type: DbNoteType;
  title: string | null;
  content: string;
  severity: NoteSeverity | null;
  patient_medication_id: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type CareAlertRow = {
  id: string;
  recipient_profile_id: string;
  kind: DbAlertKind;
  severity: DbAlertSeverity;
  title: string;
  message: string | null;
  patient_medication_id: string | null;
  scheduled_dose_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  recipient_profile_id: string;
  uploaded_by_profile_id: string | null;
  document_type: DbDocumentType;
  storage_bucket: string;
  storage_path: string | null;
  file_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  source_label: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
};

/** Shape stored in `ocr_extractions.structured` by the scan review flow. */
export type OcrStructuredMedicine = {
  name: string;
  strength?: string;
  form?: MedicationForm;
  dose_amount?: number;
  times?: string[];
  frequency_label?: string;
  pack_size?: number;
  instruction?: string;
  food_rule?: DbFoodRule;
  prescriber?: string;
  color_key?: string;
  confidence?: number;
};

export type OcrStructured = {
  medicines: OcrStructuredMedicine[];
  document_type?: DbDocumentType;
};

export type OcrExtractionRow = {
  id: string;
  document_id: string;
  provider: string;
  raw_text: string | null;
  structured: OcrStructured;
  confidence: Numeric | null;
  review_status: OcrReviewStatus;
  reviewed_by_profile_id: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_profile_id: string | null;
  recipient_profile_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

/** v_dose_timeline */
export type DoseTimelineRow = {
  scheduled_dose_id: string;
  recipient_profile_id: string;
  patient_medication_id: string;
  dose_schedule_id: string | null;
  display_name: string;
  medication_name: string;
  form: MedicationForm;
  strength: string | null;
  color_key: string | null;
  image_url: string | null;
  instructions: string | null;
  food_rule: DbFoodRule;
  scheduled_for: string;
  scheduled_local_date: string;
  day_part: DbDayPart;
  dose_amount: Numeric;
  dose_unit: string;
  stored_status: DbDoseStatus;
  live_status: DbDoseStatus;
  taken_at: string | null;
  snoozed_until: string | null;
  confirmed_by_profile_id: string | null;
  confirmation_method: ConfirmationMethod | null;
  is_prn: boolean;
};

/** v_inventory_status */
export type InventoryStatusRow = {
  patient_medication_id: string;
  recipient_profile_id: string;
  display_name: string;
  medication_name: string;
  color_key: string | null;
  inventory_id: string | null;
  initial_quantity: Numeric | null;
  remaining_quantity: Numeric | null;
  unit: string | null;
  pack_size: Numeric | null;
  low_stock_threshold: Numeric | null;
  daily_units: Numeric;
  days_left: number | null;
  projected_runout_date: string | null;
  refill_risk: 'ok' | 'soon' | 'critical';
  refill_lead_days: number;
  medication_status: PatientMedicationStatus;
};

/** v_adherence_daily */
export type AdherenceDailyRow = {
  recipient_profile_id: string;
  scheduled_local_date: string;
  total_doses: number;
  taken_doses: number;
  missed_doses: number;
  adherence_score: number;
};

/** v_care_agenda */
export type CareAgendaRow = {
  source: 'appointment' | 'care_task';
  id: string;
  recipient_profile_id: string;
  title: string;
  kind: string;
  due_at: string;
  location: string | null;
  detail: string | null;
  status: string;
  patient_medication_id: string | null;
};

/** adherence_stats() */
export type AdherenceStatsRow = {
  window_days: number;
  total_doses: number;
  taken_doses: number;
  missed_doses: number;
  adherence_score: number;
};

/** misses_by_day_part() */
export type MissesByDayPartRow = {
  part: DbDayPart;
  missed_doses: number;
  total_doses: number;
};

/* ------------------------------------------------------------------ */
/* typed client schema                                                 */
/* ------------------------------------------------------------------ */

/**
 * Insert/Update payloads are modelled as partial rows: the database keeps the
 * real NOT NULL and CHECK constraints, and this keeps the type file readable
 * while still catching misspelled column names.
 */
type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type ViewDef<Row> = {
  Row: Row;
  Relationships: [];
};

/** Schema passed to `createClient`, so queries and RPC calls are type-checked. */
export type MedimoDatabase = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>;
      caregiver_relationships: TableDef<CaregiverRelationshipRow>;
      medications: TableDef<MedicationRow>;
      patient_medications: TableDef<PatientMedicationRow>;
      dose_schedules: TableDef<DoseScheduleRow>;
      scheduled_doses: TableDef<ScheduledDoseRow>;
      dose_logs: TableDef<DoseLogRow>;
      reminder_events: TableDef<ReminderEventRow>;
      medication_inventory: TableDef<MedicationInventoryRow>;
      inventory_transactions: TableDef<InventoryTransactionRow>;
      appointments: TableDef<AppointmentRow>;
      care_tasks: TableDef<CareTaskRow>;
      notes: TableDef<NoteRow>;
      care_alerts: TableDef<CareAlertRow>;
      documents: TableDef<DocumentRow>;
      ocr_extractions: TableDef<OcrExtractionRow>;
      audit_logs: TableDef<AuditLogRow>;
    };
    Views: {
      v_dose_timeline: ViewDef<DoseTimelineRow>;
      v_inventory_status: ViewDef<InventoryStatusRow>;
      v_adherence_daily: ViewDef<AdherenceDailyRow>;
      v_care_agenda: ViewDef<CareAgendaRow>;
    };
    Functions: {
      ensure_profile: {
        Args: {
          p_full_name: string;
          p_role: UserRole;
          p_phone: string | null;
          p_timezone: string;
          p_language: string;
        };
        Returns: ProfileRow[];
      };
      claim_demo_profile: {
        Args: { p_profile_id: string };
        Returns: ProfileRow[];
      };
      generate_scheduled_doses: {
        Args: { p_patient_medication_id: string; p_from: string; p_to: string };
        Returns: ScheduledDoseRow[];
      };
      refresh_runout_projection: {
        Args: { p_patient_medication_id: string };
        Returns: MedicationInventoryRow[];
      };
      confirm_dose: {
        Args: {
          p_scheduled_dose_id: string;
          p_confirmed_by_profile_id: string | null;
          p_method: ConfirmationMethod;
          p_note: string | null;
        };
        Returns: ScheduledDoseRow[];
      };
      undo_dose_confirmation: {
        Args: { p_scheduled_dose_id: string; p_actor_profile_id: string | null };
        Returns: ScheduledDoseRow[];
      };
      snooze_dose: {
        Args: {
          p_scheduled_dose_id: string;
          p_minutes: number;
          p_actor_profile_id: string | null;
        };
        Returns: ScheduledDoseRow[];
      };
      adherence_stats: {
        Args: { p_recipient_profile_id: string; p_days: number };
        Returns: AdherenceStatsRow[];
      };
      misses_by_day_part: {
        Args: { p_recipient_profile_id: string; p_days: number };
        Returns: MissesByDayPartRow[];
      };
    };
    Enums: {
      user_role: UserRole;
      relationship_status: RelationshipStatus;
      medication_form: MedicationForm;
      medication_source: MedicationSource;
      patient_medication_status: PatientMedicationStatus;
      schedule_type: ScheduleType;
      food_rule: DbFoodRule;
      day_part: DbDayPart;
      dose_status: DbDoseStatus;
      dose_log_action: DoseLogAction;
      confirmation_method: ConfirmationMethod;
      reminder_event_type: ReminderEventType;
      reminder_channel: DbReminderChannel;
      delivery_status: DeliveryStatus;
      inventory_transaction_type: InventoryTransactionType;
      appointment_type: AppointmentType;
      appointment_status: AppointmentStatus;
      care_task_type: CareTaskType;
      care_task_status: CareTaskStatus;
      note_type: DbNoteType;
      note_severity: NoteSeverity;
      document_type: DbDocumentType;
      ocr_review_status: OcrReviewStatus;
      alert_kind: DbAlertKind;
      alert_severity: DbAlertSeverity;
    };
    CompositeTypes: Record<string, never>;
  };
};
