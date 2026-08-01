import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Plus, ScanLine } from 'lucide-react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { MedicationCard } from '@/components/caregiver/MedicationCard';
import { useNow } from '@/hooks/useNow';
import { projectInventory } from '@/lib/schedule';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';

export default function CaregiverMedicines() {
  const now = useNow(60_000);
  const medications = useMedimoStore((state) => state.medications);
  const seniorPerson = useMedimoStore((state) => state.senior);

  const rows = useMemo(
    () =>
      medications.map((medication) => ({
        medication,
        projection: projectInventory(medication, now),
      })),
    [medications, now],
  );

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="pt-safe-offset-3 gap-4 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Medicines"
          subtitle={`${medications.length} active medicines for ${seniorPerson.name}`}
        />

        <View className="flex-row gap-3 px-5">
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onPress={() => router.push('/medicine/add')}
          >
            <Plus color={palette.cream} size={16} />
            <Button.Label>Add manually</Button.Label>
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="flex-1"
            onPress={() => router.push('/scan')}
          >
            <ScanLine color={palette.cream} size={16} />
            <Button.Label>Scan sheet</Button.Label>
          </Button>
        </View>

        <View className="gap-3 px-5">
          {rows.map(({ medication, projection }) => (
            <MedicationCard
              key={medication.id}
              medication={medication}
              projection={projection}
              onPress={() => router.push(`/medicine/${medication.id}`)}
            />
          ))}
        </View>

        <View className="border-border bg-surface mx-5 rounded-3xl border px-4 py-4">
          <Typography type="body-sm" className="text-ink font-semibold">
            Schedules are generated automatically
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/80 mt-1">
            Every medicine you add creates its own daily doses, reminders for Massimo and a
            predicted runout date from the remaining stock.
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
}
