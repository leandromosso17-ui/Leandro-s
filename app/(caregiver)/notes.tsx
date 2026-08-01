import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { NotebookPen, PenLine } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NoteRow } from '@/components/caregiver/NoteRow';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import type { NoteCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

const FILTERS: { key: NoteCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'symptom', label: 'Symptoms' },
  { key: 'side-effect', label: 'Side effects' },
  { key: 'care', label: 'Care notes' },
  { key: 'follow-up', label: 'Follow-ups' },
];

export default function CaregiverNotes() {
  const notes = useMedimoStore((state) => state.notes);
  const [filter, setFilter] = useState<NoteCategory | 'all'>('all');

  const visible = useMemo(() => {
    const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return filter === 'all' ? sorted : sorted.filter((note) => note.category === filter);
  }, [notes, filter]);

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="pt-safe-offset-3 gap-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Notes & symptoms"
          subtitle="Short observations, side effects and things to ask the doctor"
          right={
            <Button size="sm" variant="tertiary" onPress={() => router.push('/notes/new')}>
              <PenLine color={palette.incrementalBlue} size={15} />
              <Button.Label>New</Button.Label>
            </Button>
          }
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-5"
        >
          {FILTERS.map((option) => {
            const active = filter === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                onPress={() => setFilter(option.key)}
                className={cn(
                  'rounded-full border px-4 py-2',
                  active ? 'border-ink bg-ink' : 'border-border bg-surface',
                )}
              >
                <Typography
                  type="body-sm"
                  className={cn('font-semibold', active ? 'text-cream' : 'text-ink-soft')}
                >
                  {option.label}
                </Typography>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="gap-3 px-5">
          {visible.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No notes yet"
              body="Log a symptom, a side effect or something to follow up with the doctor."
            />
          ) : (
            visible.map((note) => <NoteRow key={note.id} note={note} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}
