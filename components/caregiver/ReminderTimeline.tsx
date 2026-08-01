import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { BellRing, MessageSquare, Phone, UserCheck } from 'lucide-react-native';

import { prettyDay, prettyTime } from '@/lib/time';
import { palette } from '@/lib/theme';
import type { ReminderChannel, ReminderEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

const CHANNEL: Record<ReminderChannel, { icon: typeof BellRing; label: string }> = {
  push: { icon: BellRing, label: 'Phone reminder' },
  sms: { icon: MessageSquare, label: 'SMS reminder' },
  call: { icon: Phone, label: 'Voice call' },
  manual: { icon: UserCheck, label: 'In app' },
};

type Props = {
  events: ReminderEvent[];
  showDate?: boolean;
};

export function ReminderTimeline({ events, showDate }: Props) {
  return (
    <View className="gap-3">
      {events.map((event, index) => {
        const meta = CHANNEL[event.channel];
        const Icon = meta.icon;
        const pending = event.status === 'scheduled';

        return (
          <View key={event.id} className="flex-row gap-3">
            <View className="items-center">
              <View
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-full',
                  pending
                    ? 'bg-cadet-soft'
                    : event.channel === 'call'
                      ? 'bg-gold-tint'
                      : 'bg-ink-tint',
                )}
              >
                <Icon
                  color={
                    pending
                      ? palette.cadetGrey
                      : event.channel === 'call'
                        ? palette.goldenMean
                        : palette.indigoCloth
                  }
                  size={16}
                />
              </View>
              {index < events.length - 1 ? <View className="bg-separator w-px flex-1" /> : null}
            </View>

            <View className={cn('flex-1', index < events.length - 1 && 'pb-4')}>
              <View className="flex-row items-center gap-2">
                <Typography type="body-sm" className="text-ink font-semibold">
                  {meta.label}
                </Typography>
                <Typography type="body-xs" className="text-ink-soft/60">
                  {showDate ? `${prettyDay(event.at)} · ` : ''}
                  {prettyTime(event.at)}
                </Typography>
              </View>
              <Typography type="body-sm" className="text-ink-soft/85 mt-0.5">
                {event.detail}
              </Typography>
              <Typography type="body-xs" className="text-ink-soft/55 mt-1">
                {event.provider} · {event.status}
              </Typography>
            </View>
          </View>
        );
      })}
    </View>
  );
}
