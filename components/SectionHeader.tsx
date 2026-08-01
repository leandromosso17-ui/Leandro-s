import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';
import { ChevronRight } from 'lucide-react-native';

import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function SectionHeader({ title, subtitle, actionLabel, onAction, className }: Props) {
  return (
    <View className={cn('flex-row items-end justify-between gap-3', className)}>
      <View className="flex-1">
        <Typography type="h5" className="text-ink font-semibold">
          {title}
        </Typography>
        {subtitle ? (
          <Typography type="body-sm" className="text-ink-soft/80 mt-0.5">
            {subtitle}
          </Typography>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          className="flex-row items-center gap-1 py-1"
        >
          <Typography type="body-sm" className="text-ink-soft font-semibold">
            {actionLabel}
          </Typography>
          <ChevronRight color={palette.indigoCloth} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}
