import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Typography } from 'heroui-native';

import { palette } from '@/lib/theme';

type Props = {
  score: number;
  size?: number;
  caption?: string;
};

/** Calm progress ring used for the adherence score. */
export function ScoreRing({ score, size = 76, caption }: Props) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circumference;
  const color = clamped >= 90 ? palette.sage : clamped >= 75 ? palette.goldenMean : palette.clay;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.inkTint}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          fill="none"
        />
      </Svg>
      <Typography className="text-ink font-bold" style={{ fontSize: size * 0.28 }}>
        {clamped}
      </Typography>
      {caption ? (
        <Typography className="text-ink-soft/70" style={{ fontSize: size * 0.13 }}>
          {caption}
        </Typography>
      ) : null}
    </View>
  );
}
