import { View } from 'react-native';
import { Typography } from 'heroui-native';

import { PillGraphic } from '@/components/PillGraphic';
import { prettyTime } from '@/lib/time';
import type { Dose, Medication } from '@/lib/types';

type Props = {
  dose: Dose;
  medication: Medication;
};

/** The one medicine after the current one — nothing more. */
export function NextUpRow({ dose, medication }: Props) {
  return (
    <View className="border-border bg-surface flex-row items-center gap-4 rounded-3xl border px-5 py-4">
      <PillGraphic color={medication.color} form={medication.form} size="md" />
      <View className="flex-1">
        <Typography className="text-ink-soft text-lg">Next</Typography>
        <Typography className="text-ink text-2xl font-semibold">
          {prettyTime(dose.scheduledFor)} · {medication.name}
        </Typography>
      </View>
    </View>
  );
}
