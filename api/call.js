// Voice endpoint for medimo's `elevenLabsVoiceProvider` (EXPO_PUBLIC_VOICE_ENDPOINT).
// Request:  { agentId?, to, script, voiceId?, language?, reference? }
// Response: { id, status: 'answered'|'no-answer'|'failed', startedAt, durationSeconds, providerName, transcript? }
//
// Places a real phone call via Twilio; Twilio fetches /api/twiml, which plays the
// `script` in an ElevenLabs voice (or an Italian <Say> fallback). The real call
// outcome is asynchronous, so we optimistically report 'answered' once Twilio
// accepts the request, and 'failed' if it doesn't. Falls back to a mock result
// when Twilio isn't configured, so the demo always returns a valid shape.

const { baseUrl, twilioCreds, twilioAuthHeader } = require("./_shared");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const startedAt = new Date().toISOString();
  const { to, script, voiceId } = req.body || {};
  const { sid, token, from } = twilioCreds();

  if (!sid || !token || !from) {
    return res.status(200).json({
      id: `call_${Date.now()}`,
      status: "answered",
      startedAt,
      durationSeconds: 0,
      providerName: "mock-elevenlabs (Twilio not configured)",
      transcript: `(mock) ${script || ""}`,
    });
  }
  if (!to || !script) {
    return res.status(200).json({
      id: `call_${Date.now()}`,
      status: "failed",
      startedAt,
      durationSeconds: 0,
      providerName: "twilio (missing to/script)",
    });
  }

  try {
    let twiml = `${baseUrl(req)}/api/twiml?text=${encodeURIComponent(String(script).slice(0, 600))}`;
    if (voiceId) twiml += `&voiceId=${encodeURIComponent(voiceId)}`;
    const params = new URLSearchParams({ To: to, From: from, Url: twiml });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader(sid, token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(200).json({
        id: `call_${Date.now()}`,
        status: "failed",
        startedAt,
        durationSeconds: 0,
        providerName: `twilio-error: ${data.message || r.status}`,
      });
    }
    return res.status(200).json({
      id: data.sid,
      status: "answered",
      startedAt,
      durationSeconds: 0,
      providerName: "elevenlabs+twilio",
    });
  } catch (e) {
    return res.status(200).json({
      id: `call_${Date.now()}`,
      status: "failed",
      startedAt,
      durationSeconds: 0,
      providerName: `twilio-exception: ${String(e).slice(0, 80)}`,
    });
  }
};
