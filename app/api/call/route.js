import { NextResponse } from "next/server";

// POST /api/call  { to, text }
// Places a real phone call via Twilio. Twilio fetches /api/twiml to get the
// instructions, which play an ElevenLabs voice (or fall back to Twilio <Say>).
//
// Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
// The call flow only works on a public deployment (Twilio must reach /api/twiml).

export const runtime = "nodejs";

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

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
  const text = (body?.text || "").toString().slice(0, 600);
  if (!to || !text) {
    return NextResponse.json({ error: "missing 'to' or 'text'" }, { status: 400 });
  }

  const twimlUrl = `${baseUrl(req)}/api/twiml?text=${encodeURIComponent(text)}`;
  const params = new URLSearchParams({ To: to, From: from, Url: twimlUrl });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
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
