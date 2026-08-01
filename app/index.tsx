import { Image, Pressable, ScrollView, View } from 'react-native';
import { Button, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react-native';

import { LinearGradient } from '@/components/ui/primitives/LinearGradient';
import { PersonAvatar } from '@/components/PersonAvatar';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import type { Role } from '@/lib/types';

const HERO_HEIGHT = 300;

export default function WelcomeScreen() {
  const setRole = useMedimoStore((state) => state.setRole);
  const resetDemo = useMedimoStore((state) => state.resetDemo);
  const caregiver = useMedimoStore((state) => state.caregiver);
  const senior = useMedimoStore((state) => state.senior);

  const enter = (role: Role) => {
    setRole(role);
    router.replace(role === 'caregiver' ? '/(caregiver)' : '/(senior)');
  };

  return (
    <View className="bg-cream flex-1">
      <StatusBar style="light" />
      <ScrollView contentContainerClassName="pb-safe-offset-8" showsVerticalScrollIndicator={false}>
        <View style={{ height: HERO_HEIGHT }}>
          <Image
            source={require('@/assets/images/welcome-hero.png')}
            style={{ width: '100%', height: HERO_HEIGHT, position: 'absolute' }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={['rgba(17,50,83,0.72)', 'rgba(17,50,83,0.35)', palette.cream]}
            locations={[0, 0.55, 1]}
            style={{ height: HERO_HEIGHT }}
            className="pt-safe-offset-4 justify-between px-5 pb-6"
          >
            <View className="flex-row items-center gap-2.5">
              <View className="border-gold-soft/70 h-9 w-9 items-center justify-center rounded-xl border bg-white/15">
                <HeartHandshake color={palette.karat} size={18} />
              </View>
              <Typography className="text-cream text-lg font-semibold tracking-wide">
                Medimo
              </Typography>
            </View>

            <View>
              <Typography type="h1" className="text-cream font-bold">
                Care that stays{'\n'}in touch
              </Typography>
              <Typography className="text-cream/85 mt-2 max-w-[300px]">
                The right medicine, at the right time — without anyone feeling watched.
              </Typography>
            </View>
          </LinearGradient>
        </View>

        <View className="gap-4 px-5 pt-6">
          <Typography
            type="body-sm"
            className="text-ink-soft/80 font-semibold tracking-widest uppercase"
          >
            Choose who is using the phone
          </Typography>

          <RoleCard
            initials={caregiver.avatarInitials}
            name={caregiver.name}
            role="Caregiver · son"
            summary="Set up medicines, watch today's doses, handle refills and alerts."
            points={['Adherence and missed-dose alerts', 'Inventory, refills and appointments']}
            actionLabel="Open caregiver view"
            onPress={() => enter('caregiver')}
          />

          <RoleCard
            initials={senior.avatarInitials}
            name={senior.name}
            role="Father · takes the medicines"
            summary="Only what to take now, in large clear type, with one button."
            points={['One medicine at a time', 'Help is always one tap away']}
            actionLabel="Open Massimo's view"
            variant="senior"
            onPress={() => enter('senior')}
          />

          <View className="border-border bg-surface mt-2 flex-row items-start gap-3 rounded-3xl border px-4 py-4">
            <ShieldCheck color={palette.indigoCloth} size={20} />
            <View className="flex-1">
              <Typography type="body-sm" className="text-ink font-semibold">
                Demo mode
              </Typography>
              <Typography type="body-sm" className="text-ink-soft/80 mt-0.5">
                Medimo is running on seeded local data with mocked SMS, voice calls and prescription
                scanning. Switch roles any time from either view.
              </Typography>
              <Pressable
                accessibilityRole="button"
                onPress={resetDemo}
                className="bg-cadet-soft mt-3 self-start rounded-full px-3 py-1.5"
              >
                <Typography type="body-sm" className="text-ink-soft font-semibold">
                  Reset demo data
                </Typography>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

type RoleCardProps = {
  initials: string;
  name: string;
  role: string;
  summary: string;
  points: string[];
  actionLabel: string;
  onPress: () => void;
  variant?: 'caregiver' | 'senior';
};

function RoleCard({
  initials,
  name,
  role,
  summary,
  points,
  actionLabel,
  onPress,
  variant = 'caregiver',
}: RoleCardProps) {
  return (
    <View className="border-border bg-surface rounded-3xl border p-5 shadow-sm">
      <View className="flex-row items-center gap-4">
        <PersonAvatar initials={initials} size="md" />
        <View className="flex-1">
          <Typography type="h4" className="text-ink font-semibold">
            {name}
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/80">
            {role}
          </Typography>
        </View>
      </View>

      <Typography className="text-ink-soft mt-4">{summary}</Typography>

      <View className="mt-3 gap-2">
        {points.map((point) => (
          <View key={point} className="flex-row items-center gap-2">
            <Sparkles color={palette.goldenMean} size={14} />
            <Typography type="body-sm" className="text-ink-soft/90 flex-1">
              {point}
            </Typography>
          </View>
        ))}
      </View>

      <Button
        variant={variant === 'senior' ? 'secondary' : 'primary'}
        size="lg"
        className="mt-5"
        onPress={onPress}
      >
        <Button.Label>{actionLabel}</Button.Label>
      </Button>
    </View>
  );
}
