import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Description, Input, Label, TextArea, TextField, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';

import { ChoiceChips } from '@/components/ChoiceChips';
import type { ChipOption } from '@/components/ChoiceChips';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import type { NoteCategory } from '@/lib/types';

const CATEGORIES: ChipOption<NoteCategory>[] = [
  { value: 'symptom', label: 'Symptom' },
  { value: 'side-effect', label: 'Side effect' },
  { value: 'care', label: 'Care note' },
  { value: 'follow-up', label: 'Follow-up' },
];

export default function NewNoteScreen() {
  const addNote = useMedimoStore((state) => state.addNote);
  const seniorPerson = useMedimoStore((state) => state.senior);

  const [category, setCategory] = useState<NoteCategory>('symptom');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

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
            What did you notice?
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/85 mt-1">
            Keep it short. Notes help you remember what to tell {seniorPerson.name}&apos;s doctor.
          </Typography>
        </View>

        <View className="gap-2">
          <Label>Type of note</Label>
          <ChoiceChips
            options={CATEGORIES}
            value={category}
            onChange={(value) => setCategory(value)}
          />
        </View>

        <TextField>
          <Label>Title</Label>
          <Input
            placeholder="Light dizziness after breakfast"
            value={title}
            onChangeText={setTitle}
          />
        </TextField>

        <TextField>
          <Label>Details</Label>
          <TextArea
            placeholder="What happened, when, and how long it lasted."
            value={body}
            onChangeText={setBody}
            numberOfLines={5}
          />
          <Description>Optional, but useful before an appointment.</Description>
        </TextField>
      </ScrollView>

      <View className="border-border bg-surface pb-safe-offset-4 border-t px-5 pt-4">
        <Button
          variant="primary"
          size="lg"
          isDisabled={!canSave}
          onPress={() => {
            addNote({ category, title: title.trim(), body: body.trim() });
            router.back();
          }}
        >
          <Check color={palette.cream} size={18} />
          <Button.Label>Save note</Button.Label>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
