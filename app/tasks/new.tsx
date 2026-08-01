import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Input, Label, TextField, Typography } from 'heroui-native';
import { addDays, format, startOfDay } from 'date-fns';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';

import { ChoiceChips } from '@/components/ChoiceChips';
import type { ChipOption } from '@/components/ChoiceChips';
import { useNow } from '@/hooks/useNow';
import { atClock } from '@/lib/time';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import type { CareTaskKind } from '@/lib/types';

const KINDS: ChipOption<CareTaskKind>[] = [
  { value: 'refill', label: 'Refill' },
  { value: 'pickup', label: 'Pharmacy pickup' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'renewal', label: 'Prescription renewal' },
];

const TIMES = ['08:00', '09:00', '10:00', '11:30', '14:00', '16:00', '18:00'].map((time) => ({
  value: time,
  label: time,
}));

export default function NewTaskScreen() {
  const now = useNow(60_000);
  const addTask = useMedimoStore((state) => state.addTask);

  const [kind, setKind] = useState<CareTaskKind>('refill');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [location, setLocation] = useState('');
  const [dayOffset, setDayOffset] = useState('1');
  const [time, setTime] = useState('10:00');

  const dayOptions = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        value: String(index),
        label:
          index === 0
            ? 'Today'
            : index === 1
              ? 'Tomorrow'
              : format(addDays(startOfDay(now), index), 'EEE d MMM'),
      })),
    [now],
  );

  const canSave = title.trim().length > 2;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="bg-cream flex-1"
    >
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-4 pb-32"
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Typography type="h4" className="text-ink font-bold">
            Add a care task
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/85 mt-1">
            Refill errands, pharmacy pickups, doctor appointments and prescription renewals live in
            the same agenda.
          </Typography>
        </View>

        <View className="gap-2">
          <Label>Type</Label>
          <ChoiceChips options={KINDS} value={kind} onChange={(value) => setKind(value)} />
        </View>

        <TextField>
          <Label>Title</Label>
          <Input placeholder="Pick up Ossifort D3" value={title} onChangeText={setTitle} />
        </TextField>

        <TextField>
          <Label>Detail</Label>
          <Input
            placeholder="Ask for the 30 capsule pack"
            value={detail}
            onChangeText={setDetail}
          />
        </TextField>

        <TextField>
          <Label>Where</Label>
          <Input placeholder="Farmacia San Martino" value={location} onChangeText={setLocation} />
        </TextField>

        <View className="gap-2">
          <Label>Day</Label>
          <ChoiceChips options={dayOptions} value={dayOffset} onChange={setDayOffset} />
        </View>

        <View className="gap-2">
          <Label>Time</Label>
          <ChoiceChips options={TIMES} value={time} onChange={setTime} />
        </View>
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-4 border-t px-5 pt-4">
        <Button
          variant="primary"
          size="lg"
          isDisabled={!canSave}
          onPress={() => {
            addTask({
              kind,
              title: title.trim(),
              detail: detail.trim() || 'Added from the care plan',
              location: location.trim() || undefined,
              dueAt: atClock(addDays(startOfDay(now), Number(dayOffset)), time).toISOString(),
            });
            router.back();
          }}
        >
          <Check color={palette.cream} size={18} />
          <Button.Label>Save task</Button.Label>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
