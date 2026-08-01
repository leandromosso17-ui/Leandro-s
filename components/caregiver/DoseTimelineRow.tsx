import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { BellRing, Check } from 'lucide-react-native';

import { PillGraphic } from '@/components/PillGraphic';
import { StatusPill } from '@/components/StatusPill';
import { prettyTime, relativeMinutes } from '@/lib/time';
import { palette } from '@/lib/theme';
import type { Dose, DoseStatus, Medication } from '@/lib/types';

type Props = {
  dose: Dose;
  medication: Medication;
  status: DoseStatus;
  now: Date;
  busy?: boolean;
  onMarkTaken: () => void;
  onRemind: () => void;
  onOpenLadder: () => void;
};

/** One chronological entry of Massimo's day, as Lorenzo sees it. */
export function DoseTimelineRow({
  dose,
  medication,
  status,
  now,
  busy,
  onMarkTaken,
  onRemind,
  onOpenLadder,
}: Props) {
  const needsAction = status === 'due' || status === 'late' || status === 'missed';

  return (
    <View className="border-border bg-surface flex-row gap-3 rounded-3xl border p-4">
      <View className="w-14 items-center">
        <Typography className="text-ink font-semibold">{prettyTime(dose.scheduledFor)}</Typography>
        <Typography type="body-xs" className="text-ink-soft/60 mt-0.5 text-center">
          {status === 'taken' && dose.takenAt
            ? prettyTime(dose.takenAt)
            : relativeMinutes(dose.scheduledFor, now)}
        </Typography>
      </View>

      <PillGraphic color={medication.color} form={medication.form} size="md" />

      <View className="flex-1">
        <Typography className="text-ink font-semibold">
          {medication.name} {medication.strength}
        </Typography>
        <Typography type="body-sm" className="text-ink-soft/80 mt-0.5">
          {dose.units} {medication.form === 'capsule' ? 'capsule' : 'tablet'}
          {dose.units > 1 ? 's' : ''} · {medication.purpose}
        </Typography>

        <View className="mt-2 flex-row items-center gap-2">
          <StatusPill status={status} />
          {status === 'taken' && dose.takenAt ? (
            <Typography type="body-xs" className="text-ink-soft/70">
              confirmed by {dose.confirmedBy === 'caregiver' ? 'Lorenzo' : 'Massimo'}
            </Typography>
          ) : null}
        </View>

        {needsAction ? (
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Button size="sm" variant="primary" isDisabled={busy} onPress={onMarkTaken}>
              <Check color={palette.cream} size={14} />
              <Button.Label>Mark taken</Button.Label>
            </Button>
            <Button size="sm" variant="tertiary" isDisabled={busy} onPress={onRemind}>
              <BellRing color={palette.incrementalBlue} size={14} />
              <Button.Label>Remind</Button.Label>
            </Button>
            <Button size="sm" variant="ghost" onPress={onOpenLadder}>
              <Button.Label>Escalation</Button.Label>
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  );
}
