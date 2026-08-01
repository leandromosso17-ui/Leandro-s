import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { PillGraphic } from '@/components/PillGraphic';
import { useNow } from '@/hooks/useNow';
import { doseStatus, dosesOn } from '@/lib/schedule';
import { useMedimoStore } from '@/lib/store';
import { prettyTime } from '@/lib/time';
import type { DoseStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const WORDING: Record<DoseStatus, string> = {
  upcoming: 'Later today',
  due: 'Take it now',
  late: 'Take it now',
  taken: 'Taken',
  missed: 'Not taken',
  skipped: 'Skipped',
};

export default function SeniorMedicines() {
  const now = useNow(15_000);
  const medications = useMedimoStore((state) => state.medications);
  const doses = useMedimoStore((state) => state.doses);

  const medById = useMemo(
    () => new Map(medications.map((medication) => [medication.id, medication])),
    [medications],
  );
  const todayDoses = useMemo(() => dosesOn(doses, now), [doses, now]);

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="pt-safe-offset-4 gap-4 px-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Typography className="text-ink text-3xl font-bold">Your medicines today</Typography>
          <Typography className="text-ink-soft mt-1 text-lg">In the order you take them</Typography>
        </View>

        {todayDoses.map((dose) => {
          const medication = medById.get(dose.medicationId);
          if (!medication) return null;
          const status = doseStatus(dose, now);
          const actionable = status === 'due' || status === 'late';

          return (
            <View
              key={dose.id}
              className={cn(
                'rounded-3xl border p-5',
                actionable ? 'border-ink/20 bg-surface' : 'border-border bg-surface',
                status === 'taken' && 'opacity-75',
              )}
            >
              <View className="flex-row items-center gap-4">
                <PillGraphic color={medication.color} form={medication.form} size="lg" />
                <View className="flex-1">
                  <Typography className="text-ink text-2xl font-semibold">
                    {medication.name}
                  </Typography>
                  <Typography className="text-ink-soft text-xl">
                    {prettyTime(dose.scheduledFor)} · {dose.units}{' '}
                    {medication.form === 'capsule' ? 'capsule' : 'pill'}
                    {dose.units > 1 ? 's' : ''}
                  </Typography>
                  <Typography
                    className={cn(
                      'mt-1 text-lg font-semibold',
                      status === 'taken'
                        ? 'text-sage-deep'
                        : actionable
                          ? 'text-ink'
                          : status === 'missed'
                            ? 'text-clay-deep'
                            : 'text-ink-soft',
                    )}
                  >
                    {status === 'taken' && dose.takenAt
                      ? `Taken at ${prettyTime(dose.takenAt)}`
                      : WORDING[status]}
                  </Typography>
                </View>
              </View>

              {actionable ? (
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-4 h-16"
                  onPress={() => router.push(`/confirm/${dose.id}`)}
                >
                  <Button.Label className="text-2xl font-bold">Taken</Button.Label>
                </Button>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
