// TwiML that Twilio executes for the reminder call. Plays the ElevenLabs voice
// when a key is configured, otherwise speaks with Twilio's Italian voice so the
// call still works.

const { baseUrl, xmlEscape } = require("./_shared");

module.exports = async (req, res) => {
  const text = (req.query.text || "Per favore ricordati di prendere la tua medicina.").toString().slice(0, 600);
  const voiceId = (req.query.voiceId || "").toString();

  let inner;
  if (process.env.ELEVENLABS_API_KEY) {
    let audioUrl = `${baseUrl(req)}/api/tts?text=${encodeURIComponent(text)}`;
    if (voiceId) audioUrl += `&voiceId=${encodeURIComponent(voiceId)}`;
    inner = `<Play>${xmlEscape(audioUrl)}</Play><Pause length="1"/><Play>${xmlEscape(audioUrl)}</Play>`;
  } else {
    const safe = xmlEscape(text);
    inner = `<Say voice="Polly.Bianca" language="it-IT">${safe}</Say><Pause length="1"/><Say voice="Polly.Bianca" language="it-IT">${safe}</Say>`;
  }

  res.setHeader("Content-Type", "text/xml");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`);
};
