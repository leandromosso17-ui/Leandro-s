import type { ComponentType } from 'react';
import { View } from 'react-native';
import { Typography } from 'heroui-native';

import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

type IconProps = { color?: string; size?: number };

type Props = {
  icon: ComponentType<IconProps>;
  title: string;
  body: string;
  className?: string;
};

export function EmptyState({ icon: Icon, title, body, className }: Props) {
  return (
    <View
      className={cn(
        'border-border bg-surface items-center rounded-3xl border px-6 py-10',
        className,
      )}
    >
      <View className="bg-cadet-soft mb-4 h-14 w-14 items-center justify-center rounded-full">
        <Icon color={palette.indigoCloth} size={24} />
      </View>
      <Typography type="h6" className="text-ink text-center font-semibold">
        {title}
      </Typography>
      <Typography type="body-sm" className="text-ink-soft/80 mt-1 text-center">
        {body}
      </Typography>
    </View>
  );
}
