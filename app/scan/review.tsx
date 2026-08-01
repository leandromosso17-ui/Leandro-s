import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { format, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { Check, FileWarning } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { PillGraphic } from '@/components/PillGraphic';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

export default function ScanReviewScreen() {
  const pendingScan = useMedimoStore((state) => state.pendingScan);
  const applyScan = useMedimoStore((state) => state.applyScan);
  const setPendingScan = useMedimoStore((state) => state.setPendingScan);

  const [excluded, setExcluded] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const selected = useMemo(
    () =>
      pendingScan ? pendingScan.medicines.filter((item) => !excluded.includes(item.name)) : [],
    [pendingScan, excluded],
  );

  if (!pendingScan) {
    return (
      <View className="bg-cream flex-1 px-5 pt-8">
        <EmptyState
          icon={FileWarning}
          title="Nothing to review"
          body="Scan a prescription first and the extracted medicines will show up here."
        />
        <Button
          variant="primary"
          size="lg"
          className="mt-6"
          onPress={() => router.replace('/scan')}
        >
          <Button.Label>Scan a prescription</Button.Label>
        </Button>
      </View>
    );
  }

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-4 pb-40"
        showsVerticalScrollIndicator={false}
      >
        <View className="border-border bg-surface rounded-3xl border p-5">
          <Typography type="h4" className="text-ink font-bold">
            {pendingScan.medicines.length} medicines found
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/85 mt-1">
            From {pendingScan.sourceLabel.toLowerCase()} ·{' '}
            {format(parseISO(pendingScan.scannedAt), 'd MMM, HH:mm')}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/85 mt-3">
            Check the details before they are added. Tap a card to leave it out.
          </Typography>
        </View>

        {pendingScan.medicines.map((medicine) => {
          const isExcluded = excluded.includes(medicine.name);
          return (
            <Pressable
              key={medicine.name}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !isExcluded }}
              onPress={() =>
                setExcluded((current) =>
                  current.includes(medicine.name)
                    ? current.filter((name) => name !== medicine.name)
                    : [...current, medicine.name],
                )
              }
              className={cn(
                'rounded-3xl border p-4',
                isExcluded ? 'border-border bg-surface opacity-50' : 'border-ink/15 bg-surface',
              )}
            >
              <View className="flex-row items-center gap-3">
                <PillGraphic color={medicine.color} form={medicine.form} size="lg" />
                <View className="flex-1">
                  <Typography type="h6" className="text-ink font-semibold">
                    {medicine.name} {medicine.strength}
                  </Typography>
                  <Typography type="body-sm" className="text-ink-soft/80 mt-0.5">
                    {medicine.purpose} · {medicine.frequencyLabel}
                  </Typography>
                </View>
                <View
                  className={cn(
                    'h-7 w-7 items-center justify-center rounded-full border',
                    isExcluded ? 'border-cadet bg-transparent' : 'border-ink bg-ink',
                  )}
                >
                  {isExcluded ? null : <Check color={palette.cream} size={15} />}
                </View>
              </View>

              <View className="border-separator mt-4 gap-2 border-t pt-3">
                <DetailRow
                  label="Dose"
                  value={`${medicine.unitsPerIntake} ${medicine.form} per intake`}
                />
                <DetailRow label="Schedule" value={medicine.times.join(', ')} />
                <DetailRow label="Pills in the box" value={`${medicine.packSize}`} />
                <DetailRow
                  label="Predicted runout"
                  value={format(parseISO(medicine.predictedRunoutISO), 'EEE d MMM')}
                />
                <DetailRow label="Instruction" value={medicine.instruction} />
                <DetailRow label="Prescriber" value={medicine.prescriber} />
                <DetailRow
                  label="Reading confidence"
                  value={`${Math.round(medicine.confidence * 100)}%`}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-4 border-t px-5 pt-4">
        {confirming ? (
          <View className="gap-3">
            <Typography className="text-ink font-semibold">
              Add {selected.length} medicine{selected.length > 1 ? 's' : ''} to Massimo&apos;s plan?
            </Typography>
            <Typography type="body-sm" className="text-ink-soft/85">
              Medimo will create the daily doses, the reminders and the runout dates.
            </Typography>
            <View className="mt-1 flex-row gap-3">
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onPress={() => {
                  applyScan(selected);
                  router.back();
                }}
              >
                <Button.Label>Yes, add them</Button.Label>
              </Button>
              <Button variant="ghost" size="lg" onPress={() => setConfirming(false)}>
                <Button.Label>Go back</Button.Label>
              </Button>
            </View>
          </View>
        ) : (
          <View className="gap-3">
            <Button
              variant="primary"
              size="lg"
              isDisabled={selected.length === 0}
              onPress={() => setConfirming(true)}
            >
              <Button.Label>
                Review and add {selected.length} medicine{selected.length === 1 ? '' : 's'}
              </Button.Label>
            </Button>
            <Button
              variant="ghost"
              size="md"
              onPress={() => {
                setPendingScan(null);
                router.back();
              }}
            >
              <Button.Label>Discard this scan</Button.Label>
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Typography type="body-sm" className="text-ink-soft/70">
        {label}
      </Typography>
      <Typography type="body-sm" className="text-ink flex-1 text-right font-medium">
        {value}
      </Typography>
    </View>
  );
}
