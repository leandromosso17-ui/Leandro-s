import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { ChevronRight } from 'lucide-react-native';

import { PillGraphic } from '@/components/PillGraphic';
import { riskLabel } from '@/lib/schedule';
import { palette } from '@/lib/theme';
import type { InventoryProjection, Medication } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  medication: Medication;
  projection: InventoryProjection;
  onPress: () => void;
};

const RISK_TEXT = {
  ok: 'text-sage-deep',
  soon: 'text-gold-deep',
  critical: 'text-clay-deep',
} as const;

export function MedicationCard({ medication, projection, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${medication.name}`}
      className="border-border bg-surface rounded-3xl border p-4"
    >
      <View className="flex-row items-center gap-3">
        <PillGraphic color={medication.color} form={medication.form} size="lg" />
        <View className="flex-1">
          <Typography type="h6" className="text-ink font-semibold">
            {medication.name} {medication.strength}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/80 mt-0.5">
            {medication.purpose} · {medication.frequencyLabel}
          </Typography>
          <Typography
            type="body-sm"
            className={cn('mt-1.5 font-medium', RISK_TEXT[projection.risk])}
          >
            {projection.remainingUnits} left · {riskLabel[projection.risk]}
          </Typography>
        </View>
        <ChevronRight color={palette.cadetGrey} size={18} />
      </View>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {medication.times.map((time) => (
          <View key={time} className="bg-cadet-soft rounded-full px-3 py-1">
            <Typography type="body-xs" className="text-ink-soft font-semibold">
              {time}
            </Typography>
          </View>
        ))}
        <View className="bg-ink-tint rounded-full px-3 py-1">
          <Typography type="body-xs" className="text-ink-soft font-semibold">
            {medication.unitsPerIntake} per intake
          </Typography>
        </View>
      </View>
    </Pressable>
  );
}
