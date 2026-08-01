import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Spinner, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Camera, Check, FileText, ImageUp, ScanLine } from 'lucide-react-native';

import { getPrescriptionScanner, SCAN_STAGES } from '@/lib/services/ocr';
import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';
import { cn } from '@/lib/utils';

export default function ScanPrescriptionScreen() {
  const setPendingScan = useMedimoStore((state) => state.setPendingScan);
  const [phase, setPhase] = useState<'idle' | 'processing'>('idle');
  const [stageIndex, setStageIndex] = useState(0);

  const scanner = useMemo(() => getPrescriptionScanner(), []);

  const start = async (sourceLabel: string) => {
    setPhase('processing');
    setStageIndex(0);
    const result = await scanner.scan({ sourceLabel }, (_stage, index) => setStageIndex(index));
    setPendingScan(result);
    router.replace('/scan/review');
  };

  if (phase === 'processing') {
    return (
      <View className="bg-cream flex-1 px-6 pt-10">
        <View className="items-center">
          <Spinner size="lg" />
          <Typography type="h4" className="text-ink mt-5 text-center font-bold">
            Reading the prescription
          </Typography>
          <Typography type="body-sm" className="text-ink-soft/80 mt-2 text-center">
            Medimo extracts the medicine, the dose, the frequency and the number of pills, then
            builds the schedule.
          </Typography>
        </View>

        <View className="border-border bg-surface mt-8 gap-4 rounded-3xl border p-5">
          {SCAN_STAGES.map((stage, index) => {
            const done = index < stageIndex;
            const active = index === stageIndex;
            return (
              <View key={stage.key} className="flex-row items-center gap-3">
                <View
                  className={cn(
                    'h-8 w-8 items-center justify-center rounded-full',
                    done ? 'bg-sage-tint' : active ? 'bg-ink' : 'bg-cadet-soft',
                  )}
                >
                  {done ? (
                    <Check color={palette.sage} size={16} />
                  ) : active ? (
                    <View className="bg-gold-soft h-2.5 w-2.5 rounded-full" />
                  ) : (
                    <View className="bg-cadet h-2 w-2 rounded-full" />
                  )}
                </View>
                <Typography
                  className={cn(
                    'flex-1',
                    done
                      ? 'text-ink-soft/70'
                      : active
                        ? 'text-ink font-semibold'
                        : 'text-ink-soft/50',
                  )}
                >
                  {stage.label}
                </Typography>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View className="bg-cream flex-1 px-6 pt-6">
      <View className="border-cadet items-center justify-center rounded-3xl border-2 border-dashed bg-white/60 px-6 py-12">
        <View className="bg-ink-tint h-16 w-16 items-center justify-center rounded-2xl">
          <ScanLine color={palette.incrementalBlue} size={28} />
        </View>
        <Typography type="h4" className="text-ink mt-5 text-center font-bold">
          Scan a prescription
        </Typography>
        <Typography type="body-sm" className="text-ink-soft/80 mt-2 text-center">
          Photograph the prescription, the medicine sheet or the hospital note. Keep the paper flat
          and inside the frame.
        </Typography>
      </View>

      <View className="mt-7 gap-3">
        <Button variant="primary" size="lg" onPress={() => void start('Camera capture')}>
          <Camera color={palette.cream} size={18} />
          <Button.Label>Take a photo</Button.Label>
        </Button>
        <Button variant="secondary" size="lg" onPress={() => void start('Gallery upload')}>
          <ImageUp color={palette.cream} size={18} />
          <Button.Label>Upload from gallery</Button.Label>
        </Button>
        <Button
          variant="tertiary"
          size="lg"
          onPress={() => void start('Sample prescription (demo)')}
        >
          <FileText color={palette.incrementalBlue} size={18} />
          <Button.Label>Use the sample prescription</Button.Label>
        </Button>
      </View>

      <View className="border-border bg-surface mt-7 rounded-3xl border p-4">
        <Typography type="body-sm" className="text-ink font-semibold">
          Demo mode
        </Typography>
        <Typography type="body-sm" className="text-ink-soft/85 mt-1">
          The scan is simulated with a realistic mocked result. The same screen works with a real
          OCR service: only the scanner implementation changes.
        </Typography>
      </View>
    </View>
  );
}
