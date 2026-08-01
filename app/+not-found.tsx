import { Link, Stack } from 'expo-router';
import { Typography } from 'heroui-native';
import { View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <View className="bg-cream flex-1 items-center justify-center px-8">
      <Stack.Screen options={{ headerShown: true, title: 'Not found' }} />
      <Typography type="h4" className="text-ink text-center font-semibold">
        This screen does not exist
      </Typography>
      <Typography className="text-ink-soft mt-2 text-center">
        Go back to the start and choose who is using the phone.
      </Typography>
      <Link href="/" className="mt-6">
        <Typography className="text-ink-soft font-semibold">Back to the beginning</Typography>
      </Link>
    </View>
  );
}
