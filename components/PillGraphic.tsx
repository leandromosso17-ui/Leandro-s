import { View } from 'react-native';

import { palette, type PillColorKey, pillColors } from '@/lib/theme';
import type { PillForm } from '@/lib/types';
import { cn } from '@/lib/utils';

type PillSize = 'sm' | 'md' | 'lg' | 'xl';

const TRAY: Record<PillSize, number> = { sm: 36, md: 48, lg: 68, xl: 128 };

type Props = {
  color: PillColorKey;
  form: PillForm;
  size?: PillSize;
  className?: string;
};

/**
 * Stylised medicine placeholder. Stands in for a real product photo and keeps
 * every medicine visually recognisable for Massimo.
 */
export function PillGraphic({ color, form, size = 'md', className }: Props) {
  const tray = TRAY[size];
  const tint = pillColors[color];
  const unit = tray / 48;

  const body = (() => {
    if (form === 'capsule') {
      const height = 16 * unit;
      const width = 30 * unit;
      return (
        <View
          className="flex-row overflow-hidden"
          style={{ width, height, borderRadius: height / 2 }}
        >
          <View style={{ flex: 1, backgroundColor: tint.cap }} />
          <View style={{ flex: 1, backgroundColor: tint.body }} />
        </View>
      );
    }

    if (form === 'sachet') {
      const side = 24 * unit;
      return (
        <View
          className="items-center justify-center overflow-hidden"
          style={{
            width: side * 1.15,
            height: side,
            borderRadius: 6 * unit,
            backgroundColor: tint.body,
          }}
        >
          <View
            style={{ height: 3 * unit, width: '70%', backgroundColor: tint.cap, borderRadius: 999 }}
          />
        </View>
      );
    }

    if (form === 'drops') {
      const side = 22 * unit;
      return (
        <View
          className="items-center justify-end overflow-hidden"
          style={{
            width: side,
            height: side * 1.2,
            borderTopLeftRadius: side,
            borderTopRightRadius: side,
            borderBottomLeftRadius: side / 3,
            borderBottomRightRadius: side / 3,
            backgroundColor: tint.body,
          }}
        >
          <View
            style={{
              height: side * 0.35,
              width: '100%',
              backgroundColor: tint.cap,
            }}
          />
        </View>
      );
    }

    const diameter = 26 * unit;
    return (
      <View
        className="items-center justify-center"
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: tint.body,
        }}
      >
        <View
          style={{
            width: diameter * 0.62,
            height: Math.max(1, 2 * unit),
            borderRadius: 999,
            backgroundColor: tint.cap,
            opacity: 0.85,
          }}
        />
      </View>
    );
  })();

  return (
    <View
      className={cn('items-center justify-center', className)}
      style={{
        width: tray,
        height: tray,
        borderRadius: tray / 2,
        backgroundColor: palette.cadetSoft,
        borderWidth: 1,
        borderColor: palette.inkTint,
      }}
    >
      {body}
    </View>
  );
}
