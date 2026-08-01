import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, ShieldQuestion } from 'lucide-react-native';

import { BackButton } from '@/components/BackButton';
import { PillGraphic } from '@/components/PillGraphic';
import { confirmFeedback } from '@/lib/services/reminders';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import { prettyTime } from '@/lib/time';
import type { Role } from '@/lib/types';

/**
 * Double confirmation before a dose is finalised. Shared by both experiences:
 * Massimo confirms his own dose, Lorenzo can mark one on his behalf.
 */
export default function ConfirmDoseScreen() {
  const params = useLocalSearchParams<{ doseId: string; actor?: string }>();
  const actor: Role = params.actor === 'caregiver' ? 'caregiver' : 'senior';

  const doses = useMedimoStore((state) => state.doses);
  const medications = useMedimoStore((state) => state.medications);
  const markDoseTaken = useMedimoStore((state) => state.markDoseTaken);
  const undoDoseTaken = useMedimoStore((state) => state.undoDoseTaken);

  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const dose = doses.find((item) => item.id === params.doseId);
  const medication = medications.find((item) => item.id === dose?.medicationId);

  if (!dose || !medication) {
    return (
      <View className="bg-cream flex-1 items-center justify-center px-8">
        <View className="pt-safe-offset-2 absolute top-0 left-5">
          <BackButton size="lg" />
        </View>
        <Typography className="text-ink-soft text-center">
          This dose is no longer scheduled.
        </Typography>
        <Button variant="ghost" size="lg" className="mt-6" onPress={() => router.back()}>
          <Button.Label>Go back</Button.Label>
        </Button>
      </View>
    );
  }

  const unitLabel = `${dose.units} ${medication.form === 'capsule' ? 'capsule' : 'pill'}${
    dose.units > 1 ? 's' : ''
  }`;

  const confirm = () => {
    markDoseTaken(dose.id, actor);
    setConfirmedAt(new Date().toISOString());
    void confirmFeedback();
  };

  if (confirmedAt) {
    return (
      <View className="bg-cream flex-1">
        <View className="pt-safe-offset-2 px-5 pb-1">
          <BackButton size="lg" />
        </View>
        <ScrollView contentContainerClassName="grow justify-center gap-8 px-6 py-10">
          <View className="items-center">
            <View className="bg-sage-tint h-24 w-24 items-center justify-center rounded-full">
              <CheckCircle2 color={palette.sage} size={52} />
            </View>
            <Typography type="h1" className="text-ink mt-6 text-center font-bold">
              All done
            </Typography>
            <Typography className="text-ink-soft mt-3 text-center text-xl">
              {medication.name} {medication.strength} saved at {prettyTime(confirmedAt)}.
            </Typography>
            {actor === 'senior' ? (
              <Typography className="text-ink-soft/80 mt-2 text-center text-lg">
                Thank you, Massimo. Lorenzo can see it now.
              </Typography>
            ) : (
              <Typography className="text-ink-soft/80 mt-2 text-center text-lg">
                Marked on Massimo&apos;s behalf.
              </Typography>
            )}
          </View>

          <View className="gap-3">
            <Button variant="primary" size="lg" className="h-16" onPress={() => router.back()}>
              <Button.Label className="text-xl">Close</Button.Label>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-14"
              onPress={() => {
                undoDoseTaken(dose.id);
                router.back();
              }}
            >
              <Button.Label className="text-lg">That was a mistake — undo</Button.Label>
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="bg-cream flex-1">
      <View className="pt-safe-offset-2 px-5 pb-1">
        <BackButton size="lg" />
      </View>
      <ScrollView contentContainerClassName="grow justify-center gap-8 px-6 py-10">
        <View className="items-center">
          <View className="bg-ink-tint h-14 w-14 items-center justify-center rounded-full">
            <ShieldQuestion color={palette.incrementalBlue} size={26} />
          </View>
          <Typography type="h2" className="text-ink mt-5 text-center font-bold">
            You&apos;re marking this{'\n'}medicine as taken
          </Typography>
        </View>

        <View className="border-border bg-surface items-center rounded-3xl border p-6">
          <PillGraphic color={medication.color} form={medication.form} size="xl" />
          <Typography type="h3" className="text-ink mt-4 text-center font-bold">
            {medication.name} {medication.strength}
          </Typography>
          <Typography className="text-ink-soft mt-2 text-center text-xl">
            {unitLabel} · {prettyTime(dose.scheduledFor)}
          </Typography>
          <Typography className="text-ink-soft/80 mt-2 text-center text-lg">
            {medication.instruction}
          </Typography>
        </View>

        <View className="gap-3">
          <Button variant="primary" size="lg" className="h-16" onPress={confirm}>
            <Button.Label className="text-xl">Yes, I took it</Button.Label>
          </Button>
          <Button variant="outline" size="lg" className="h-16" onPress={() => router.back()}>
            <Button.Label className="text-xl">Go back</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
