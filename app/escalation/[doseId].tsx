import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { addMinutes, parseISO } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { MessageSquare, Phone, Server } from 'lucide-react-native';

import { FlashBanner } from '@/components/FlashBanner';
import { PillGraphic } from '@/components/PillGraphic';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusPill } from '@/components/StatusPill';
import { ReminderTimeline } from '@/components/caregiver/ReminderTimeline';
import { useFlash } from '@/hooks/useFlash';
import { useNow } from '@/hooks/useNow';
import { doseStatus, ESCALATION } from '@/lib/schedule';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import { prettyDay, prettyTime, relativeMinutes } from '@/lib/time';

export default function EscalationScreen() {
  const { doseId } = useLocalSearchParams<{ doseId: string }>();
  const now = useNow(10_000);
  const { message, flash } = useFlash();

  const doses = useMedimoStore((state) => state.doses);
  const medications = useMedimoStore((state) => state.medications);
  const reminders = useMedimoStore((state) => state.reminders);
  const busyDoseId = useMedimoStore((state) => state.busyDoseId);
  const sendSmsReminder = useMedimoStore((state) => state.sendSmsReminder);
  const placeEscalationCall = useMedimoStore((state) => state.placeEscalationCall);
  const seniorPerson = useMedimoStore((state) => state.senior);

  const dose = useMemo(() => doses.find((item) => item.id === doseId), [doses, doseId]);
  const medication = useMemo(
    () => medications.find((item) => item.id === dose?.medicationId),
    [medications, dose],
  );
  const events = useMemo(
    () =>
      reminders.filter((event) => event.doseId === doseId).sort((a, b) => a.at.localeCompare(b.at)),
    [reminders, doseId],
  );

  if (!dose || !medication) {
    return (
      <View className="bg-cream flex-1 items-center justify-center px-8">
        <Typography className="text-ink-soft text-center">
          This dose is no longer scheduled.
        </Typography>
      </View>
    );
  }

  const status = doseStatus(dose, now);
  const scheduled = parseISO(dose.scheduledFor);
  const smsAt = addMinutes(scheduled, ESCALATION.smsAfterMinutes);
  const callAt = addMinutes(smsAt, ESCALATION.callAfterSmsMinutes);
  const busy = busyDoseId === dose.id;

  const nextStep =
    dose.outcome === 'taken'
      ? 'Confirmed — the ladder stopped here.'
      : now < smsAt
        ? `SMS reminder ${relativeMinutes(smsAt.toISOString(), now)}`
        : now < callAt
          ? `Voice call ${relativeMinutes(callAt.toISOString(), now)}`
          : 'All automatic steps are done — a personal call is the next move.';

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="border-border bg-surface rounded-3xl border p-5">
          <View className="flex-row items-center gap-4">
            <PillGraphic color={medication.color} form={medication.form} size="lg" />
            <View className="flex-1">
              <Typography type="h5" className="text-ink font-semibold">
                {medication.name} {medication.strength}
              </Typography>
              <Typography type="body-sm" className="text-ink-soft/80 mt-0.5">
                {prettyDay(dose.scheduledFor)} · {prettyTime(dose.scheduledFor)} · {dose.units}{' '}
                {medication.form}
              </Typography>
              <View className="mt-2">
                <StatusPill status={status} />
              </View>
            </View>
          </View>

          <View className="bg-gold-tint mt-4 rounded-2xl px-4 py-3">
            <Typography type="body-sm" className="text-gold-deep font-semibold">
              {nextStep}
            </Typography>
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader title="What Medimo did" subtitle="Reminder ladder for this dose" />
          <View className="border-border bg-surface rounded-3xl border p-5">
            {events.length === 0 ? (
              <Typography className="text-ink-soft">
                No reminder has been sent for this dose yet.
              </Typography>
            ) : (
              <ReminderTimeline events={events} />
            )}
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader title="Step in yourself" subtitle="Run the next step now" />
          <View className="gap-3">
            <Button
              variant="primary"
              size="lg"
              onPress={() => router.push(`/confirm/${dose.id}?actor=caregiver`)}
            >
              <Button.Label>Mark this dose as taken</Button.Label>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              isDisabled={busy}
              onPress={() => {
                void sendSmsReminder(dose.id);
                flash(`SMS sent to ${seniorPerson.name}`);
              }}
            >
              <MessageSquare color={palette.cream} size={18} />
              <Button.Label>Send the SMS now</Button.Label>
            </Button>
            <Button
              variant="tertiary"
              size="lg"
              isDisabled={busy}
              onPress={() => {
                void placeEscalationCall(dose.id);
                flash('Voice agent is calling Massimo');
              }}
            >
              <Phone color={palette.incrementalBlue} size={18} />
              <Button.Label>Start the voice call now</Button.Label>
            </Button>
          </View>
        </View>

        <View className="border-border bg-surface rounded-3xl border p-5">
          <View className="flex-row items-center gap-2.5">
            <Server color={palette.indigoCloth} size={18} />
            <Typography className="text-ink font-semibold">Integration placeholders</Typography>
          </View>
          <Typography type="body-sm" className="text-ink-soft/85 mt-2">
            SMS runs through the provider in lib/services/sms.ts and the call through the ElevenLabs
            agent in lib/services/voice.ts. Both use mocked responses until the backend endpoints
            are configured.
          </Typography>
        </View>
      </ScrollView>

      <FlashBanner message={message} />
    </View>
  );
}
