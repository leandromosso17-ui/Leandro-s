import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';

import { atClock, dayKey, dayPartOfISO, isoDayKey, minutesBetween } from '@/lib/time';
import type {
  AdherenceStats,
  DayAdherence,
  DayPart,
  DayPartMisses,
  Dose,
  DoseStatus,
  InventoryProjection,
  Medication,
} from '@/lib/types';

/**
 * Timing rules of the schedule engine. All windows are in minutes and relative
 * to the scheduled intake time.
 */
export const DOSE_WINDOW = {
  /** A dose becomes "due now" this long before its scheduled time. */
  dueBefore: 30,
  /** After this delay a pending dose is flagged "late". */
  lateAfter: 20,
  /** After this delay a pending dose counts as missed. */
  missedAfter: 90,
} as const;

/** Reminder ladder: push at T, SMS at T+10, ElevenLabs call 30 min after the SMS. */
export const ESCALATION = {
  smsAfterMinutes: 10,
  callAfterSmsMinutes: 30,
} as const;

export function escalationCallMinutes(): number {
  return ESCALATION.smsAfterMinutes + ESCALATION.callAfterSmsMinutes;
}

export function doseStatus(dose: Dose, now: Date): DoseStatus {
  if (dose.outcome === 'taken') return 'taken';
  if (dose.outcome === 'missed') return 'missed';
  if (dose.outcome === 'skipped') return 'skipped';

  const scheduled = parseISO(dose.scheduledFor);
  const delta = minutesBetween(scheduled, now);

  if (dose.snoozedUntil && now < parseISO(dose.snoozedUntil)) return 'upcoming';
  if (delta < -DOSE_WINDOW.dueBefore) return 'upcoming';
  if (delta <= DOSE_WINDOW.lateAfter) return 'due';
  if (delta <= DOSE_WINDOW.missedAfter) return 'late';
  return 'missed';
}

export const doseStatusLabel: Record<DoseStatus, string> = {
  upcoming: 'Upcoming',
  due: 'Due now',
  late: 'Late',
  taken: 'Taken',
  missed: 'Missed',
  skipped: 'Skipped',
};

export function sortDoses(doses: Dose[]): Dose[] {
  return [...doses].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export function dosesOn(doses: Dose[], day: Date): Dose[] {
  const key = dayKey(day);
  return sortDoses(doses.filter((dose) => isoDayKey(dose.scheduledFor) === key));
}

export function doseId(medicationId: string, scheduled: Date): string {
  return `${medicationId}-${format(scheduled, "yyyyMMdd'T'HHmm")}`;
}

/** Materialise doses for a medication across an inclusive day range. */
export function buildDoses(medication: Medication, fromDay: Date, toDay: Date): Dose[] {
  const days = differenceInCalendarDays(startOfDay(toDay), startOfDay(fromDay));
  const doses: Dose[] = [];

  for (let offset = 0; offset <= days; offset += 1) {
    const day = addDays(startOfDay(fromDay), offset);
    for (const clock of medication.times) {
      const scheduled = atClock(day, clock);
      doses.push({
        id: doseId(medication.id, scheduled),
        medicationId: medication.id,
        scheduledFor: scheduled.toISOString(),
        units: medication.unitsPerIntake,
        outcome: 'pending',
        takenAt: null,
        confirmedBy: null,
        snoozedUntil: null,
      });
    }
  }

  return sortDoses(doses);
}

export function dailyUnits(medication: Medication): number {
  return medication.times.length * medication.unitsPerIntake;
}

export function projectInventory(medication: Medication, now: Date): InventoryProjection {
  const perDay = dailyUnits(medication) || 1;
  const daysLeft = Math.floor(medication.remainingUnits / perDay);
  const runout = addDays(startOfDay(now), daysLeft);

  return {
    medicationId: medication.id,
    dailyUnits: perDay,
    remainingUnits: medication.remainingUnits,
    packSize: medication.packSize,
    daysLeft,
    runoutISO: runout.toISOString(),
    risk: daysLeft <= 4 ? 'critical' : daysLeft <= 8 ? 'soon' : 'ok',
  };
}

export const riskLabel = {
  ok: 'Stock healthy',
  soon: 'Refill soon',
  critical: 'Refill now',
} as const;

/** Doses that already had their chance to be taken, inside a day window. */
function settledDoses(doses: Dose[], now: Date, windowDays: number): Dose[] {
  const from = addDays(startOfDay(now), -(windowDays - 1));
  return doses.filter((dose) => {
    const scheduled = parseISO(dose.scheduledFor);
    if (scheduled < from) return false;
    if (dose.outcome === 'taken') return true;
    return minutesBetween(scheduled, now) > DOSE_WINDOW.missedAfter;
  });
}

export function adherence(doses: Dose[], now: Date, windowDays: number): AdherenceStats {
  const settled = settledDoses(doses, now, windowDays);
  const taken = settled.filter((dose) => dose.outcome === 'taken').length;
  const missed = settled.length - taken;

  return {
    windowDays,
    total: settled.length,
    taken,
    missed,
    score: settled.length === 0 ? 100 : Math.round((taken / settled.length) * 100),
  };
}

export function adherenceByDay(doses: Dose[], now: Date, days: number): DayAdherence[] {
  const result: DayAdherence[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(startOfDay(now), -offset);
    const key = dayKey(day);
    const dayDoses = doses.filter((dose) => isoDayKey(dose.scheduledFor) === key);
    const settled = dayDoses.filter((dose) => {
      if (dose.outcome === 'taken') return true;
      return minutesBetween(parseISO(dose.scheduledFor), now) > DOSE_WINDOW.missedAfter;
    });
    const taken = settled.filter((dose) => dose.outcome === 'taken').length;

    result.push({
      dateISO: day.toISOString(),
      label: format(day, 'EEEEE'),
      total: settled.length,
      taken,
      score: settled.length === 0 ? 100 : Math.round((taken / settled.length) * 100),
    });
  }

  return result;
}

export function missesByDayPart(doses: Dose[], now: Date, windowDays: number): DayPartMisses[] {
  const parts: DayPart[] = ['morning', 'afternoon', 'evening'];
  const settled = settledDoses(doses, now, windowDays);

  return parts.map((part) => {
    const inPart = settled.filter((dose) => dayPartOfISO(dose.scheduledFor) === part);
    return {
      part,
      total: inPart.length,
      missed: inPart.filter((dose) => dose.outcome !== 'taken').length,
    };
  });
}

/** Longest run of consecutive non-taken settled doses, most recent first. */
export function consecutiveMisses(doses: Dose[], medicationId: string, now: Date): number {
  const relevant = sortDoses(doses.filter((dose) => dose.medicationId === medicationId)).filter(
    (dose) => {
      if (dose.outcome === 'taken') return true;
      return minutesBetween(parseISO(dose.scheduledFor), now) > DOSE_WINDOW.missedAfter;
    },
  );

  let streak = 0;
  for (let index = relevant.length - 1; index >= 0; index -= 1) {
    if (relevant[index].outcome === 'taken') break;
    streak += 1;
  }
  return streak;
}

/** The dose Massimo should act on right now (due, then late). */
export function activeDose(doses: Dose[], now: Date): Dose | null {
  const candidates = sortDoses(
    doses.filter((dose) => {
      const status = doseStatus(dose, now);
      return status === 'due' || status === 'late';
    }),
  );
  return candidates[0] ?? null;
}

export function nextUpcomingDose(doses: Dose[], now: Date, excludeId?: string): Dose | null {
  const candidates = sortDoses(
    doses.filter((dose) => {
      if (dose.id === excludeId) return false;
      if (dose.outcome !== 'pending') return false;
      // A snoozed dose has its own reminder; it is not "next up".
      if (dose.snoozedUntil && parseISO(dose.snoozedUntil) > now) return false;
      return parseISO(dose.scheduledFor) > now || doseStatus(dose, now) === 'upcoming';
    }),
  );
  return candidates[0] ?? null;
}

export type DayPartSummary = {
  part: DayPart;
  total: number;
  taken: number;
  state: 'none' | 'done' | 'pending' | 'attention';
};

export function summariseDay(doses: Dose[], now: Date): DayPartSummary[] {
  const parts: DayPart[] = ['morning', 'afternoon', 'evening'];
  const today = dosesOn(doses, now);

  return parts.map((part) => {
    const inPart = today.filter((dose) => dayPartOfISO(dose.scheduledFor) === part);
    const taken = inPart.filter((dose) => dose.outcome === 'taken').length;
    const hasProblem = inPart.some((dose) => {
      const status = doseStatus(dose, now);
      return status === 'missed' || status === 'late';
    });

    let state: DayPartSummary['state'] = 'none';
    if (inPart.length > 0) {
      if (hasProblem) state = 'attention';
      else if (taken === inPart.length) state = 'done';
      else state = 'pending';
    }

    return { part, total: inPart.length, taken, state };
  });
}
