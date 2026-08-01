import { addDays, addMinutes, parseISO, startOfDay, subDays } from 'date-fns';

import { buildDoses, DOSE_WINDOW, doseId, ESCALATION } from '@/lib/schedule';
import { atClock, dayKey, dayPartOfISO, isoDayKey, minutesBetween } from '@/lib/time';
import type {
  CareAlert,
  CareTask,
  Dose,
  Medication,
  Note,
  Person,
  ReminderEvent,
} from '@/lib/types';

export const HISTORY_DAYS = 30;

export const caregiver: Person = {
  id: 'person-lorenzo',
  name: 'Lorenzo',
  role: 'caregiver',
  relationship: 'Son · remote caregiver',
  phone: '+39 340 118 4402',
  avatarInitials: 'L',
  city: 'Milano',
};

export const senior: Person = {
  id: 'person-massimo',
  name: 'Massimo',
  role: 'senior',
  relationship: 'Father · 78',
  phone: '+39 051 220 9134',
  avatarInitials: 'M',
  city: 'Bologna',
};

/** Medicine ids referenced by the seeded demo story. */
export const DEMO_IDS = {
  bloodPressure: 'med-cardiotens',
  afterLunch: 'med-metaform',
  evening: 'med-somnovel',
  twiceDaily: 'med-ventolix',
  lowStock: 'med-ossifort',
  missedAlert: 'med-sertalor',
} as const;

function medicationSeed(now: Date): Medication[] {
  const created = subDays(startOfDay(now), 40).toISOString();

  return [
    {
      id: DEMO_IDS.bloodPressure,
      name: 'Cardiotens',
      strength: '5 mg',
      purpose: 'Blood pressure',
      form: 'tablet',
      unitsPerIntake: 1,
      times: ['08:00'],
      frequencyLabel: 'Once daily, morning',
      instruction: 'Take 1 tablet with a full glass of water',
      foodRule: 'before-food',
      packSize: 60,
      remainingUnits: 41,
      prescriber: 'Dr. Elena Bruni',
      color: 'blue',
      createdVia: 'seed',
      createdAt: created,
    },
    {
      id: DEMO_IDS.afterLunch,
      name: 'Metaform',
      strength: '850 mg',
      purpose: 'Blood sugar',
      form: 'tablet',
      unitsPerIntake: 1,
      times: ['14:00'],
      frequencyLabel: 'Once daily, after lunch',
      instruction: 'Take 1 tablet after lunch',
      foodRule: 'after-food',
      packSize: 56,
      remainingUnits: 23,
      prescriber: 'Dr. Elena Bruni',
      color: 'cream',
      createdVia: 'seed',
      createdAt: created,
    },
    {
      id: DEMO_IDS.evening,
      name: 'Somnovel',
      strength: '3 mg',
      purpose: 'Restful sleep',
      form: 'capsule',
      unitsPerIntake: 1,
      times: ['21:30'],
      frequencyLabel: 'Once daily, evening',
      instruction: 'Take 1 capsule before bed',
      foodRule: 'any-time',
      packSize: 30,
      remainingUnits: 17,
      prescriber: 'Dr. Marco Fanti',
      color: 'slate',
      createdVia: 'seed',
      createdAt: created,
    },
    {
      id: DEMO_IDS.twiceDaily,
      name: 'Ventolix',
      strength: '20 mg',
      purpose: 'Heart rhythm',
      form: 'tablet',
      unitsPerIntake: 1,
      times: ['09:00', '21:00'],
      frequencyLabel: 'Twice daily, morning and evening',
      instruction: 'Take 1 tablet, morning and evening',
      foodRule: 'with-food',
      packSize: 60,
      remainingUnits: 29,
      prescriber: 'Dr. Elena Bruni',
      color: 'gold',
      createdVia: 'seed',
      createdAt: created,
    },
    {
      id: DEMO_IDS.lowStock,
      name: 'Ossifort D3',
      strength: '1000 UI',
      purpose: 'Bone strength',
      form: 'capsule',
      unitsPerIntake: 1,
      times: ['12:30'],
      frequencyLabel: 'Once daily, lunchtime',
      instruction: 'Take 1 capsule with lunch',
      foodRule: 'with-food',
      packSize: 30,
      remainingUnits: 3,
      prescriber: 'Dr. Marco Fanti',
      color: 'sage',
      createdVia: 'seed',
      createdAt: created,
    },
    {
      id: DEMO_IDS.missedAlert,
      name: 'Sertalor',
      strength: '50 mg',
      purpose: 'Mood support',
      form: 'tablet',
      unitsPerIntake: 1,
      times: ['19:00'],
      frequencyLabel: 'Once daily, early evening',
      instruction: 'Take 1 tablet in the early evening',
      foodRule: 'any-time',
      packSize: 28,
      remainingUnits: 14,
      prescriber: 'Dr. Marco Fanti',
      color: 'clay',
      createdVia: 'seed',
      createdAt: created,
    },
  ];
}

/** Deterministic 0..1 generator so the demo history is stable across reloads. */
function pseudoRandom(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  const value = (hash >>> 0) / 4_294_967_295;
  return value;
}

const MISS_RATE: Record<string, number> = {
  morning: 0.04,
  afternoon: 0.09,
  evening: 0.16,
};

function withHistory(dose: Dose, now: Date): Dose {
  const scheduled = parseISO(dose.scheduledFor);
  const elapsed = minutesBetween(scheduled, now);
  if (elapsed <= DOSE_WINDOW.missedAfter) return dose;

  const part = dayPartOfISO(dose.scheduledFor);
  const roll = pseudoRandom(dose.id);
  const missed = roll < (MISS_RATE[part] ?? 0.08);

  if (missed) {
    return { ...dose, outcome: 'missed' };
  }

  const jitter = Math.round(pseudoRandom(`${dose.id}-jitter`) * 22) - 4;
  return {
    ...dose,
    outcome: 'taken',
    takenAt: addMinutes(scheduled, Math.max(-8, jitter)).toISOString(),
    confirmedBy: 'senior',
  };
}

/** Re-time a dose so the live demo always has a due / late / upcoming example. */
function retime(dose: Dose, scheduled: Date): Dose {
  return {
    ...dose,
    id: doseId(dose.medicationId, scheduled),
    scheduledFor: scheduled.toISOString(),
    outcome: 'pending',
    takenAt: null,
    confirmedBy: null,
    snoozedUntil: null,
  };
}

export type SeededDemo = {
  medications: Medication[];
  doses: Dose[];
  tasks: CareTask[];
  notes: Note[];
  alerts: CareAlert[];
  reminders: ReminderEvent[];
  /** Ids of the doses the demo story hangs on. */
  demoDoseIds: { due: string; late: string; upcoming: string };
};

export function seedDemo(now: Date = new Date()): SeededDemo {
  const medications = medicationSeed(now);
  const from = subDays(startOfDay(now), HISTORY_DAYS - 1);
  const to = addDays(startOfDay(now), 1);

  let doses = medications
    .flatMap((medication) => buildDoses(medication, from, to))
    .map((dose) => withHistory(dose, now));

  const todayKey = dayKey(now);
  const isToday = (dose: Dose) => isoDayKey(dose.scheduledFor) === todayKey;

  // Dose that is due right now (Ventolix, twice daily).
  const dueTarget = addMinutes(now, -4);
  const dueSource = doses.find(
    (dose) => isToday(dose) && dose.medicationId === DEMO_IDS.twiceDaily,
  );

  // Dose that is late and already escalated to SMS (Sertalor).
  const lateTarget = addMinutes(now, -(ESCALATION.smsAfterMinutes + 28));
  const lateSource = doses.find(
    (dose) => isToday(dose) && dose.medicationId === DEMO_IDS.missedAlert,
  );

  // Dose still ahead of Massimo today (Somnovel).
  const upcomingTarget = addMinutes(now, 75);
  const upcomingSource = doses.find(
    (dose) => isToday(dose) && dose.medicationId === DEMO_IDS.evening,
  );

  const dueDose = dueSource ? retime(dueSource, dueTarget) : doses[0];
  const lateDose = lateSource ? retime(lateSource, lateTarget) : doses[0];
  const upcomingDose = upcomingSource ? retime(upcomingSource, upcomingTarget) : doses[0];

  const rewrites = new Map<string, Dose>();
  if (dueSource) rewrites.set(dueSource.id, dueDose);
  if (lateSource) rewrites.set(lateSource.id, lateDose);
  if (upcomingSource) rewrites.set(upcomingSource.id, upcomingDose);

  doses = doses.map((dose) => rewrites.get(dose.id) ?? dose);

  // Yesterday's Sertalor evening dose is the missed dose behind the open alert.
  const yesterdayKey = dayKey(subDays(startOfDay(now), 1));
  const twoDaysAgoKey = dayKey(subDays(startOfDay(now), 2));
  doses = doses.map((dose) => {
    if (dose.medicationId !== DEMO_IDS.missedAlert) return dose;
    const key = isoDayKey(dose.scheduledFor);
    if (key !== yesterdayKey && key !== twoDaysAgoKey) {
      return dose;
    }
    return { ...dose, outcome: 'missed', takenAt: null, confirmedBy: null };
  });

  const yesterdayMissed = doses.find(
    (dose) =>
      dose.medicationId === DEMO_IDS.missedAlert && isoDayKey(dose.scheduledFor) === yesterdayKey,
  );

  const reminders: ReminderEvent[] = [];

  // Live escalation ladder for today's late Sertalor dose.
  reminders.push(
    {
      id: `rem-${lateDose.id}-push`,
      doseId: lateDose.id,
      medicationId: lateDose.medicationId,
      channel: 'push',
      status: 'delivered',
      at: lateDose.scheduledFor,
      detail: 'Reminder shown on Massimo’s phone',
      provider: 'expo-notifications',
    },
    {
      id: `rem-${lateDose.id}-sms`,
      doseId: lateDose.id,
      medicationId: lateDose.medicationId,
      channel: 'sms',
      status: 'delivered',
      at: addMinutes(parseISO(lateDose.scheduledFor), ESCALATION.smsAfterMinutes).toISOString(),
      detail: 'SMS sent to Massimo: “Time for Sertalor 50 mg. Reply DONE when taken.”',
      provider: 'sms-provider',
    },
    {
      id: `rem-${lateDose.id}-call`,
      doseId: lateDose.id,
      medicationId: lateDose.medicationId,
      channel: 'call',
      status: 'scheduled',
      at: addMinutes(
        parseISO(lateDose.scheduledFor),
        ESCALATION.smsAfterMinutes + ESCALATION.callAfterSmsMinutes,
      ).toISOString(),
      detail: 'Voice call queued — will run if the dose is still not confirmed',
      provider: 'elevenlabs',
    },
  );

  if (yesterdayMissed) {
    const base = parseISO(yesterdayMissed.scheduledFor);
    reminders.push(
      {
        id: `rem-${yesterdayMissed.id}-push`,
        doseId: yesterdayMissed.id,
        medicationId: yesterdayMissed.medicationId,
        channel: 'push',
        status: 'delivered',
        at: yesterdayMissed.scheduledFor,
        detail: 'Reminder shown on Massimo’s phone',
        provider: 'expo-notifications',
      },
      {
        id: `rem-${yesterdayMissed.id}-sms`,
        doseId: yesterdayMissed.id,
        medicationId: yesterdayMissed.medicationId,
        channel: 'sms',
        status: 'delivered',
        at: addMinutes(base, ESCALATION.smsAfterMinutes).toISOString(),
        detail: 'SMS reminder delivered',
        provider: 'sms-provider',
      },
      {
        id: `rem-${yesterdayMissed.id}-call`,
        doseId: yesterdayMissed.id,
        medicationId: yesterdayMissed.medicationId,
        channel: 'call',
        status: 'no-answer',
        at: addMinutes(
          base,
          ESCALATION.smsAfterMinutes + ESCALATION.callAfterSmsMinutes,
        ).toISOString(),
        detail: 'Voice call placed — no answer, Lorenzo notified',
        provider: 'elevenlabs',
      },
    );
  }

  const alerts: CareAlert[] = [
    {
      id: 'alert-late-sertalor',
      kind: 'late-dose',
      severity: 'urgent',
      title: 'Sertalor 50 mg is late',
      message: 'SMS reminder delivered. A voice call runs automatically if it stays unconfirmed.',
      createdAt: addMinutes(
        parseISO(lateDose.scheduledFor),
        ESCALATION.smsAfterMinutes,
      ).toISOString(),
      medicationId: DEMO_IDS.missedAlert,
      doseId: lateDose.id,
      acknowledged: false,
    },
    {
      id: 'alert-consecutive-sertalor',
      kind: 'consecutive-misses',
      severity: 'urgent',
      title: 'Sertalor missed 2 evenings in a row',
      message: 'Evening doses are the weak spot this week. A short call usually fixes it.',
      createdAt: subDays(now, 1).toISOString(),
      medicationId: DEMO_IDS.missedAlert,
      doseId: yesterdayMissed?.id,
      acknowledged: false,
    },
    {
      id: 'alert-low-stock-ossifort',
      kind: 'low-stock',
      severity: 'attention',
      title: 'Ossifort D3 is almost finished',
      message: '3 capsules left. Pick up the refill before the weekend.',
      createdAt: subDays(now, 1).toISOString(),
      medicationId: DEMO_IDS.lowStock,
      acknowledged: false,
    },
  ];

  if (yesterdayMissed) {
    alerts.push({
      id: 'alert-missed-yesterday',
      kind: 'missed-dose',
      severity: 'attention',
      title: 'Missed evening dose yesterday',
      message: 'Sertalor 50 mg was not confirmed yesterday evening.',
      createdAt: addMinutes(
        parseISO(yesterdayMissed.scheduledFor),
        DOSE_WINDOW.missedAfter,
      ).toISOString(),
      medicationId: DEMO_IDS.missedAlert,
      doseId: yesterdayMissed.id,
      acknowledged: true,
    });
  }

  const tasks: CareTask[] = [
    {
      id: 'task-pickup-ossifort',
      kind: 'pickup',
      title: 'Pick up Ossifort D3',
      detail: 'Refill is ready at the counter — ask for the 30 capsule pack.',
      dueAt: atClock(addDays(now, 1), '10:00').toISOString(),
      location: 'Farmacia San Martino, Bologna',
      medicationId: DEMO_IDS.lowStock,
      done: false,
    },
    {
      id: 'task-appointment-bruni',
      kind: 'appointment',
      title: 'Cardiology follow-up',
      detail: 'Bring the blood pressure log and the Ventolix box.',
      dueAt: atClock(addDays(now, 3), '11:30').toISOString(),
      location: 'Dr. Elena Bruni, Studio Medico Galvani',
      done: false,
    },
    {
      id: 'task-renewal-ventolix',
      kind: 'renewal',
      title: 'Renew Ventolix prescription',
      detail: 'Request the repeat prescription through the family doctor portal.',
      dueAt: atClock(addDays(now, 6), '09:00').toISOString(),
      medicationId: DEMO_IDS.twiceDaily,
      done: false,
    },
    {
      id: 'task-refill-metaform',
      kind: 'refill',
      title: 'Order Metaform refill',
      detail: 'Around 23 tablets left — order before the box runs low.',
      dueAt: atClock(addDays(now, 9), '18:00').toISOString(),
      medicationId: DEMO_IDS.afterLunch,
      done: false,
    },
    {
      id: 'task-refill-done',
      kind: 'refill',
      title: 'Cardiotens refill collected',
      detail: 'Two boxes collected and delivered to Massimo.',
      dueAt: atClock(subDays(now, 4), '10:30').toISOString(),
      location: 'Farmacia San Martino, Bologna',
      medicationId: DEMO_IDS.bloodPressure,
      done: true,
    },
  ];

  const notes: Note[] = [
    {
      id: 'note-dizziness',
      category: 'symptom',
      title: 'Light dizziness after breakfast',
      body: 'Massimo felt unsteady for a few minutes after Cardiotens. Sat down, passed quickly.',
      createdAt: subDays(now, 2).toISOString(),
      author: 'Lorenzo',
    },
    {
      id: 'note-sleep',
      category: 'care',
      title: 'Sleeping better',
      body: 'Since Somnovel moved to 21:30 he falls asleep before 23:00 and wakes up calmer.',
      createdAt: subDays(now, 4).toISOString(),
      author: 'Lorenzo',
    },
    {
      id: 'note-followup',
      category: 'follow-up',
      title: 'Ask about the evening dose',
      body: 'Ask Dr. Fanti if Sertalor can move to 18:00, before dinner, so it is easier to remember.',
      createdAt: subDays(now, 1).toISOString(),
      author: 'Lorenzo',
    },
    {
      id: 'note-side-effect',
      category: 'side-effect',
      title: 'Dry mouth in the evening',
      body: 'Mentioned dry mouth after Somnovel. Left a glass of water on the nightstand.',
      createdAt: subDays(now, 6).toISOString(),
      author: 'Lorenzo',
    },
  ];

  return {
    medications,
    doses,
    tasks,
    notes,
    alerts,
    reminders,
    demoDoseIds: { due: dueDose.id, late: lateDose.id, upcoming: upcomingDose.id },
  };
}
