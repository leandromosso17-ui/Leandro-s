import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { parseISO } from 'date-fns';
import { BellRing, HeartHandshake, Undo2 } from 'lucide-react-native';

import { FlashBanner } from '@/components/FlashBanner';
import { PersonAvatar } from '@/components/PersonAvatar';
import { BigDoseCard } from '@/components/senior/BigDoseCard';
import { DayPartRows } from '@/components/senior/DayPartRows';
import { NextUpRow } from '@/components/senior/NextUpRow';
import { useFlash } from '@/hooks/useFlash';
import { useNow } from '@/hooks/useNow';
import { activeDose, doseStatus, dosesOn, nextUpcomingDose, summariseDay } from '@/lib/schedule';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import { greetingFor, minutesBetween, prettyDayLong, prettyTime } from '@/lib/time';

export default function SeniorToday() {
  const now = useNow(15_000);
  const { message, flash } = useFlash();

  const seniorPerson = useMedimoStore((state) => state.senior);
  const caregiverPerson = useMedimoStore((state) => state.caregiver);
  const medications = useMedimoStore((state) => state.medications);
  const doses = useMedimoStore((state) => state.doses);
  const snoozeDose = useMedimoStore((state) => state.snoozeDose);
  const undoDoseTaken = useMedimoStore((state) => state.undoDoseTaken);

  const medById = useMemo(
    () => new Map(medications.map((medication) => [medication.id, medication])),
    [medications],
  );

  const todayDoses = useMemo(() => dosesOn(doses, now), [doses, now]);
  const current = useMemo(() => activeDose(todayDoses, now), [todayDoses, now]);
  const next = useMemo(
    () => nextUpcomingDose(todayDoses, now, current?.id),
    [todayDoses, now, current],
  );
  const parts = useMemo(() => summariseDay(doses, now), [doses, now]);

  const justConfirmed = useMemo(() => {
    const recent = todayDoses
      .filter((dose) => dose.takenAt && minutesBetween(parseISO(dose.takenAt), now) <= 15)
      .sort((a, b) => (b.takenAt ?? '').localeCompare(a.takenAt ?? ''));
    return recent[0] ?? null;
  }, [todayDoses, now]);

  const snoozed = useMemo(
    () =>
      todayDoses.find(
        (dose) =>
          dose.outcome === 'pending' && dose.snoozedUntil && parseISO(dose.snoozedUntil) > now,
      ) ?? null,
    [todayDoses, now],
  );

  const missed = useMemo(
    () => todayDoses.filter((dose) => doseStatus(dose, now) === 'missed'),
    [todayDoses, now],
  );

  const currentMedication = current ? medById.get(current.medicationId) : undefined;
  const nextMedication = next ? medById.get(next.medicationId) : undefined;
  const snoozedMedication = snoozed ? medById.get(snoozed.medicationId) : undefined;
  const confirmedMedication = justConfirmed ? medById.get(justConfirmed.medicationId) : undefined;

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="pt-safe-offset-4 gap-6 px-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-4">
          <PersonAvatar initials={seniorPerson.avatarInitials} size="md" />
          <View className="flex-1">
            <Typography className="text-ink text-3xl font-bold">
              {greetingFor(now)}, {seniorPerson.name}
            </Typography>
            <Typography className="text-ink-soft mt-1 text-lg">
              {prettyDayLong(now.toISOString())}
            </Typography>
          </View>
        </View>

        {current && currentMedication ? (
          <BigDoseCard
            dose={current}
            medication={currentMedication}
            status={doseStatus(current, now)}
            onTaken={() => router.push(`/confirm/${current.id}`)}
            onSnooze={() => {
              snoozeDose(current.id, 10);
              flash('Fine. I will remind you in 10 minutes.');
            }}
          />
        ) : (
          <View className="border-border bg-surface items-center rounded-3xl border p-7">
            <View className="bg-sage-tint h-20 w-20 items-center justify-center rounded-full">
              <HeartHandshake color={palette.sage} size={36} />
            </View>
            <Typography className="text-ink mt-5 text-center text-3xl font-bold">
              Nothing to take right now
            </Typography>
            <Typography className="text-ink-soft mt-3 text-center text-xl">
              {next && nextMedication
                ? `The next one is ${nextMedication.name} at ${prettyTime(next.scheduledFor)}.`
                : 'You are all done for today. Well done.'}
            </Typography>
          </View>
        )}

        {snoozed && snoozedMedication ? (
          <View className="border-gold-soft/60 bg-gold-tint rounded-3xl border p-5">
            <View className="flex-row items-center gap-3">
              <BellRing color={palette.goldenMean} size={22} />
              <Typography className="text-gold-deep flex-1 text-xl font-semibold">
                I will remind you at {prettyTime(snoozed.snoozedUntil ?? snoozed.scheduledFor)}{' '}
                about {snoozedMedication.name}
              </Typography>
            </View>
            <Button
              variant="secondary"
              size="lg"
              className="mt-4 h-14"
              onPress={() => router.push(`/confirm/${snoozed.id}`)}
            >
              <Button.Label className="text-xl">Take it now</Button.Label>
            </Button>
          </View>
        ) : null}

        {justConfirmed && confirmedMedication ? (
          <View className="border-sage/25 bg-sage-tint rounded-3xl border p-5">
            <Typography className="text-sage-deep text-xl font-semibold">
              {confirmedMedication.name} saved at {prettyTime(justConfirmed.takenAt ?? '')}
            </Typography>
            <Typography className="text-ink-soft mt-1 text-lg">
              Tapped by mistake? You can undo it.
            </Typography>
            <Button
              variant="outline"
              size="lg"
              className="mt-4 h-14"
              onPress={() => {
                undoDoseTaken(justConfirmed.id);
                flash('Undone. The medicine is open again.');
              }}
            >
              <Undo2 color={palette.incrementalBlue} size={20} />
              <Button.Label className="text-xl">Undo</Button.Label>
            </Button>
          </View>
        ) : null}

        {missed.length > 0 ? (
          <View className="border-border bg-surface rounded-3xl border p-5">
            <Typography className="text-ink text-2xl font-semibold">
              One medicine was not taken
            </Typography>
            <Typography className="text-ink-soft mt-2 text-lg">
              Do not take two together. Carry on with the next one, and {caregiverPerson.name}{' '}
              already knows. If you feel unwell, call him.
            </Typography>
            <Button
              variant="secondary"
              size="lg"
              className="mt-4 h-14"
              onPress={() => router.push('/(senior)/help')}
            >
              <Button.Label className="text-xl">Call {caregiverPerson.name}</Button.Label>
            </Button>
          </View>
        ) : null}

        {next && nextMedication && current ? (
          <NextUpRow dose={next} medication={nextMedication} />
        ) : null}

        <View className="gap-3">
          <Typography className="text-ink text-2xl font-bold">Today</Typography>
          <DayPartRows parts={parts} />
        </View>

        <Button
          variant="secondary"
          size="lg"
          className="h-20"
          onPress={() => router.push('/(senior)/help')}
        >
          <Button.Label className="text-2xl font-bold">I need help</Button.Label>
        </Button>
      </ScrollView>

      <FlashBanner message={message} />
    </View>
  );
}
