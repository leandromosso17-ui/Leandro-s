import { View } from 'react-native';
import { router } from 'expo-router';

import { AlertCard } from '@/components/caregiver/AlertCard';
import { useMedimoStore } from '@/lib/store';
import type { CareAlert } from '@/lib/types';

type Props = {
  alerts: CareAlert[];
  onFlash: (message: string) => void;
};

/** Alert list with the escalation actions wired to the mock providers. */
export function AlertList({ alerts, onFlash }: Props) {
  const busyDoseId = useMedimoStore((state) => state.busyDoseId);
  const sendSmsReminder = useMedimoStore((state) => state.sendSmsReminder);
  const placeEscalationCall = useMedimoStore((state) => state.placeEscalationCall);
  const acknowledgeAlert = useMedimoStore((state) => state.acknowledgeAlert);

  return (
    <View className="gap-3">
      {alerts.map((alert) => {
        const doseId = alert.doseId;
        return (
          <AlertCard
            key={alert.id}
            alert={alert}
            busy={Boolean(doseId) && busyDoseId === doseId}
            onMarkTaken={
              doseId ? () => router.push(`/confirm/${doseId}?actor=caregiver`) : undefined
            }
            onSendSms={
              doseId
                ? () => {
                    void sendSmsReminder(doseId);
                    onFlash('SMS reminder sent to Massimo');
                  }
                : undefined
            }
            onCall={
              doseId
                ? () => {
                    void placeEscalationCall(doseId);
                    onFlash('Voice call started with Massimo');
                  }
                : undefined
            }
            onStartRefill={alert.kind === 'low-stock' ? () => router.push('/inventory') : undefined}
            onDismiss={() => {
              acknowledgeAlert(alert.id);
              onFlash('Alert marked as handled');
            }}
          />
        );
      })}
    </View>
  );
}
