import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { Typography } from 'heroui-native';

import { dayPartLabel } from '@/lib/time';
import { palette } from '@/lib/theme';
import type { DayAdherence, DayPartMisses } from '@/lib/types';
import { cn } from '@/lib/utils';

function scoreTone(score: number): string {
  if (score >= 100) return 'bg-sage';
  if (score >= 60) return 'bg-gold';
  return 'bg-clay';
}

/** 7-day adherence: one column per day, calm and glanceable. */
export function WeekBars({ days }: { days: DayAdherence[] }) {
  const maxHeight = 96;

  return (
    <View className="flex-row items-end justify-between gap-2">
      {days.map((day) => {
        const height = Math.max(6, Math.round((day.score / 100) * maxHeight));
        return (
          <View key={day.dateISO} className="flex-1 items-center gap-2">
            <Typography type="body-xs" className="text-ink-soft/70">
              {day.total === 0 ? '–' : `${day.taken}/${day.total}`}
            </Typography>
            <View
              className="bg-cadet-soft w-full justify-end rounded-xl"
              style={{ height: maxHeight }}
            >
              <View className={cn('w-full rounded-xl', scoreTone(day.score))} style={{ height }} />
            </View>
            <Typography type="body-xs" className="text-ink-soft/70 font-semibold">
              {day.label}
            </Typography>
          </View>
        );
      })}
    </View>
  );
}

/** 30-day trend as a soft area line. */
export function MonthTrend({ days }: { days: DayAdherence[] }) {
  const [width, setWidth] = useState(0);
  const height = 110;

  const points = days.map((day, index) => {
    const x = days.length > 1 ? (index / (days.length - 1)) * width : 0;
    const y = height - (Math.max(0, Math.min(100, day.score)) / 100) * (height - 12) - 6;
    return { x, y };
  });

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <SvgGradient id="trend" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.indigoCloth} stopOpacity="0.28" />
              <Stop offset="1" stopColor={palette.indigoCloth} stopOpacity="0.02" />
            </SvgGradient>
          </Defs>
          <Path d={area} fill="url(#trend)" />
          <Path d={line} stroke={palette.incrementalBlue} strokeWidth={2.5} fill="none" />
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View className="mt-1 flex-row justify-between">
        <Typography type="body-xs" className="text-ink-soft/60">
          30 days ago
        </Typography>
        <Typography type="body-xs" className="text-ink-soft/60">
          Today
        </Typography>
      </View>
    </View>
  );
}

/** Where the misses happen: morning, afternoon or evening. */
export function DayPartBars({ parts }: { parts: DayPartMisses[] }) {
  const worst = Math.max(1, ...parts.map((part) => part.missed));

  return (
    <View className="gap-3">
      {parts.map((part) => {
        const ratio = part.total === 0 ? 0 : part.missed / part.total;
        const width = `${Math.round((part.missed / worst) * 100)}%` as const;

        return (
          <View key={part.part} className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Typography type="body-sm" className="text-ink font-medium">
                {dayPartLabel[part.part]}
              </Typography>
              <Typography type="body-sm" className="text-ink-soft/80">
                {part.missed} missed of {part.total}
                {part.total > 0 ? ` · ${Math.round(ratio * 100)}%` : ''}
              </Typography>
            </View>
            <View className="bg-cadet-soft h-2.5 overflow-hidden rounded-full">
              <View
                className={cn('h-2.5 rounded-full', ratio > 0.15 ? 'bg-clay' : 'bg-gold')}
                style={{ width }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
