import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Typography } from 'heroui-native';

import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
};

/** Shared caregiver screen header: calm, generous, no chrome. */
export function ScreenHeader({ title, subtitle, right, className }: Props) {
  return (
    <View className={cn('flex-row items-start justify-between gap-4 px-5 pt-2 pb-4', className)}>
      <View className="flex-1">
        <Typography type="h3" className="text-ink font-bold">
          {title}
        </Typography>
        {subtitle ? (
          <Typography type="body-sm" className="text-ink-soft/80 mt-1">
            {subtitle}
          </Typography>
        ) : null}
      </View>
      {right}
    </View>
  );
}
