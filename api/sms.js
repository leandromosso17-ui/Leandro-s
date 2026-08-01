// SMS endpoint for medimo's `httpSmsProvider` (EXPO_PUBLIC_SMS_ENDPOINT).
// Request:  { to, body, reference? }
// Response: { id, status: 'sent'|'delivered'|'failed', sentAt, providerName }
//
// Sends a real SMS via Twilio when credentials are present; otherwise returns a
// valid mock result so the demo never throws. Always responds 200 with the
// contract shape (errors are reported via `status`), so the client UI stays happy.

const { twilioCreds, twilioAuthHeader } = require("./_shared");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const sentAt = new Date().toISOString();
  const { to, body } = req.body || {};
  const { sid, token, from } = twilioCreds();

  if (!sid || !token || !from) {
    return res.status(200).json({
      id: `sms_${Date.now()}`,
      status: "sent",
      sentAt,
      providerName: "mock-sms (Twilio not configured)",
    });
  }
  if (!to || !body) {
    return res.status(200).json({
      id: `sms_${Date.now()}`,
      status: "failed",
      sentAt,
      providerName: "twilio (missing to/body)",
    });
  }

  try {
    const params = new URLSearchParams({ To: to, From: from, Body: String(body).slice(0, 640) });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
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
        id: `sms_${Date.now()}`,
        status: "failed",
        sentAt,
        providerName: `twilio-error: ${data.message || r.status}`,
      });
    }
    return res.status(200).json({
      id: data.sid,
      status: "sent",
      sentAt,
      providerName: "twilio",
    });
  } catch (e) {
    return res.status(200).json({
      id: `sms_${Date.now()}`,
      status: "failed",
      sentAt,
      providerName: `twilio-exception: ${String(e).slice(0, 80)}`,
    });
  }
};
