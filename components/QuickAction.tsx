import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';

import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

type IconProps = { color?: string; size?: number };

type Props = {
  label: string;
  icon: ComponentType<IconProps>;
  onPress: () => void;
  tone?: 'default' | 'gold';
  disabled?: boolean;
  className?: string;
};

/** Compact icon + label action used by Lorenzo's quick action row. */
export function QuickAction({
  label,
  icon: Icon,
  onPress,
  tone = 'default',
  disabled,
  className,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn('items-center gap-2', disabled && 'opacity-40', className)}
    >
      {({ pressed }) => (
        <>
          <View
            className={cn(
              'h-14 w-14 items-center justify-center rounded-2xl border',
              tone === 'gold' ? 'border-gold-soft bg-gold-tint' : 'border-border bg-surface',
              pressed && 'opacity-70',
            )}
          >
            <Icon
              color={tone === 'gold' ? palette.goldenMean : palette.incrementalBlue}
              size={22}
            />
          </View>
          <Typography type="body-xs" className="text-ink-soft text-center font-medium">
            {label}
          </Typography>
        </>
      )}
    </Pressable>
  );
}
