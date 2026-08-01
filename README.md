# Medimo

Medimo helps an adult child remotely manage an elderly parent's medications.

In this demo, **Lorenzo** is the caregiver son and **Massimo** is his father. Lorenzo sets up the
medicines, watches whether doses were taken, tracks stock and refills, and gets alerted when a dose
is late. Massimo gets an extremely simple screen that shows only what he has to take right now.

Built with Expo (React Native), Expo Router, HeroUI Native, Uniwind and Zustand.

## Two experiences, one app

| Role                | Entry point       | What it shows                                                                                                                  |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Lorenzo (caregiver) | `app/(caregiver)` | Overview card, today's dose timeline, alerts and escalation, inventory and refill risk, adherence charts, care calendar, notes |
| Massimo (senior)    | `app/(senior)`    | One current medicine, one big **Taken** button, next medicine, a light today summary, and help                                 |

The role switcher lives on the welcome screen (`app/index.tsx`) and can be reopened at any time from
either experience, so both sides can be demoed in seconds.

## Product flows included

- Manual medicine setup (`app/medicine/add.tsx`) with an automatic schedule
- Simulated prescription scan: capture → processing stages → structured review → confirmation
  (`app/scan/index.tsx`, `app/scan/review.tsx`)
- Dose states: `upcoming`, `due`, `late`, `taken`, `missed`, `skipped`
- Double confirmation before a dose is finalised, with the exact timestamp and an easy undo
  (`app/confirm/[doseId].tsx`)
- Reminder ladder: phone reminder → SMS after 10 minutes → voice call 30 minutes later
  (`app/escalation/[doseId].tsx`)
- Inventory with remaining units, predicted runout date and refill risk (`app/inventory.tsx`)
- Care calendar for refills, pharmacy pickups, appointments and prescription renewals
- Notes and symptoms log

## Project structure

```
app/
  index.tsx                 welcome + role switch
  (caregiver)/              Lorenzo tabs: today, medicines, alerts, care plan, notes
  (senior)/                 Massimo tabs: today, medicines, help
  medicine/                 add + detail
  scan/                     mocked OCR flow
  confirm/[doseId].tsx      double confirmation (both roles)
  escalation/[doseId].tsx   reminder ladder
  inventory.tsx             stock + refills
  notes/new.tsx, tasks/new.tsx
components/                 shared UI (pill graphics, status pills, charts, cards)
  caregiver/                caregiver-only building blocks
  senior/                   senior-only building blocks
hooks/                      useNow (live dose statuses), useFlash (confirmations)
lib/
  types.ts                  domain model
  schedule.ts               schedule engine: statuses, adherence, inventory projection
  seed.ts                   seeded demo story (6 medicines, 30 days of history)
  store.ts                  Zustand store and all actions
  theme.ts                  palette as hex for native props
  services/
    bilt.ts                 Postgres/Supabase client (lazy, typed)
    db/                     schema types, row <-> app mappers, product queries
    sms.ts, voice.ts, ocr.ts, reminders.ts, backend.ts
global.css                  theme tokens for HeroUI Native + Uniwind
```

## Backend data model (Postgres / Supabase)

The hosted schema is normalised around the real product logic. Definitions are separate from
prescriptions, recurrence rules are separate from concrete dose instances, and dose instances are
separate from the confirmation history.

| Group          | Tables                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| Identity       | `profiles` (role `caregiver` \| `recipient`), `caregiver_relationships`      |
| Medication     | `medications` (catalog) → `patient_medications` (what Massimo takes)         |
| Scheduling     | `dose_schedules` (rules) → `scheduled_doses` (instances)                     |
| Truth          | `dose_logs` (append-only: who confirmed, exact `confirmed_at`, method)       |
| Reminders      | `reminder_events` (push → SMS → voice call, delivery status, provider id)    |
| Stock          | `medication_inventory` (snapshot) + `inventory_transactions` (ledger)        |
| Care plan      | `appointments`, `care_tasks`                                                |
| Care log       | `notes`, `care_alerts`                                                      |
| Scan onboarding| `documents` (private storage) → `ocr_extractions` (structured, reviewable)   |
| Traceability   | `audit_logs` (append-only)                                                  |

Relationships: a caregiver can be linked to many recipients and a recipient to many caregivers; a
recipient has many prescriptions; a prescription has many schedule rules; a rule generates many dose
instances; a dose instance has many reminder events and many log entries.

**Views** `v_dose_timeline` (dose + medicine + live status), `v_inventory_status` (days left,
projected runout, refill risk), `v_adherence_daily`, `v_care_agenda`, `v_medication_daily_usage`.

**Functions** `confirm_dose` (writes the timestamp, the log row, the stock movement and resolves
reminders in one call), `undo_dose_confirmation`, `snooze_dose`, `generate_scheduled_doses`
(expands rules into instances, idempotent), `adherence_stats`, `misses_by_day_part`,
`refresh_runout_projection`, `derive_dose_status`, `ensure_profile`, `claim_demo_profile`.

**Row Level Security** is on for every table. Policies call `SECURITY DEFINER` helpers
(`is_profile_owner`, `is_linked_caregiver`, `can_view_recipient`, `can_edit_recipient`,
`can_view_documents_of`, …) so a recipient only reaches their own data, a caregiver only reaches
linked recipients, editing medications / schedules / notes / tasks requires a link with `can_edit`,
`dose_logs`, `inventory_transactions` and `audit_logs` have no update or delete policy, and
prescription files live in the private `medimo-documents` bucket under
`<recipient_profile_id>/<file>`.

**Indexes** cover the dashboard paths: `recipient_profile_id`, `scheduled_for`,
`scheduled_local_date`, dose `status` (partial index on open doses), `due_at` for tasks, runout dates,
relationship keys and unresolved reminders.

Timestamps: every table carries `created_at`; mutable tables also carry `updated_at`, maintained by
`moddatetime` triggers.

## Data access layer

`lib/services/db` is the only place that talks to the database:

| File         | Responsibility                                                                        |
| ------------ | ------------------------------------------------------------------------------------- |
| `schema.ts`  | Enums, row types and the `MedimoDatabase` type passed to the client                    |
| `mappers.ts` | Row ↔ app type translation (`lib/types.ts`), including insert payload builders         |
| `queries.ts` | Product-shaped calls: today's timeline, current/next dose, `confirmDose`, adherence, inventory, agenda, notes, scan upload, refills, audit |

`lib/services/backend.ts` keeps the `MedimoBackend` gateway: `createLocalBackend` (seeded demo,
current default) and `createBiltBackend` (hosted Postgres, including realtime on `scheduled_doses`).
`selectBackend` returns the hosted one once a signed-in profile and a linked recipient are known.

The demo still runs on the seeded Zustand store, so the app works with or without a session. To go
live: sign in, call `ensureProfile` (or `claimDemoProfile` for the seeded Lorenzo / Massimo rows),
then feed the resulting profile ids into `selectBackend`.

## Integration boundaries

Everything external is behind a small interface with a mock implementation, so production wiring is a
swap rather than a rewrite:

| Concern                  | File                        | Production swap                                                                                |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------- |
| SMS reminders            | `lib/services/sms.ts`       | Set `EXPO_PUBLIC_SMS_ENDPOINT` to a backend route that calls Twilio / Vonage                   |
| Outbound voice calls     | `lib/services/voice.ts`     | Set `EXPO_PUBLIC_VOICE_ENDPOINT` and `EXPO_PUBLIC_ELEVENLABS_AGENT_ID` for an ElevenLabs agent |
| Prescription OCR         | `lib/services/ocr.ts`       | Set `EXPO_PUBLIC_OCR_ENDPOINT` for Document AI / Textract / a vision model                     |
| Database, auth, realtime | `lib/services/backend.ts` + `lib/services/db` | Live Postgres schema; `createBiltBackend` implements `MedimoBackend`         |
| Device reminders         | `lib/services/reminders.ts` | `expo-notifications` triggers, bundled sound, haptics, spoken reminder                         |

Provider credentials belong on the server: the app calls your backend, the backend calls the provider.

## Demo data

`lib/seed.ts` seeds six medicines with different rhythms (morning, after lunch, evening, twice
daily, one nearly out of stock, one with a recent missed-dose alert), 30 days of adherence history,
an upcoming cardiology appointment, a pharmacy pickup, a prescription renewal and a few care notes.
Some of today's doses are re-timed relative to the current clock so the demo always has a dose that
is due now, one that is late and already escalated, and one still ahead.

Use **Reset demo data** on the welcome screen to start over.

The same story is seeded in the hosted database: Lorenzo and Massimo profiles with their
son → father relationship, six prescriptions with schedules and stock, 30 days of dose instances with
confirmation logs and the reminder ladder, open alerts, a cardiology appointment, a blood test,
refill / renewal tasks, care notes and one scanned prescription with its OCR extraction.

## Running it

```bash
npm install
npx expo start
```

Design language: deep Incremental Blue `#113253` and Indigo Cloth `#214D72` for structure, Cadet Grey
`#93A3AE` for support surfaces, 24 Karat `#DFC684` and Golden Mean `#C59E3A` for gentle warnings —
warm, calm and deliberately not clinical.
