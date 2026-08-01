import AsyncStorage from '@react-native-async-storage/async-storage';
import { asyncStorage, createClient } from '@biltme/backend';

import type { MedimoDatabase } from '@/lib/services/db/schema';

/**
 * Bilt (Supabase/Postgres) client.
 *
 * The demo still runs on the seeded Zustand store, so the client is created
 * lazily: nothing connects until a query in `lib/services/db` is called.
 */
export type BiltClient = ReturnType<typeof createClient<MedimoDatabase>>;

const url = process.env.EXPO_PUBLIC_BILT_URL;
const anonKey = process.env.EXPO_PUBLIC_BILT_ANON_KEY;

/** True when the hosted database credentials are present. */
export const isBiltConfigured = Boolean(url && anonKey);

let client: BiltClient | null = null;

export function getBilt(): BiltClient {
  if (!url || !anonKey) {
    throw new Error(
      'Bilt backend is not configured. EXPO_PUBLIC_BILT_URL and EXPO_PUBLIC_BILT_ANON_KEY are required.',
    );
  }

  client ??= createClient<MedimoDatabase>(url, anonKey, {
    auth: {
      storage: asyncStorage(AsyncStorage),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}

/** Signed-in user id, or null when nobody is signed in. */
export async function getAuthUserId(): Promise<string | null> {
  const { data } = await getBilt().auth.getUser();
  return data.user?.id ?? null;
}

export async function signOut(): Promise<void> {
  await getBilt().auth.signOut();
}
