import { View } from 'react-native';
import { Typography } from 'heroui-native';

import { prettyDay } from '@/lib/time';
import type { Note, NoteCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

const CATEGORY: Record<NoteCategory, { label: string; wrap: string; text: string }> = {
  symptom: { label: 'Symptom', wrap: 'bg-clay-tint', text: 'text-clay-deep' },
  'side-effect': { label: 'Side effect', wrap: 'bg-gold-tint', text: 'text-gold-deep' },
  care: { label: 'Care note', wrap: 'bg-sage-tint', text: 'text-sage-deep' },
  'follow-up': { label: 'Follow-up', wrap: 'bg-ink-tint', text: 'text-ink-soft' },
};

export function NoteRow({ note }: { note: Note }) {
  const meta = CATEGORY[note.category];

  return (
    <View className="border-border bg-surface rounded-3xl border p-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className={cn('rounded-full px-3 py-1', meta.wrap)}>
          <Typography type="body-xs" className={cn('font-semibold', meta.text)}>
            {meta.label}
          </Typography>
        </View>
        <Typography type="body-xs" className="text-ink-soft/60">
          {prettyDay(note.createdAt)} · {note.author}
        </Typography>
      </View>

      <Typography className="text-ink mt-3 font-semibold">{note.title}</Typography>
      <Typography type="body-sm" className="text-ink-soft/90 mt-1">
        {note.body}
      </Typography>
    </View>
  );
}
