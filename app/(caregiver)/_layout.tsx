import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BellRing, CalendarDays, LayoutGrid, NotebookPen, Pill } from 'lucide-react-native';

import { useMedimoStore } from '@/lib/store';
import { palette } from '@/lib/theme';

export default function CaregiverLayout() {
  const alerts = useMedimoStore((state) => state.alerts);
  const openAlerts = useMemo(() => alerts.filter((alert) => !alert.acknowledged).length, [alerts]);

  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: palette.cream },
          tabBarStyle: {
            backgroundColor: palette.white,
            borderTopColor: palette.inkTint,
          },
          tabBarActiveTintColor: palette.incrementalBlue,
          tabBarInactiveTintColor: palette.cadetGrey,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarBadgeStyle: { backgroundColor: palette.goldenMean, color: palette.white },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="medicines"
          options={{
            title: 'Medicines',
            tabBarIcon: ({ color, size }) => <Pill color={color} size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            tabBarBadge: openAlerts > 0 ? openAlerts : undefined,
            tabBarIcon: ({ color, size }) => <BellRing color={color} size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="care"
          options={{
            title: 'Care plan',
            tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            title: 'Notes',
            tabBarIcon: ({ color, size }) => <NotebookPen color={color} size={size ?? 22} />,
          }}
        />
      </Tabs>
    </>
  );
}
