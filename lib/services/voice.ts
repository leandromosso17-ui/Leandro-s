/**
 * Outbound voice call boundary — designed for ElevenLabs conversational agents.
 *
 * Production shape: the app asks your backend to start a call, the backend
 * calls the ElevenLabs API with the agent id and the dose context, and the
 * agent phones Massimo with a warm, short script. The API key stays server-side.
 *
 * Demo builds use `mockVoiceProvider`, which simulates the call outcome.
 */
export type VoiceCallRequest = {
  to: string;
  /** What the agent should say / accomplish. */
  script: string;
  /** ElevenLabs voice or agent identifier. */
  voiceId?: string;
  language?: 'it' | 'en';
  reference?: string;
};

export type VoiceCallResult = {
  id: string;
  status: 'answered' | 'no-answer' | 'failed';
  startedAt: string;
  durationSeconds: number;
  transcript?: string;
  providerName: string;
};

export type VoiceCallProvider = {
  name: string;
  placeCall: (request: VoiceCallRequest) => Promise<VoiceCallResult>;
};

function isVoiceCallResult(value: unknown): value is VoiceCallResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'status' in value &&
    'startedAt' in value &&
    'durationSeconds' in value &&
    'providerName' in value &&
    typeof value.id === 'string' &&
    typeof value.startedAt === 'string' &&
    typeof value.durationSeconds === 'number' &&
    typeof value.providerName === 'string' &&
    (value.status === 'answered' || value.status === 'no-answer' || value.status === 'failed')
  );
}

export const mockVoiceProvider: VoiceCallProvider = {
  name: 'mock-elevenlabs',
  async placeCall(request) {
    await new Promise((resolve) => setTimeout(resolve, 1400));
    return {
      id: `call_${Date.now()}`,
      status: 'answered',
      startedAt: new Date().toISOString(),
      durationSeconds: 38,
      transcript: `Agent: ${request.script}\nMassimo: “Sì, la prendo adesso.”`,
      providerName: 'mock-elevenlabs',
    };
  },
};

/**
 * Real integration placeholder. Set `EXPO_PUBLIC_VOICE_ENDPOINT` to a backend
 * route that owns the ElevenLabs API key and the agent configuration.
 */
export const elevenLabsVoiceProvider: VoiceCallProvider = {
  name: 'elevenlabs',
  async placeCall(request) {
    const endpoint = process.env.EXPO_PUBLIC_VOICE_ENDPOINT;
    if (!endpoint) {
      throw new Error('Voice calling endpoint is not configured yet');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID,
        ...request,
      }),
    });

    if (!response.ok) {
      throw new Error(`Voice provider responded with ${response.status}`);
    }

    const body: unknown = await response.json();
    if (!isVoiceCallResult(body)) {
      throw new Error('Voice provider returned an unexpected response shape');
    }

    return body;
  },
};

export function getVoiceProvider(): VoiceCallProvider {
  return process.env.EXPO_PUBLIC_VOICE_ENDPOINT ? elevenLabsVoiceProvider : mockVoiceProvider;
}

export function doseCallScript(medicineName: string, strength: string, seniorName: string): string {
  return `Buonasera ${seniorName}, sono l’assistente di Lorenzo. È l’ora di ${medicineName} ${strength}. Se l’ha già presa, me lo dica e lo segno io.`;
}
