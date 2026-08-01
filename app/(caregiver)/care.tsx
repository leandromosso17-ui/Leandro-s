import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { addDays, format, isSameDay, isToday, isTomorrow, parseISO, startOfDay } from 'date-fns';
import { CalendarPlus, CalendarRange } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { TaskRow } from '@/components/caregiver/TaskRow';
import { useNow } from '@/hooks/useNow';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import { isoDayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

const STRIP_DAYS = 14;

const dayLabel = (iso: string) => {
  const date = parseISO(iso);
  if (isToday(date)) return `Today · ${format(date, 'EEE d MMM')}`;
  if (isTomorrow(date)) return `Tomorrow · ${format(date, 'EEE d MMM')}`;
  return format(date, 'EEEE d MMMM');
};

export default function CaregiverCare() {
  const now = useNow(60_000);
  const tasks = useMedimoStore((state) => state.tasks);
  const toggleTask = useMedimoStore((state) => state.toggleTask);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

  const strip = useMemo(
    () =>
      Array.from({ length: STRIP_DAYS }, (_, index) => {
        const day = addDays(startOfDay(now), index);
        const count = tasks.filter(
          (task) => !task.done && isSameDay(parseISO(task.dueAt), day),
        ).length;
        return { day, iso: day.toISOString(), count };
      }),
    [now, tasks],
  );

  const openTasks = useMemo(
    () => [...tasks].filter((task) => !task.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    if (!selectedISO) return openTasks;
    const selected = parseISO(selectedISO);
    return openTasks.filter((task) => isSameDay(parseISO(task.dueAt), selected));
  }, [openTasks, selectedISO]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visibleTasks>();
    for (const task of visibleTasks) {
      const key = isoDayKey(task.dueAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(task);
      else map.set(key, [task]);
    }
    return [...map.entries()];
  }, [visibleTasks]);

  const doneTasks = useMemo(
    () => [...tasks].filter((task) => task.done).sort((a, b) => b.dueAt.localeCompare(a.dueAt)),
    [tasks],
  );

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="pt-safe-offset-3 gap-6 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Care plan"
          subtitle="Refills, pharmacy pickups, appointments and prescription renewals"
          right={
            <Button size="sm" variant="tertiary" onPress={() => router.push('/tasks/new')}>
              <CalendarPlus color={palette.incrementalBlue} size={15} />
              <Button.Label>New</Button.Label>
            </Button>
          }
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-5"
        >
          {strip.map((entry) => {
            const selected = selectedISO === entry.iso;
            return (
              <Pressable
                key={entry.iso}
                accessibilityRole="button"
                accessibilityLabel={format(entry.day, 'EEEE d MMMM')}
                onPress={() => setSelectedISO(selected ? null : entry.iso)}
                className={cn(
                  'w-14 items-center rounded-2xl border px-2 py-2.5',
                  selected ? 'border-ink bg-ink' : 'border-border bg-surface',
                )}
              >
                <Typography
                  type="body-xs"
                  className={cn('font-semibold', selected ? 'text-cream/80' : 'text-ink-soft/70')}
                >
                  {format(entry.day, 'EEE')}
                </Typography>
                <Typography className={cn('font-bold', selected ? 'text-cream' : 'text-ink')}>
                  {format(entry.day, 'd')}
                </Typography>
                <View
                  className={cn(
                    'mt-1 h-1.5 w-1.5 rounded-full',
                    entry.count > 0 ? (selected ? 'bg-gold-soft' : 'bg-gold') : 'bg-transparent',
                  )}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="gap-3 px-5">
          <SectionHeader
            title={selectedISO ? dayLabel(selectedISO) : 'Coming up'}
            subtitle={
              selectedISO
                ? 'Tap the same day again to see everything'
                : `${openTasks.length} open tasks`
            }
          />

          {grouped.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="Nothing scheduled"
              body="No care tasks for this day. Add a refill errand, an appointment or a renewal."
            />
          ) : (
            grouped.map(([key, dayTasks]) => (
              <View key={key} className="gap-3">
                {!selectedISO ? (
                  <Typography
                    type="body-xs"
                    className="text-ink-soft/70 mt-1 font-semibold tracking-widest uppercase"
                  >
                    {dayLabel(dayTasks[0].dueAt)}
                  </Typography>
                ) : null}
                {dayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
                ))}
              </View>
            ))
          )}
        </View>

        {doneTasks.length > 0 ? (
          <View className="gap-3 px-5">
            <SectionHeader title="Done" subtitle="Recently completed errands" />
            {doneTasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
