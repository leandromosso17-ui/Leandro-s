// GET /api/twiml?text=...
// Returns TwiML that Twilio executes for the reminder call. If an ElevenLabs key
// is configured it <Play>s the generated voice; otherwise it <Say>s the text so
// the call still speaks.

export const runtime = "nodejs";

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

function xmlEscape(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get("text") || "Please remember to take your medication.").slice(0, 600);

  let inner;
  if (process.env.ELEVENLABS_API_KEY) {
    const audioUrl = `${baseUrl(req)}/api/voice?text=${encodeURIComponent(text)}`;
    // Play twice so it's easy to catch on the phone.
    inner = `<Play>${xmlEscape(audioUrl)}</Play><Pause length="1"/><Play>${xmlEscape(audioUrl)}</Play>`;
  } else {
    const safe = xmlEscape(text);
    inner = `<Say voice="Polly.Giorgio" language="it-IT">${safe}</Say><Pause length="1"/><Say voice="Polly.Giorgio" language="it-IT">${safe}</Say>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
  return new Response(xml, {
    headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" },
  });
}
