import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { Check, Clock } from 'lucide-react-native';

import { dayPartLabel } from '@/lib/time';
import { palette } from '@/lib/theme';
import type { DayPartSummary } from '@/lib/schedule';
import { cn } from '@/lib/utils';

const STATE_TEXT = {
  none: 'Nothing planned',
  done: 'Done',
  pending: 'Still to take',
  attention: 'Needs a look',
} as const;

/** Very light "how is today going" rows — no charts, no percentages. */
export function DayPartRows({ parts }: { parts: DayPartSummary[] }) {
  return (
    <View className="gap-3">
      {parts.map((part) => {
        const done = part.state === 'done';
        const attention = part.state === 'attention';

        return (
          <View
            key={part.part}
            className={cn(
              'flex-row items-center gap-4 rounded-3xl border px-5 py-4',
              done
                ? 'border-sage/20 bg-sage-tint'
                : attention
                  ? 'border-gold-soft/60 bg-gold-tint'
                  : 'border-border bg-surface',
            )}
          >
            <View
              className={cn(
                'h-12 w-12 items-center justify-center rounded-full',
                done ? 'bg-sage' : attention ? 'bg-gold' : 'bg-cadet-soft',
              )}
            >
              {done ? (
                <Check color={palette.white} size={24} />
              ) : (
                <Clock color={attention ? palette.white : palette.indigoCloth} size={22} />
              )}
            </View>

            <View className="flex-1">
              <Typography className="text-ink text-2xl font-semibold">
                {dayPartLabel[part.part]}
              </Typography>
              <Typography className="text-ink-soft text-lg">
                {part.total === 0 ? STATE_TEXT.none : STATE_TEXT[part.state]}
              </Typography>
            </View>
          </View>
        );
      })}
    </View>
  );
}
