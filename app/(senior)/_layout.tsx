import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LifeBuoy, Pill, Sun } from 'lucide-react-native';

import { palette } from '@/lib/theme';

/**
 * Massimo's navigation: three destinations, large labels, no hidden gestures.
 */
export default function SeniorLayout() {
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
            height: 84,
            paddingTop: 10,
            paddingBottom: 12,
          },
          tabBarActiveTintColor: palette.incrementalBlue,
          tabBarInactiveTintColor: palette.cadetGrey,
          tabBarLabelStyle: { fontSize: 15, fontWeight: '700' },
          tabBarIconStyle: { marginBottom: 2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color }) => <Sun color={color} size={28} />,
          }}
        />
        <Tabs.Screen
          name="medicines"
          options={{
            title: 'Medicines',
            tabBarIcon: ({ color }) => <Pill color={color} size={28} />,
          }}
        />
        <Tabs.Screen
          name="help"
          options={{
            title: 'Help',
            tabBarIcon: ({ color }) => <LifeBuoy color={color} size={28} />,
          }}
        />
      </Tabs>
    </>
  );
}
