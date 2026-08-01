import { Typography } from 'heroui-native';

import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

const SIZES = { sm: 40, md: 56, lg: 76 } as const;

type Props = {
  initials: string;
  size?: keyof typeof SIZES;
  className?: string;
};

export function PersonAvatar({ initials, size = 'md', className }: Props) {
  const diameter = SIZES[size];

  return (
    <LinearGradient
      colors={[palette.indigoCloth, palette.incrementalBlue]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={cn('items-center justify-center', className)}
      style={{ width: diameter, height: diameter, borderRadius: diameter / 2 }}
    >
      <Typography
        className="text-cream font-semibold"
        style={{ fontSize: diameter * 0.42, lineHeight: diameter * 0.52 }}
      >
        {initials}
      </Typography>
    </LinearGradient>
  );
}
