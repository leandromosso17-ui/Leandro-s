import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { AlertTriangle, PackageMinus, Phone } from 'lucide-react-native';

import { PersonAvatar } from '@/components/PersonAvatar';
import { ScoreRing } from '@/components/ScoreRing';
import { palette } from '@/lib/theme';

export type OverviewWarning = {
  id: string;
  label: string;
  tone: 'attention' | 'urgent';
};

type Props = {
  name: string;
  relationship: string;
  initials: string;
  score7: number;
  takenToday: number;
  totalToday: number;
  statusLine: string;
  warnings: OverviewWarning[];
  onCall: () => void;
};

/** Priority 1 of the caregiver dashboard: how is Massimo doing right now. */
export function FatherOverviewCard({
  name,
  relationship,
  initials,
  score7,
  takenToday,
  totalToday,
  statusLine,
  warnings,
  onCall,
}: Props) {
  return (
    <View className="border-border bg-surface rounded-3xl border p-5 shadow-sm">
      <View className="flex-row items-center gap-4">
        <PersonAvatar initials={initials} size="lg" />
        <View className="flex-1">
          <Typography type="h3" className="text-ink font-bold">
            {name}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/80">
            {relationship}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft mt-2">
            {statusLine}
          </Typography>
        </View>
      </View>

      <View className="border-separator mt-5 flex-row items-center gap-5 border-t pt-5">
        <ScoreRing score={score7} caption="7 days" />
        <View className="flex-1 gap-1">
          <Typography
            type="body-sm"
            className="text-ink-soft/70 font-semibold tracking-wider uppercase"
          >
            Doses today
          </Typography>
          <Typography type="h3" className="text-ink font-bold">
            {takenToday}
            <Typography type="h5" className="text-ink-soft/70">
              {' '}
              / {totalToday} confirmed
            </Typography>
          </Typography>
          <Button variant="tertiary" size="sm" className="mt-2 self-start" onPress={onCall}>
            <Phone color={palette.incrementalBlue} size={15} />
            <Button.Label>Call {name}</Button.Label>
          </Button>
        </View>
      </View>

      {warnings.length > 0 ? (
        <View className="mt-4 gap-2">
          {warnings.map((warning) => (
            <View
              key={warning.id}
              className={
                warning.tone === 'urgent'
                  ? 'bg-clay-tint flex-row items-center gap-2.5 rounded-2xl px-3.5 py-2.5'
                  : 'bg-gold-tint flex-row items-center gap-2.5 rounded-2xl px-3.5 py-2.5'
              }
            >
              {warning.tone === 'urgent' ? (
                <AlertTriangle color={palette.clay} size={16} />
              ) : (
                <PackageMinus color={palette.goldenMean} size={16} />
              )}
              <Typography
                type="body-sm"
                className={
                  warning.tone === 'urgent'
                    ? 'text-clay-deep flex-1 font-medium'
                    : 'text-gold-deep flex-1 font-medium'
                }
              >
                {warning.label}
              </Typography>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
