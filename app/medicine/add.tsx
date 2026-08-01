import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Description, Input, Label, TextField, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Check, Minus, Plus } from 'lucide-react-native';

import { ChoiceChips, MultiChips } from '@/components/ChoiceChips';
import type { ChipOption } from '@/components/ChoiceChips';
import { PillGraphic } from '@/components/PillGraphic';
import { SectionHeader } from '@/components/SectionHeader';
import { useMedimoStore } from '@/lib/store';
import { palette, pillColorKeys } from '@/lib/theme';
import type { Medication, PillForm } from '@/lib/types';
import { cn } from '@/lib/utils';

const FORM_OPTIONS: ChipOption<PillForm>[] = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'drops', label: 'Drops' },
  { value: 'sachet', label: 'Sachet' },
];

const FOOD_OPTIONS: ChipOption<Medication['foodRule']>[] = [
  { value: 'any-time', label: 'Any time' },
  { value: 'before-food', label: 'Before food' },
  { value: 'with-food', label: 'With food' },
  { value: 'after-food', label: 'After food' },
];

const TIME_OPTIONS = [
  '07:00',
  '08:00',
  '09:00',
  '12:00',
  '12:30',
  '13:00',
  '14:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '21:30',
].map((time) => ({ value: time, label: time }));

const COLOR_KEYS = pillColorKeys;

export default function AddMedicineScreen() {
  const addMedication = useMedimoStore((state) => state.addMedication);
  const seniorPerson = useMedimoStore((state) => state.senior);

  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [purpose, setPurpose] = useState('');
  const [form, setForm] = useState<PillForm>('tablet');
  const [foodRule, setFoodRule] = useState<Medication['foodRule']>('any-time');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [units, setUnits] = useState(1);
  const [packSize, setPackSize] = useState('30');
  const [remaining, setRemaining] = useState('30');
  const [prescriber, setPrescriber] = useState('Dr. Elena Bruni');
  const [color, setColor] = useState<Medication['color']>('blue');
  const [instruction, setInstruction] = useState('');

  const canSave = name.trim().length > 1 && strength.trim().length > 0 && times.length > 0;

  const preview = useMemo(() => {
    const perDay = times.length * units;
    const stock = Number(remaining) || 0;
    const days = perDay > 0 ? Math.floor(stock / perDay) : 0;
    return { perDay, days };
  }, [times.length, units, remaining]);

  const save = () => {
    if (!canSave) return;
    addMedication({
      name: name.trim(),
      strength: strength.trim(),
      purpose: purpose.trim() || 'General care',
      form,
      unitsPerIntake: units,
      times,
      instruction:
        instruction.trim() ||
        `Take ${units} ${form === 'capsule' ? 'capsule' : 'tablet'}${units > 1 ? 's' : ''}`,
      foodRule,
      packSize: Number(packSize) || 30,
      remainingUnits: Number(remaining) || Number(packSize) || 30,
      prescriber: prescriber.trim() || 'Family doctor',
      color,
      createdVia: 'manual',
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="bg-cream flex-1"
    >
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-4 pb-32"
        keyboardShouldPersistTaps="handled"
      >
        <View className="border-border bg-surface flex-row items-center gap-4 rounded-3xl border p-4">
          <PillGraphic color={color} form={form} size="lg" />
          <View className="flex-1">
            <Typography className="text-ink font-semibold">
              {name.trim() || 'New medicine'} {strength}
            </Typography>
            <Typography type="body-sm" className="text-ink-soft/80 mt-0.5">
              {times.length === 0
                ? 'Pick at least one time'
                : `${preview.perDay} per day · ${times.join(', ')}`}
            </Typography>
            <Typography type="body-sm" className="text-ink-soft/80">
              {preview.days > 0 ? `About ${preview.days} days of stock` : 'Stock not set yet'}
            </Typography>
          </View>
        </View>

        <View className="gap-4">
          <SectionHeader title="The medicine" subtitle={`What ${seniorPerson.name} has to take`} />

          <TextField>
            <Label>Name</Label>
            <Input placeholder="Cardiotens" value={name} onChangeText={setName} />
          </TextField>

          <View className="flex-row gap-3">
            <TextField className="flex-1">
              <Label>Strength</Label>
              <Input placeholder="5 mg" value={strength} onChangeText={setStrength} />
            </TextField>
            <TextField className="flex-1">
              <Label>What it is for</Label>
              <Input placeholder="Blood pressure" value={purpose} onChangeText={setPurpose} />
            </TextField>
          </View>

          <View className="gap-2">
            <Label>Form</Label>
            <ChoiceChips options={FORM_OPTIONS} value={form} onChange={(value) => setForm(value)} />
          </View>

          <View className="gap-2">
            <Label>Pill colour in the app</Label>
            <View className="flex-row flex-wrap gap-3">
              {COLOR_KEYS.map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityLabel={`Colour ${key}`}
                  accessibilityState={{ selected: color === key }}
                  onPress={() => setColor(key)}
                  className={cn(
                    'rounded-2xl border-2 p-1',
                    color === key ? 'border-ink' : 'border-transparent',
                  )}
                >
                  <PillGraphic color={key} form={form} size="sm" />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View className="gap-4">
          <SectionHeader title="The schedule" subtitle="Medimo creates the daily doses from this" />

          <View className="gap-2">
            <Label>Times of day</Label>
            <MultiChips
              options={TIME_OPTIONS}
              values={times}
              onToggle={(value) =>
                setTimes((current) =>
                  current.includes(value)
                    ? current.filter((time) => time !== value)
                    : [...current, value].sort((a, b) => a.localeCompare(b)),
                )
              }
            />
            <Description>Pick every moment of the day this medicine is taken.</Description>
          </View>

          <View className="gap-2">
            <Label>Units per intake</Label>
            <View className="flex-row items-center gap-4">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fewer units"
                onPress={() => setUnits((value) => Math.max(1, value - 1))}
                className="border-border bg-surface h-11 w-11 items-center justify-center rounded-2xl border"
              >
                <Minus color={palette.incrementalBlue} size={18} />
              </Pressable>
              <Typography type="h4" className="text-ink w-10 text-center font-bold">
                {units}
              </Typography>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More units"
                onPress={() => setUnits((value) => Math.min(6, value + 1))}
                className="border-border bg-surface h-11 w-11 items-center justify-center rounded-2xl border"
              >
                <Plus color={palette.incrementalBlue} size={18} />
              </Pressable>
            </View>
          </View>

          <View className="gap-2">
            <Label>Food</Label>
            <ChoiceChips
              options={FOOD_OPTIONS}
              value={foodRule}
              onChange={(value) => setFoodRule(value)}
            />
          </View>

          <TextField>
            <Label>Short instruction for Massimo</Label>
            <Input
              placeholder="Take 1 tablet with a glass of water"
              value={instruction}
              onChangeText={setInstruction}
            />
            <Description>Keep it to one simple sentence.</Description>
          </TextField>
        </View>

        <View className="gap-4">
          <SectionHeader title="The box" subtitle="Used for runout dates and refill warnings" />
          <View className="flex-row gap-3">
            <TextField className="flex-1">
              <Label>Pills in a pack</Label>
              <Input
                placeholder="30"
                keyboardType="number-pad"
                value={packSize}
                onChangeText={setPackSize}
              />
            </TextField>
            <TextField className="flex-1">
              <Label>Left right now</Label>
              <Input
                placeholder="30"
                keyboardType="number-pad"
                value={remaining}
                onChangeText={setRemaining}
              />
            </TextField>
          </View>

          <TextField>
            <Label>Prescribed by</Label>
            <Input placeholder="Dr. Elena Bruni" value={prescriber} onChangeText={setPrescriber} />
          </TextField>
        </View>
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-4 border-t px-5 pt-4">
        <Button variant="primary" size="lg" isDisabled={!canSave} onPress={save}>
          <Check color={palette.cream} size={18} />
          <Button.Label>Save medicine and build schedule</Button.Label>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
