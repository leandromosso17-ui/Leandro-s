/**
 * SMS provider boundary.
 *
 * Demo builds use `mockSmsProvider`, which only records what *would* be sent.
 * A production build swaps in an implementation backed by a server function
 * (Twilio / Vonage / MessageBird). Provider credentials must never live in the
 * app bundle — the app calls your backend, the backend calls the provider.
 */
export type SmsMessage = {
  to: string;
  body: string;
  /** Free-form tag so delivery webhooks can be matched back to a dose. */
  reference?: string;
};

export type SmsSendResult = {
  id: string;
  status: 'sent' | 'delivered' | 'failed';
  sentAt: string;
  providerName: string;
};

export type SmsProvider = {
  name: string;
  sendSms: (message: SmsMessage) => Promise<SmsSendResult>;
};

function isSmsSendResult(value: unknown): value is SmsSendResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'status' in value &&
    'sentAt' in value &&
    'providerName' in value &&
    typeof value.id === 'string' &&
    typeof value.sentAt === 'string' &&
    typeof value.providerName === 'string' &&
    (value.status === 'sent' || value.status === 'delivered' || value.status === 'failed')
  );
}

export const mockSmsProvider: SmsProvider = {
  name: 'mock-sms',
  async sendSms(message) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      id: `sms_${Date.now()}`,
      status: 'delivered',
      sentAt: new Date().toISOString(),
      providerName: `mock-sms → ${message.to}`,
    };
  },
};

/**
 * Real provider placeholder. Point `EXPO_PUBLIC_SMS_ENDPOINT` at your backend
 * route (for example a Supabase Edge Function) and implement the fetch below.
 */
export const httpSmsProvider: SmsProvider = {
  name: 'http-sms',
  async sendSms(message) {
    const endpoint = process.env.EXPO_PUBLIC_SMS_ENDPOINT;
    if (!endpoint) {
      throw new Error('SMS endpoint is not configured yet');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`SMS provider responded with ${response.status}`);
    }

    const body: unknown = await response.json();
    if (!isSmsSendResult(body)) {
      throw new Error('SMS provider returned an unexpected response shape');
    }

    return body;
  },
};

export function getSmsProvider(): SmsProvider {
  return process.env.EXPO_PUBLIC_SMS_ENDPOINT ? httpSmsProvider : mockSmsProvider;
}

export function doseReminderSms(medicineName: string, strength: string, clock: string): string {
  return `Medimo: time for ${medicineName} ${strength} (${clock}). Reply DONE when you have taken it.`;
}
