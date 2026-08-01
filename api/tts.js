// ElevenLabs text-to-speech, returned as audio/mpeg. Called by /api/twiml via
// Twilio's <Play> so the reminder call is voiced by ElevenLabs.

const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // warm voice; override per-request or via env

module.exports = async (req, res) => {
  const text = (req.query.text || "").toString().slice(0, 800);
  const voiceId = (req.query.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE).toString();
  const key = process.env.ELEVENLABS_API_KEY;

  if (!key) return res.status(404).json({ error: "ELEVENLABS_API_KEY not set" });
  if (!text) return res.status(400).json({ error: "missing text" });

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true },
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({ error: "elevenlabs", status: r.status, detail: detail.slice(0, 200) });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).json({ error: String(e).slice(0, 200) });
  }
};
