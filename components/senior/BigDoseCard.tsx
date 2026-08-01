import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';

import { PillGraphic } from '@/components/PillGraphic';
import { prettyTime } from '@/lib/time';
import type { Dose, DoseStatus, Medication } from '@/lib/types';

type Props = {
  dose: Dose;
  medication: Medication;
  status: DoseStatus;
  onTaken: () => void;
  onSnooze: () => void;
};

/** Massimo's single focus: the medicine to take right now. */
export function BigDoseCard({ dose, medication, status, onTaken, onSnooze }: Props) {
  const unitWord = medication.form === 'capsule' ? 'capsule' : 'pill';
  const unitLabel = `${dose.units} ${unitWord}${dose.units > 1 ? 's' : ''}`;

  return (
    <View className="border-ink/10 bg-surface rounded-3xl border p-6 shadow-sm">
      <View className="items-center">
        <View
          className={
            status === 'late'
              ? 'bg-gold-tint rounded-full px-5 py-2'
              : 'bg-ink rounded-full px-5 py-2'
          }
        >
          <Typography
            className={
              status === 'late'
                ? 'text-gold-deep text-lg font-bold'
                : 'text-cream text-lg font-bold'
            }
          >
            {status === 'late' ? 'A little late' : 'Time to take it'}
          </Typography>
        </View>

        <PillGraphic color={medication.color} form={medication.form} size="xl" className="mt-6" />

        <Typography className="text-ink mt-5 text-center text-4xl font-bold">
          {medication.name}
        </Typography>
        <Typography className="text-ink-soft mt-1 text-center text-2xl">
          {medication.strength}
        </Typography>

        <Typography className="text-ink mt-5 text-center text-3xl font-semibold">
          Take {unitLabel} now
        </Typography>
        <Typography className="text-ink-soft mt-2 text-center text-xl">
          Scheduled for {prettyTime(dose.scheduledFor)}
        </Typography>
        <Typography className="text-ink-soft/80 mt-3 text-center text-lg">
          {medication.instruction}
        </Typography>
      </View>

      <Button variant="primary" size="lg" className="mt-7 h-20" onPress={onTaken}>
        <Button.Label className="text-3xl font-bold">Taken</Button.Label>
      </Button>

      <Button variant="outline" size="lg" className="mt-3 h-16" onPress={onSnooze}>
        <Button.Label className="text-xl">Remind me in 10 minutes</Button.Label>
      </Button>
    </View>
  );
}
