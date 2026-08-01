import { NextResponse } from "next/server";

// Text-to-speech via ElevenLabs.
//   POST { text }            -> used by the in-app simulated call
//   GET  ?text=...           -> used by Twilio <Play> when placing a real call
//
// If ELEVENLABS_API_KEY is not configured, POST responds 503 with a JSON flag so
// the browser can fall back to built-in speech synthesis; GET responds 404 so the
// TwiML route uses <Say> instead.

export const runtime = "nodejs";

const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"; // "George"
const MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";

async function synthesize(text, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, status: 503, reason: "ELEVENLABS_API_KEY not set" };

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || DEFAULT_VOICE}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.1,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, status: 502, reason: `ElevenLabs ${res.status}`, detail };
  }
  const audio = await res.arrayBuffer();
  return { ok: true, audio };
}

function audioResponse(audio) {
  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const text = (body?.text || "").toString().slice(0, 800);
  if (!text) return NextResponse.json({ error: "missing text" }, { status: 400 });

  const r = await synthesize(text, body?.voiceId);
  if (!r.ok) {
    return NextResponse.json(
      { fallback: true, reason: r.reason, detail: (r.detail || "").slice(0, 300) },
      { status: r.status }
    );
  }
  return audioResponse(r.audio);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get("text") || "").slice(0, 800);
  if (!text) return NextResponse.json({ error: "missing text" }, { status: 400 });

  const r = await synthesize(text, searchParams.get("voiceId"));
  if (!r.ok) {
    return NextResponse.json({ reason: r.reason }, { status: r.status });
  }
  return audioResponse(r.audio);
}
