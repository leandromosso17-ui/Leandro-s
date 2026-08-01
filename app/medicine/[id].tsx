import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { addDays } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { BellRing, CalendarPlus } from 'lucide-react-native';

import { FlashBanner } from '@/components/FlashBanner';
import { PillGraphic } from '@/components/PillGraphic';
import { ScoreRing } from '@/components/ScoreRing';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusPill } from '@/components/StatusPill';
import { InventoryRow } from '@/components/caregiver/InventoryRow';
import { useFlash } from '@/hooks/useFlash';
import { useNow } from '@/hooks/useNow';
import {
  adherence,
  doseStatus,
  nextUpcomingDose,
  projectInventory,
  sortDoses,
} from '@/lib/schedule';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import { prettyDay, prettyTime } from '@/lib/time';

export default function MedicineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const now = useNow(60_000);
  const { message, flash } = useFlash();

  const medications = useMedimoStore((state) => state.medications);
  const doses = useMedimoStore((state) => state.doses);
  const refillMedication = useMedimoStore((state) => state.refillMedication);
  const addTask = useMedimoStore((state) => state.addTask);
  const sendSmsReminder = useMedimoStore((state) => state.sendSmsReminder);

  const medication = useMemo(() => medications.find((item) => item.id === id), [medications, id]);

  const medicationDoses = useMemo(
    () => sortDoses(doses.filter((dose) => dose.medicationId === id)),
    [doses, id],
  );

  const projection = useMemo(
    () => (medication ? projectInventory(medication, now) : null),
    [medication, now],
  );

  const score = useMemo(() => adherence(medicationDoses, now, 7).score, [medicationDoses, now]);

  const nextDose = useMemo(() => nextUpcomingDose(medicationDoses, now), [medicationDoses, now]);

  const history = useMemo(() => {
    const past = medicationDoses.filter((dose) => dose.scheduledFor <= now.toISOString());
    return past.slice(-6).toReversed();
  }, [medicationDoses, now]);

  if (!medication || !projection) {
    return (
      <View className="bg-cream flex-1 items-center justify-center px-8">
        <Typography className="text-ink-soft text-center">
          This medicine is no longer in the plan.
        </Typography>
      </View>
    );
  }

  return (
    <View className="bg-cream flex-1">
      <Stack.Screen options={{ title: medication.name }} />
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="border-border bg-surface rounded-3xl border p-5">
          <View className="flex-row items-center gap-4">
            <PillGraphic color={medication.color} form={medication.form} size="xl" />
            <View className="flex-1">
              <Typography type="h3" className="text-ink font-bold">
                {medication.name}
              </Typography>
              <Typography className="text-ink-soft">
                {medication.strength} · {medication.purpose}
              </Typography>
              <Typography type="body-sm" className="text-ink-soft/70 mt-2">
                {medication.prescriber}
              </Typography>
              <Typography type="body-xs" className="text-ink-soft/60 mt-1">
                Added{' '}
                {medication.createdVia === 'scan' ? 'from a scanned prescription' : 'manually'}
              </Typography>
            </View>
          </View>

          <View className="border-separator mt-5 flex-row flex-wrap gap-2 border-t pt-4">
            {medication.times.map((time) => (
              <View key={time} className="bg-cadet-soft rounded-full px-3 py-1.5">
                <Typography type="body-sm" className="text-ink-soft font-semibold">
                  {time}
                </Typography>
              </View>
            ))}
            <View className="bg-ink-tint rounded-full px-3 py-1.5">
              <Typography type="body-sm" className="text-ink-soft font-semibold">
                {medication.unitsPerIntake} per intake
              </Typography>
            </View>
            <View className="bg-gold-tint rounded-full px-3 py-1.5">
              <Typography type="body-sm" className="text-gold-deep font-semibold">
                {medication.foodRule.replace('-', ' ')}
              </Typography>
            </View>
          </View>

          <Typography className="text-ink-soft mt-4">{medication.instruction}</Typography>
        </View>

        <View className="gap-3">
          <SectionHeader title="Stock & refill" subtitle="Predicted from the current schedule" />
          <InventoryRow
            medication={medication}
            projection={projection}
            onRefill={() => {
              refillMedication(medication.id, medication.packSize);
              flash(`New pack of ${medication.packSize} registered`);
            }}
          />
          <View className="flex-row gap-3">
            <Button
              variant="tertiary"
              size="sm"
              className="flex-1"
              onPress={() => {
                addTask({
                  kind: 'refill',
                  title: `Refill ${medication.name}`,
                  detail: `${projection.remainingUnits} units left · about ${projection.daysLeft} days of cover.`,
                  dueAt: addDays(now, Math.max(1, projection.daysLeft - 1)).toISOString(),
                  medicationId: medication.id,
                });
                flash('Refill task added to the care plan');
              }}
            >
              <CalendarPlus color={palette.incrementalBlue} size={15} />
              <Button.Label>Refill task</Button.Label>
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              className="flex-1"
              isDisabled={!nextDose}
              onPress={() => {
                if (!nextDose) return;
                void sendSmsReminder(nextDose.id);
                flash('Reminder sent to Massimo');
              }}
            >
              <BellRing color={palette.incrementalBlue} size={15} />
              <Button.Label>Send reminder</Button.Label>
            </Button>
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader title="How it is going" subtitle="Last 7 days for this medicine" />
          <View className="border-border bg-surface flex-row items-center gap-5 rounded-3xl border p-5">
            <ScoreRing score={score} caption="7 days" />
            <View className="flex-1 gap-1">
              {nextDose ? (
                <>
                  <Typography
                    type="body-sm"
                    className="text-ink-soft/70 font-semibold tracking-wider uppercase"
                  >
                    Next dose
                  </Typography>
                  <Typography type="h5" className="text-ink font-semibold">
                    {prettyTime(nextDose.scheduledFor)} · {prettyDay(nextDose.scheduledFor)}
                  </Typography>
                </>
              ) : (
                <Typography className="text-ink-soft">No further doses scheduled.</Typography>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 self-start"
                isDisabled={!nextDose}
                onPress={() => nextDose && router.push(`/confirm/${nextDose.id}?actor=caregiver`)}
              >
                <Button.Label>Mark this dose</Button.Label>
              </Button>
            </View>
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader title="Recent doses" subtitle="Exact confirmation times" />
          <View className="border-border bg-surface gap-3 rounded-3xl border p-4">
            {history.map((dose) => (
              <View key={dose.id} className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Typography type="body-sm" className="text-ink font-medium">
                    {prettyDay(dose.scheduledFor)} · {prettyTime(dose.scheduledFor)}
                  </Typography>
                  <Typography type="body-xs" className="text-ink-soft/70">
                    {dose.takenAt ? `Confirmed at ${prettyTime(dose.takenAt)}` : 'Not confirmed'}
                  </Typography>
                </View>
                <StatusPill status={doseStatus(dose, now)} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <FlashBanner message={message} />
    </View>
  );
}
