import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { AlertTriangle, BellRing, Check, PackageMinus, Phone } from 'lucide-react-native';

import { prettyDay, prettyTime } from '@/lib/time';
import { palette } from '@/lib/theme';
import type { CareAlert } from '@/lib/types';

type Props = {
  alert: CareAlert;
  busy?: boolean;
  onSendSms?: () => void;
  onCall?: () => void;
  onMarkTaken?: () => void;
  onStartRefill?: () => void;
  onDismiss: () => void;
};

const ICONS = {
  'missed-dose': AlertTriangle,
  'late-dose': BellRing,
  'consecutive-misses': AlertTriangle,
  'low-stock': PackageMinus,
} as const;

export function AlertCard({
  alert,
  busy,
  onSendSms,
  onCall,
  onMarkTaken,
  onStartRefill,
  onDismiss,
}: Props) {
  const Icon = ICONS[alert.kind];
  const urgent = alert.severity === 'urgent';

  return (
    <View
      className={
        urgent
          ? 'border-clay/25 bg-clay-tint rounded-3xl border p-4'
          : 'border-gold-soft/50 bg-gold-tint rounded-3xl border p-4'
      }
    >
      <View className="flex-row items-start gap-3">
        <View className="bg-surface h-10 w-10 items-center justify-center rounded-2xl">
          <Icon color={urgent ? palette.clay : palette.goldenMean} size={19} />
        </View>
        <View className="flex-1">
          <Typography
            className={urgent ? 'text-clay-deep font-semibold' : 'text-gold-deep font-semibold'}
          >
            {alert.title}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft mt-1">
            {alert.message}
          </Typography>
          <Typography type="body-xs" className="text-ink-soft/60 mt-2">
            {prettyDay(alert.createdAt)} · {prettyTime(alert.createdAt)}
            {alert.acknowledged ? ' · handled' : ''}
          </Typography>
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {onMarkTaken ? (
          <Button size="sm" variant="primary" isDisabled={busy} onPress={onMarkTaken}>
            <Check color={palette.cream} size={14} />
            <Button.Label>Mark taken</Button.Label>
          </Button>
        ) : null}
        {onSendSms ? (
          <Button size="sm" variant="secondary" isDisabled={busy} onPress={onSendSms}>
            <BellRing color={palette.cream} size={14} />
            <Button.Label>Send SMS</Button.Label>
          </Button>
        ) : null}
        {onCall ? (
          <Button size="sm" variant="tertiary" isDisabled={busy} onPress={onCall}>
            <Phone color={palette.incrementalBlue} size={14} />
            <Button.Label>Voice call</Button.Label>
          </Button>
        ) : null}
        {onStartRefill ? (
          <Button size="sm" variant="tertiary" onPress={onStartRefill}>
            <PackageMinus color={palette.incrementalBlue} size={14} />
            <Button.Label>Start refill</Button.Label>
          </Button>
        ) : null}
        {alert.acknowledged ? null : (
          <Button size="sm" variant="ghost" onPress={onDismiss}>
            <Button.Label>Dismiss</Button.Label>
          </Button>
        )}
      </View>
    </View>
  );
}
