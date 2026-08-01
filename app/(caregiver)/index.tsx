import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Typography } from 'heroui-native';
import { router } from 'expo-router';
import {
  ArrowLeftRight,
  BellRing,
  CheckCheck,
  NotebookPen,
  PackagePlus,
  Phone,
} from 'lucide-react-native';

import { FlashBanner } from '@/components/FlashBanner';
import { QuickAction } from '@/components/QuickAction';
import { SectionHeader } from '@/components/SectionHeader';
import { AlertList } from '@/components/caregiver/AlertList';
import { DayPartBars, MonthTrend, WeekBars } from '@/components/caregiver/AdherenceCharts';
import { DoseTimelineRow } from '@/components/caregiver/DoseTimelineRow';
import {
  FatherOverviewCard,
  type OverviewWarning,
} from '@/components/caregiver/FatherOverviewCard';
import { InventoryRow } from '@/components/caregiver/InventoryRow';
import { NoteRow } from '@/components/caregiver/NoteRow';
import { TaskRow } from '@/components/caregiver/TaskRow';
import { useFlash } from '@/hooks/useFlash';
import { useNow } from '@/hooks/useNow';
import {
  activeDose,
  adherence,
  adherenceByDay,
  doseStatus,
  doseStatusLabel,
  dosesOn,
  missesByDayPart,
  nextUpcomingDose,
  projectInventory,
} from '@/lib/schedule';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import { greetingFor, prettyDayLong } from '@/lib/time';

export default function CaregiverDashboard() {
  const now = useNow();
  const { message, flash } = useFlash();

  const caregiverPerson = useMedimoStore((state) => state.caregiver);
  const seniorPerson = useMedimoStore((state) => state.senior);
  const medications = useMedimoStore((state) => state.medications);
  const doses = useMedimoStore((state) => state.doses);
  const alerts = useMedimoStore((state) => state.alerts);
  const tasks = useMedimoStore((state) => state.tasks);
  const notes = useMedimoStore((state) => state.notes);
  const busyDoseId = useMedimoStore((state) => state.busyDoseId);
  const sendSmsReminder = useMedimoStore((state) => state.sendSmsReminder);
  const placeEscalationCall = useMedimoStore((state) => state.placeEscalationCall);
  const toggleTask = useMedimoStore((state) => state.toggleTask);

  const medById = useMemo(
    () => new Map(medications.map((medication) => [medication.id, medication])),
    [medications],
  );

  const todayDoses = useMemo(() => dosesOn(doses, now), [doses, now]);
  const week = useMemo(() => adherenceByDay(doses, now, 7), [doses, now]);
  const month = useMemo(() => adherenceByDay(doses, now, 30), [doses, now]);
  const parts = useMemo(() => missesByDayPart(doses, now, 30), [doses, now]);
  const score7 = useMemo(() => adherence(doses, now, 7).score, [doses, now]);
  const score30 = useMemo(() => adherence(doses, now, 30), [doses, now]);

  const projections = useMemo(
    () =>
      medications
        .map((medication) => projectInventory(medication, now))
        .sort((a, b) => a.daysLeft - b.daysLeft),
    [medications, now],
  );

  const openAlerts = useMemo(() => alerts.filter((alert) => !alert.acknowledged), [alerts]);

  const upcomingTasks = useMemo(
    () =>
      [...tasks]
        .filter((task) => !task.done)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, 2),
    [tasks],
  );

  const recentNotes = useMemo(
    () => [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2),
    [notes],
  );

  const todayStats = useMemo(() => {
    let taken = 0;
    let problem = 0;
    let pending = 0;

    for (const dose of todayDoses) {
      const status = doseStatus(dose, now);
      if (status === 'taken') taken += 1;
      else if (status === 'late' || status === 'missed') problem += 1;
      else pending += 1;
    }

    return { taken, problem, pending };
  }, [todayDoses, now]);

  const warnings = useMemo<OverviewWarning[]>(() => {
    const list: OverviewWarning[] = [];

    for (const dose of todayDoses) {
      const status = doseStatus(dose, now);
      if (status !== 'late' && status !== 'missed') continue;
      const medication = medById.get(dose.medicationId);
      if (!medication) continue;
      list.push({
        id: `dose-${dose.id}`,
        tone: 'urgent',
        label: `${medication.name} ${medication.strength} · ${doseStatusLabel[status].toLowerCase()}`,
      });
    }

    for (const projection of projections) {
      if (projection.risk !== 'critical') continue;
      const medication = medById.get(projection.medicationId);
      if (!medication) continue;
      list.push({
        id: `stock-${projection.medicationId}`,
        tone: 'attention',
        label: `${medication.name}: ${projection.remainingUnits} left, ${
          projection.daysLeft === 0 ? 'runs out today' : `about ${projection.daysLeft} days`
        }`,
      });
    }

    return list.slice(0, 3);
  }, [todayDoses, now, medById, projections]);

  const statusLine =
    todayStats.problem > 0
      ? `${todayStats.problem} dose${todayStats.problem > 1 ? 's' : ''} need attention right now`
      : todayStats.pending > 0
        ? `${todayStats.pending} dose${todayStats.pending > 1 ? 's' : ''} still ahead today`
        : 'Everything is confirmed for today';

  const focusDose = useMemo(
    () => activeDose(todayDoses, now) ?? nextUpcomingDose(todayDoses, now),
    [todayDoses, now],
  );

  const handleCall = () => {
    if (focusDose) {
      void placeEscalationCall(focusDose.id);
      flash(`Calling ${seniorPerson.name} about the next dose`);
      return;
    }
    flash(`Calling ${seniorPerson.name} (mock call)`);
  };

  const handleReminder = () => {
    if (!focusDose) {
      flash('No dose to remind about right now');
      return;
    }
    void sendSmsReminder(focusDose.id);
    flash('SMS reminder sent to Massimo');
  };

  const handleMarkDose = () => {
    if (!focusDose) {
      flash('Nothing left to confirm today');
      return;
    }
    router.push(`/confirm/${focusDose.id}?actor=caregiver`);
  };

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="pt-safe-offset-3 gap-7 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-start justify-between gap-3 px-5">
          <View className="flex-1">
            <Typography
              type="body-sm"
              className="text-ink-soft/70 font-semibold tracking-widest uppercase"
            >
              {prettyDayLong(now.toISOString())}
            </Typography>
            <Typography type="h2" className="text-ink mt-1 font-bold">
              {greetingFor(now)}, {caregiverPerson.name}
            </Typography>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch role"
            onPress={() => router.replace('/')}
            className="border-border bg-surface h-11 w-11 items-center justify-center rounded-2xl border"
          >
            <ArrowLeftRight color={palette.indigoCloth} size={18} />
          </Pressable>
        </View>

        <View className="px-5">
          <FatherOverviewCard
            name={seniorPerson.name}
            relationship={seniorPerson.relationship}
            initials={seniorPerson.avatarInitials}
            score7={score7}
            takenToday={todayStats.taken}
            totalToday={todayDoses.length}
            statusLine={statusLine}
            warnings={warnings}
            onCall={handleCall}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-5 px-5"
        >
          <QuickAction label={`Call ${seniorPerson.name}`} icon={Phone} onPress={handleCall} />
          <QuickAction label="Send reminder" icon={BellRing} onPress={handleReminder} tone="gold" />
          <QuickAction label="Mark dose" icon={CheckCheck} onPress={handleMarkDose} />
          <QuickAction
            label="Add note"
            icon={NotebookPen}
            onPress={() => router.push('/notes/new')}
          />
          <QuickAction
            label="Start refill"
            icon={PackagePlus}
            onPress={() => router.push('/inventory')}
          />
        </ScrollView>

        <View className="gap-3 px-5">
          <SectionHeader
            title="Today's doses"
            subtitle={`${todayStats.taken} confirmed · ${todayStats.pending} ahead · ${todayStats.problem} to chase`}
          />
          {todayDoses.map((dose) => {
            const medication = medById.get(dose.medicationId);
            if (!medication) return null;
            return (
              <DoseTimelineRow
                key={dose.id}
                dose={dose}
                medication={medication}
                status={doseStatus(dose, now)}
                now={now}
                busy={busyDoseId === dose.id}
                onMarkTaken={() => router.push(`/confirm/${dose.id}?actor=caregiver`)}
                onRemind={() => {
                  void sendSmsReminder(dose.id);
                  flash(`Reminder sent for ${medication.name}`);
                }}
                onOpenLadder={() => router.push(`/escalation/${dose.id}`)}
              />
            );
          })}
        </View>

        <View className="gap-3 px-5">
          <SectionHeader
            title="Alerts & escalation"
            subtitle={
              openAlerts.length === 0 ? 'Nothing open right now' : `${openAlerts.length} open`
            }
            actionLabel="All alerts"
            onAction={() => router.push('/(caregiver)/alerts')}
          />
          {openAlerts.length === 0 ? (
            <View className="border-border bg-surface rounded-3xl border px-4 py-5">
              <Typography className="text-ink-soft">
                No missed doses and no urgent issues. Massimo is on track.
              </Typography>
            </View>
          ) : (
            <AlertList alerts={openAlerts.slice(0, 2)} onFlash={flash} />
          )}
        </View>

        <View className="gap-3 px-5">
          <SectionHeader
            title="Inventory & refills"
            subtitle="Stock, runout dates and refill risk"
            actionLabel="Open"
            onAction={() => router.push('/inventory')}
          />
          {projections.slice(0, 2).map((projection) => {
            const medication = medById.get(projection.medicationId);
            if (!medication) return null;
            return (
              <InventoryRow
                key={projection.medicationId}
                medication={medication}
                projection={projection}
                onPress={() => router.push(`/medicine/${medication.id}`)}
              />
            );
          })}
        </View>

        <View className="gap-3 px-5">
          <SectionHeader title="Adherence" subtitle="How the last weeks went" />
          <View className="border-border bg-surface gap-6 rounded-3xl border p-5">
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Typography className="text-ink font-semibold">Last 7 days</Typography>
                <Typography className="text-ink-soft font-semibold">{score7}%</Typography>
              </View>
              <WeekBars days={week} />
            </View>

            <View className="border-separator gap-3 border-t pt-5">
              <View className="flex-row items-center justify-between">
                <Typography className="text-ink font-semibold">Last 30 days</Typography>
                <Typography className="text-ink-soft font-semibold">
                  {score30.score}% · {score30.missed} missed
                </Typography>
              </View>
              <MonthTrend days={month} />
            </View>

            <View className="border-separator gap-3 border-t pt-5">
              <Typography className="text-ink font-semibold">
                Missed doses by time of day
              </Typography>
              <DayPartBars parts={parts} />
            </View>
          </View>
        </View>

        <View className="gap-3 px-5">
          <SectionHeader
            title="Appointments & care tasks"
            subtitle="Next things on your list"
            actionLabel="Care plan"
            onAction={() => router.push('/(caregiver)/care')}
          />
          {upcomingTasks.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
          ))}
        </View>

        <View className="gap-3 px-5">
          <SectionHeader
            title="Notes & symptoms"
            subtitle="Short observations you logged"
            actionLabel="All notes"
            onAction={() => router.push('/(caregiver)/notes')}
          />
          {recentNotes.map((note) => (
            <NoteRow key={note.id} note={note} />
          ))}
        </View>
      </ScrollView>

      <FlashBanner message={message} />
    </View>
  );
}
