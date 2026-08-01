import { format, isSameDay, parseISO } from 'date-fns';

import type { DayPart } from '@/lib/types';

/** Build a Date on `day` from a 'HH:mm' clock string. */
export function atClock(day: Date, clock: string): Date {
  const [hours, minutes] = clock.split(':').map(Number);
  const next = new Date(day);
  next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return next;
}

export function clockOf(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

/** Local calendar day key ('yyyy-MM-dd'); ISO strings are stored in UTC. */
export function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function isoDayKey(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

export function prettyTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

export function prettyClock(clock: string): string {
  return clock;
}

export function prettyDay(iso: string): string {
  return format(parseISO(iso), 'EEE d MMM');
}

export function prettyDayLong(iso: string): string {
  return format(parseISO(iso), 'EEEE d MMMM');
}

export function dayPartOfHour(hour: number): DayPart {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function dayPartOfISO(iso: string): DayPart {
  return dayPartOfHour(parseISO(iso).getHours());
}

export const dayPartLabel: Record<DayPart, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

export function isToday(iso: string, now: Date): boolean {
  return isSameDay(parseISO(iso), now);
}

/** "in 25 min" / "35 min ago" / "in 2 h 10 min" */
export function relativeMinutes(iso: string, now: Date): string {
  const diff = minutesBetween(now, parseISO(iso));
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const body = hours > 0 ? `${hours} h${mins > 0 ? ` ${mins} min` : ''}` : `${abs} min`;
  if (diff === 0) return 'now';
  return diff > 0 ? `in ${body}` : `${body} ago`;
}
