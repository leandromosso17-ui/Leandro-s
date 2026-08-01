import { View } from 'react-native';
import { Typography } from 'heroui-native';

import { doseStatusLabel } from '@/lib/schedule';
import type { DoseStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STYLES: Record<DoseStatus, { wrap: string; text: string; dot: string }> = {
  upcoming: { wrap: 'bg-cadet-soft', text: 'text-ink-soft', dot: 'bg-cadet' },
  due: { wrap: 'bg-ink', text: 'text-cream', dot: 'bg-gold-soft' },
  late: { wrap: 'bg-gold-tint', text: 'text-gold-deep', dot: 'bg-gold' },
  taken: { wrap: 'bg-sage-tint', text: 'text-sage-deep', dot: 'bg-sage' },
  missed: { wrap: 'bg-clay-tint', text: 'text-clay-deep', dot: 'bg-clay' },
  skipped: { wrap: 'bg-cadet-soft', text: 'text-ink-soft', dot: 'bg-cadet' },
};

type Props = {
  status: DoseStatus;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function StatusPill({ status, label, size = 'sm', className }: Props) {
  const style = STYLES[status];

  return (
    <View
      className={cn(
        'flex-row items-center self-start rounded-full',
        size === 'lg'
          ? 'gap-2.5 px-4 py-2'
          : size === 'md'
            ? 'gap-2 px-3 py-1.5'
            : 'gap-1.5 px-2.5 py-1',
        style.wrap,
        className,
      )}
    >
      <View className={cn('rounded-full', size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2', style.dot)} />
      <Typography
        className={cn(
          'font-semibold',
          size === 'lg' ? 'text-lg' : size === 'md' ? 'text-sm' : 'text-xs',
          style.text,
        )}
      >
        {label ?? doseStatusLabel[status]}
      </Typography>
    </View>
  );
}
