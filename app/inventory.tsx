import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { addDays, format } from 'date-fns';
import { router } from 'expo-router';
import { PackagePlus } from 'lucide-react-native';

import { FlashBanner } from '@/components/FlashBanner';
import { SectionHeader } from '@/components/SectionHeader';
import { InventoryRow } from '@/components/caregiver/InventoryRow';
import { useFlash } from '@/hooks/useFlash';
import { useNow } from '@/hooks/useNow';
import { projectInventory } from '@/lib/schedule';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';

export default function InventoryScreen() {
  const now = useNow(60_000);
  const { message, flash } = useFlash();
  const medications = useMedimoStore((state) => state.medications);
  const refillMedication = useMedimoStore((state) => state.refillMedication);
  const addTask = useMedimoStore((state) => state.addTask);

  const rows = useMemo(
    () =>
      medications
        .map((medication) => ({ medication, projection: projectInventory(medication, now) }))
        .sort((a, b) => a.projection.daysLeft - b.projection.daysLeft),
    [medications, now],
  );

  const needsAttention = rows.filter((row) => row.projection.risk !== 'ok');

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="border-border bg-surface rounded-3xl border p-5">
          <Typography type="h4" className="text-ink font-bold">
            {needsAttention.length === 0
              ? 'Every box has enough left'
              : `${needsAttention.length} medicine${needsAttention.length > 1 ? 's' : ''} to refill`}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/85 mt-1">
            Runout dates come from the remaining units and the daily schedule. Gold means plan the
            refill, deeper tones mean act today.
          </Typography>

          {needsAttention.length > 0 ? (
            <Button
              variant="secondary"
              size="md"
              className="mt-4 self-start"
              onPress={() => {
                for (const row of needsAttention) {
                  addTask({
                    kind: 'refill',
                    title: `Refill ${row.medication.name}`,
                    detail: `${row.projection.remainingUnits} units left · about ${row.projection.daysLeft} days of cover.`,
                    dueAt: addDays(now, Math.max(1, row.projection.daysLeft - 1)).toISOString(),
                    medicationId: row.medication.id,
                  });
                }
                flash('Refill tasks added to the care plan');
              }}
            >
              <PackagePlus color={palette.cream} size={16} />
              <Button.Label>Create refill tasks</Button.Label>
            </Button>
          ) : null}
        </View>

        <View className="gap-3">
          <SectionHeader title="All medicines" subtitle="Sorted by how soon they run out" />
          {rows.map(({ medication, projection }) => (
            <InventoryRow
              key={medication.id}
              medication={medication}
              projection={projection}
              onPress={() => router.push(`/medicine/${medication.id}`)}
              onRefill={() => {
                refillMedication(medication.id, medication.packSize);
                flash(`${medication.name}: new pack of ${medication.packSize} added`);
              }}
            />
          ))}
        </View>

        <View className="border-border bg-surface rounded-3xl border p-5">
          <Typography type="body-sm" className="text-ink font-semibold">
            Predicted runout
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/85 mt-1">
            Based on today, {format(now, 'd MMM')}, Medimo recalculates the runout date every time a
            dose is confirmed or a new pack is registered.
          </Typography>
        </View>
      </ScrollView>

      <FlashBanner message={message} />
    </View>
  );
}
