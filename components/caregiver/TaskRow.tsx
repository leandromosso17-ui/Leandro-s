import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { CalendarCheck, ClipboardPen, Pill, ShoppingBag, Stethoscope } from 'lucide-react-native';

import { prettyDay, prettyTime } from '@/lib/time';
import { palette } from '@/lib/theme';
import type { CareTask } from '@/lib/types';
import { cn } from '@/lib/utils';

const KIND = {
  refill: { icon: Pill, label: 'Refill' },
  appointment: { icon: Stethoscope, label: 'Appointment' },
  renewal: { icon: ClipboardPen, label: 'Prescription' },
  pickup: { icon: ShoppingBag, label: 'Pharmacy' },
} as const;

type Props = {
  task: CareTask;
  onToggle: () => void;
};

export function TaskRow({ task, onToggle }: Props) {
  const meta = KIND[task.kind];
  const Icon = task.done ? CalendarCheck : meta.icon;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`}
      className={cn(
        'border-border bg-surface flex-row items-start gap-3 rounded-3xl border p-4',
        task.done && 'opacity-60',
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded-2xl',
          task.done ? 'bg-sage-tint' : 'bg-cadet-soft',
        )}
      >
        <Icon color={task.done ? palette.sage : palette.indigoCloth} size={18} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Typography
            type="body-xs"
            className="text-ink-soft/70 font-semibold tracking-wider uppercase"
          >
            {meta.label}
          </Typography>
          <Typography type="body-xs" className="text-ink-soft/60">
            {prettyDay(task.dueAt)} · {prettyTime(task.dueAt)}
          </Typography>
        </View>
        <Typography className={cn('text-ink mt-1 font-semibold', task.done && 'line-through')}>
          {task.title}
        </Typography>
        <Typography type="body-sm" className="text-ink-soft/80 mt-0.5">
          {task.detail}
        </Typography>
        {task.location ? (
          <Typography type="body-xs" className="text-ink-soft/60 mt-1.5">
            {task.location}
          </Typography>
        ) : null}
      </View>
    </Pressable>
  );
}
