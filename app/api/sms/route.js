import { NextResponse } from "next/server";

// POST /api/sms  { to, body }
// Sends an SMS via Twilio. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
// TWILIO_FROM_NUMBER. On a Twilio trial account, `to` must be a verified number.

export const runtime = "nodejs";

export async function POST(req) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return NextResponse.json(
      { error: "Twilio not configured", need: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"] },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const to = (body?.to || "").toString().trim();
  const text = (body?.body || "").toString().slice(0, 640);
  if (!to || !text) {
    return NextResponse.json({ error: "missing 'to' or 'body'" }, { status: 400 });
  }

  const params = new URLSearchParams({ To: to, From: from, Body: text });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: "Twilio error", status: res.status, detail: data?.message || data },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, sid: data.sid, status: data.status });
}
