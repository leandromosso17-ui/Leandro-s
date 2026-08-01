import { Pressable, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { format, parseISO } from 'date-fns';

import { PillGraphic } from '@/components/PillGraphic';
import { riskLabel } from '@/lib/schedule';
import type { InventoryProjection, Medication } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  medication: Medication;
  projection: InventoryProjection;
  onPress?: () => void;
  onRefill?: () => void;
};

const RISK_STYLE = {
  ok: { wrap: 'bg-sage-tint', text: 'text-sage-deep', bar: 'bg-sage' },
  soon: { wrap: 'bg-gold-tint', text: 'text-gold-deep', bar: 'bg-gold' },
  critical: { wrap: 'bg-clay-tint', text: 'text-clay-deep', bar: 'bg-clay' },
} as const;

export function InventoryRow({ medication, projection, onPress, onRefill }: Props) {
  const style = RISK_STYLE[projection.risk];
  const fill = Math.max(
    4,
    Math.round((projection.remainingUnits / Math.max(1, projection.packSize)) * 100),
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="border-border bg-surface rounded-3xl border p-4"
    >
      <View className="flex-row items-center gap-3">
        <PillGraphic color={medication.color} form={medication.form} size="md" />
        <View className="flex-1">
          <Typography className="text-ink font-semibold">
            {medication.name} {medication.strength}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/80 mt-0.5">
            {medication.frequencyLabel}
          </Typography>
        </View>
        <View className={cn('rounded-full px-3 py-1', style.wrap)}>
          <Typography type="body-xs" className={cn('font-semibold', style.text)}>
            {riskLabel[projection.risk]}
          </Typography>
        </View>
      </View>

      <View className="mt-4">
        <View className="bg-cadet-soft h-2 overflow-hidden rounded-full">
          <View className={cn('h-2 rounded-full', style.bar)} style={{ width: `${fill}%` }} />
        </View>
        <View className="mt-2 flex-row items-end justify-between">
          <Typography type="body-sm" className="text-ink-soft">
            {projection.remainingUnits} of {projection.packSize} left · {projection.dailyUnits} per
            day
          </Typography>
          <Typography type="body-sm" className="text-ink font-semibold">
            {projection.daysLeft === 0
              ? 'Runs out today'
              : `Runs out ${format(parseISO(projection.runoutISO), 'EEE d MMM')}`}
          </Typography>
        </View>
      </View>

      {onRefill ? (
        <Button size="sm" variant="tertiary" className="mt-3 self-start" onPress={onRefill}>
          <Button.Label>Add a new pack</Button.Label>
        </Button>
      ) : null}
    </Pressable>
  );
}
