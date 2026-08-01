import { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Typography } from 'heroui-native';
import { CheckCircle2 } from 'lucide-react-native';

import { AnimatedView } from '@/components/ui/primitives/AnimatedView';
import { palette } from '@/lib/theme';

type Props = {
  message: string | null;
};

/** Calm bottom confirmation used across both experiences. */
export function FlashBanner({ message }: Props) {
  if (!message) return null;

  return (
    <AnimatedView
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="none"
      className="bottom-safe-offset-4 bg-ink absolute right-4 left-4 flex-row items-center gap-3 rounded-2xl px-4 py-3.5 shadow-lg"
    >
      <CheckCircle2 color={palette.karat} size={20} />
      <Typography className="text-cream flex-1 font-medium">{message}</Typography>
    </AnimatedView>
  );
}
