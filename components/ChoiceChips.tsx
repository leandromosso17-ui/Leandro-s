import { Pressable, View } from 'react-native';
import { Typography } from 'heroui-native';

import { cn } from '@/lib/utils';

export type ChipOption<T extends string = string> = { value: T; label: string };

type SingleProps<T extends string> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

type MultiProps<T extends string> = {
  options: ChipOption<T>[];
  values: T[];
  onToggle: (value: T) => void;
  className?: string;
};

function chipClass(active: boolean) {
  return cn(
    'rounded-full border px-4 py-2',
    active ? 'border-ink bg-ink' : 'border-border bg-surface',
  );
}

function labelClass(active: boolean) {
  return cn('font-semibold', active ? 'text-cream' : 'text-ink-soft');
}

export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: SingleProps<T>) {
  return (
    <View className={cn('flex-row flex-wrap gap-2', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={chipClass(active)}
          >
            <Typography type="body-sm" className={labelClass(active)}>
              {option.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MultiChips<T extends string>({
  options,
  values,
  onToggle,
  className,
}: MultiProps<T>) {
  return (
    <View className={cn('flex-row flex-wrap gap-2', className)}>
      {options.map((option) => {
        const active = values.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            onPress={() => onToggle(option.value)}
            className={chipClass(active)}
          >
            <Typography type="body-sm" className={labelClass(active)}>
              {option.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}
