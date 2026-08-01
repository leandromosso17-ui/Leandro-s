import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { BellRing, MessageSquare, Phone, ShieldCheck } from 'lucide-react-native';

import { EmptyState } from '@/components/EmptyState';
import { FlashBanner } from '@/components/FlashBanner';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { AlertList } from '@/components/caregiver/AlertList';
import { ReminderTimeline } from '@/components/caregiver/ReminderTimeline';
import { useFlash } from '@/hooks/useFlash';
import { ESCALATION } from '@/lib/schedule';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';

export default function CaregiverAlerts() {
  const { message, flash } = useFlash();
  const alerts = useMedimoStore((state) => state.alerts);
  const reminders = useMedimoStore((state) => state.reminders);
  const acknowledgeAllAlerts = useMedimoStore((state) => state.acknowledgeAllAlerts);

  const openAlerts = useMemo(
    () =>
      [...alerts]
        .filter((alert) => !alert.acknowledged)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [alerts],
  );

  const handledAlerts = useMemo(
    () =>
      [...alerts]
        .filter((alert) => alert.acknowledged)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [alerts],
  );

  const activity = useMemo(
    () => [...reminders].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8),
    [reminders],
  );

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="pt-safe-offset-3 gap-7 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Alerts & escalation"
          subtitle={
            openAlerts.length === 0
              ? 'Nothing needs your attention'
              : `${openAlerts.length} open · handled automatically until you step in`
          }
          right={
            openAlerts.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  acknowledgeAllAlerts();
                  flash('All alerts marked as handled');
                }}
              >
                <Button.Label>Clear all</Button.Label>
              </Button>
            ) : undefined
          }
        />

        <View className="border-border bg-surface mx-5 rounded-3xl border p-5">
          <View className="flex-row items-center gap-2.5">
            <ShieldCheck color={palette.indigoCloth} size={18} />
            <Typography className="text-ink font-semibold">How escalation works</Typography>
          </View>
          <View className="mt-4 gap-3">
            <LadderStep
              icon={BellRing}
              title="Reminder on Massimo's phone"
              detail="At the scheduled time, with sound and vibration."
            />
            <LadderStep
              icon={MessageSquare}
              title={`SMS after ${ESCALATION.smsAfterMinutes} minutes`}
              detail="A short, friendly text if the dose is still not confirmed."
            />
            <LadderStep
              icon={Phone}
              title={`Voice call ${ESCALATION.callAfterSmsMinutes} minutes later`}
              detail="An ElevenLabs voice agent calls him, then reports back to you."
            />
          </View>
        </View>

        <View className="gap-3 px-5">
          <SectionHeader
            title="Open alerts"
            subtitle="Missed doses, repeated misses and low stock"
          />
          {openAlerts.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="All calm"
              body="No missed doses, no repeated misses and no urgent refills right now."
            />
          ) : (
            <AlertList alerts={openAlerts} onFlash={flash} />
          )}
        </View>

        {handledAlerts.length > 0 ? (
          <View className="gap-3 px-5">
            <SectionHeader title="Handled" subtitle="Recently resolved" />
            <AlertList alerts={handledAlerts} onFlash={flash} />
          </View>
        ) : null}

        <View className="gap-3 px-5">
          <SectionHeader title="Reminder activity" subtitle="Everything Medimo sent recently" />
          <View className="border-border bg-surface rounded-3xl border p-5">
            <ReminderTimeline events={activity} showDate />
          </View>
        </View>
      </ScrollView>

      <FlashBanner message={message} />
    </View>
  );
}

type LadderStepProps = {
  icon: typeof BellRing;
  title: string;
  detail: string;
};

function LadderStep({ icon: Icon, title, detail }: LadderStepProps) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="bg-cadet-soft h-9 w-9 items-center justify-center rounded-full">
        <Icon color={palette.indigoCloth} size={16} />
      </View>
      <View className="flex-1">
        <Typography type="body-sm" className="text-ink font-semibold">
          {title}
        </Typography>
        <Typography type="body-sm" className="text-ink-soft/80">
          {detail}
        </Typography>
      </View>
    </View>
  );
}
