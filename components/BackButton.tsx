import { Pressable } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';

import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

type Props = {
  /** Larger target for senior-facing screens. */
  size?: 'md' | 'lg';
  className?: string;
};

function goBack() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/');
}

/**
 * Simple back arrow used in native headers and on headerless screens.
 * Falls back to the welcome / role switch when there is nothing to pop.
 */
export function BackButton({ size = 'md', className }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={goBack}
      className={cn(
        'border-border bg-surface items-center justify-center rounded-2xl border active:opacity-70',
        size === 'lg' ? 'h-14 w-14 rounded-3xl' : 'h-10 w-10',
        className,
      )}
    >
      <ArrowLeft color={palette.indigoCloth} size={size === 'lg' ? 26 : 20} />
    </Pressable>
  );
}
