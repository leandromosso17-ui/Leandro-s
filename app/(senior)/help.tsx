import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Switch, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { MessageSquare, Phone } from 'lucide-react-native';

import { FlashBanner } from '@/components/FlashBanner';
import { PersonAvatar } from '@/components/PersonAvatar';
import { useFlash } from '@/hooks/useFlash';
import {
  defaultReminderPreferences,
  playLoudReminder,
  speakReminder,
  vibrateReminder,
} from '@/lib/services/reminders';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';

export default function SeniorHelp() {
  const { message, flash } = useFlash();
  const caregiverPerson = useMedimoStore((state) => state.caregiver);
  const [preferences, setPreferences] = useState(defaultReminderPreferences);

  const testReminder = () => {
    void playLoudReminder();
    if (preferences.vibration) void vibrateReminder();
    if (preferences.spokenReminder) void speakReminder('It is time for your medicine.');
    flash('That is how the reminder will feel.');
  };

  return (
    <View className="bg-cream flex-1">
      <ScrollView
        contentContainerClassName="pt-safe-offset-4 gap-6 px-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Typography className="text-ink text-3xl font-bold">Help</Typography>
          <Typography className="text-ink-soft mt-1 text-lg">
            {caregiverPerson.name} is always one tap away.
          </Typography>
        </View>

        <View className="border-border bg-surface rounded-3xl border p-6">
          <View className="flex-row items-center gap-4">
            <PersonAvatar initials={caregiverPerson.avatarInitials} size="lg" />
            <View className="flex-1">
              <Typography className="text-ink text-2xl font-bold">
                {caregiverPerson.name}
              </Typography>
              <Typography className="text-ink-soft text-lg">Your son</Typography>
              <Typography className="text-ink-soft/80 text-lg">{caregiverPerson.phone}</Typography>
            </View>
          </View>

          <Button
            variant="primary"
            size="lg"
            className="mt-6 h-20"
            onPress={() => flash(`Calling ${caregiverPerson.name} now.`)}
          >
            <Phone color={palette.cream} size={24} />
            <Button.Label className="text-2xl font-bold">Call {caregiverPerson.name}</Button.Label>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="mt-3 h-16"
            onPress={() => flash(`${caregiverPerson.name} has been told you need help.`)}
          >
            <MessageSquare color={palette.incrementalBlue} size={20} />
            <Button.Label className="text-xl">Send him a message</Button.Label>
          </Button>
        </View>

        <View className="border-border bg-surface rounded-3xl border p-6">
          <Typography className="text-ink text-2xl font-bold">Reminders</Typography>
          <Typography className="text-ink-soft mt-1 text-lg">
            Choose how Medimo reminds you.
          </Typography>

          <View className="mt-5 gap-5">
            <PreferenceRow
              label="Loud sound"
              value={preferences.loudSound}
              onChange={(value) => setPreferences((current) => ({ ...current, loudSound: value }))}
            />
            <PreferenceRow
              label="Vibration"
              value={preferences.vibration}
              onChange={(value) => setPreferences((current) => ({ ...current, vibration: value }))}
            />
            <PreferenceRow
              label="Spoken reminder"
              value={preferences.spokenReminder}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, spokenReminder: value }))
              }
            />
          </View>

          <Button variant="secondary" size="lg" className="mt-6 h-16" onPress={testReminder}>
            <Button.Label className="text-xl">Try the reminder</Button.Label>
          </Button>
        </View>

        <View className="border-border bg-surface rounded-3xl border p-6">
          <Typography className="text-ink text-2xl font-bold">If you forget a medicine</Typography>
          <Typography className="text-ink-soft mt-2 text-lg">
            Never take two together to catch up. Take the next one at its usual time.{' '}
            {caregiverPerson.name} is told automatically, so nobody has to remember for you.
          </Typography>
        </View>

        <Button variant="ghost" size="lg" className="h-14" onPress={() => router.replace('/')}>
          <Button.Label className="text-lg">
            Give the phone back to {caregiverPerson.name}
          </Button.Label>
        </Button>
      </ScrollView>

      <FlashBanner message={message} />
    </View>
  );
}

type PreferenceRowProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

function PreferenceRow({ label, value, onChange }: PreferenceRowProps) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Typography className="text-ink flex-1 text-xl">{label}</Typography>
      <Switch isSelected={value} onSelectedChange={onChange} />
    </View>
  );
}
