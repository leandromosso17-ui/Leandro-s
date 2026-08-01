# 🛡️ MedGuard

**Medication tracker for families managing an aging parent's meds.**

Built for adult children (like **Lorenzo**) who want to make sure their parent
(like **Massimo**) takes the right medication at the right time — and never runs
out of pills unexpectedly.

> Hackathon MVP. Mobile-first. Two views. Real ElevenLabs voice for the
> escalation call. SMS + telephony are simulated in-app for the demo.

---

## What it does

### 👴 Massimo — the patient view (`/massimo`)
- A big, friendly list of **today's pills**, grouped by time of day.
- One large **"I took it"** button per dose.
- A **double-check dialog** so an accidental tap never marks a dose as taken.
- Each taken dose is stamped with the **exact time** it was confirmed.
- A celebratory "all done" state when the day is complete.

### 🧑‍💻 Lorenzo — the caregiver dashboard (`/lorenzo`)
- **Today's adherence** — see what Massimo has and hasn't taken, and tap
  **Remind** to push a reminder to his phone.
- **Refill calendar** — every medication sorted by how many days of supply
  remain, with a **"runs out" date** and a **"buy by" date** (a few days of
  buffer) so Lorenzo can get a new prescription to the doctor and restock in
  time.
- **Scan prescription** 📷 — snap a photo of a prescription and the meds,
  doses, schedule and pill counts are added to the dashboard automatically.
  Pick the photo **from your gallery / files**. (In this MVP the scan returns a
  pre-baked sample so the demo is reliable; the code is structured to drop in a
  real vision model.)
- **Add manually** — full form to add a medication (dose, schedule, stock,
  box size, icon, instructions).
- **Live stock tracking** — every confirmed dose decrements inventory, and
  the run-out prediction updates automatically.

### 📞 The reminder escalation
For a dose scheduled at **12:00**:
1. **SMS at 11:45** (−15 min) — *"Ciao Massimo, don't forget to take XYZ. Have a
   great day."*
2. **Phone call at 12:05** (+5 min) — only if the dose still isn't marked taken.
   The call is voiced by a **real ElevenLabs voice** (Twilio dials, ElevenLabs
   speaks). Both offsets are configurable in **⚙️ Settings**.

**Two modes**, toggled in Settings:
- **Simulate** (default) — the SMS + call appear on Massimo's screen. No
  accounts needed, perfect for offline demos. Open Lorenzo and Massimo in two
  tabs/devices and the reminder jumps from one to the other.
- **Twilio** — real SMS and a real phone call to Massimo's number.

**Automatic reminders** (Settings toggle) fire at the real clock times while
Lorenzo's dashboard stays open. For a quick stage demo, the **Remind** button
and Massimo's demo button run the whole chain immediately (call in ~8s).

---

## Tech

- **Next.js 14** (App Router) + **Tailwind CSS**, mobile-first.
- Client-side state persisted to **localStorage** (no database to set up).
- **One API route** (`/api/voice`) calls **ElevenLabs** text-to-speech for the
  call. If no API key is set it gracefully falls back to the browser's built-in
  voice, so the demo never breaks.

## Run it

```bash
npm install
cp .env.example .env.local   # add keys (all optional — see below)
npm run dev
```

Open <http://localhost:3000> and pick **Lorenzo** or **Massimo**.

Everything works with **no keys** (simulate mode). Add keys to go live:

| To enable | Set |
|---|---|
| Real ElevenLabs call voice | `ELEVENLABS_API_KEY` (+ optional `ELEVENLABS_VOICE_ID`) |
| Real SMS + phone calls | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |

### Twilio (free trial works)
1. Sign up at <https://www.twilio.com/try-twilio> — free credit + a phone number.
2. **Verify Massimo's number** (trial can only text/call verified numbers).
3. Put the Account SID, Auth Token and Twilio number in your env.
4. In the app: **⚙️ Settings** → enter Massimo's phone, tick **Use Twilio**,
   and hit **Send test SMS** / **Test call**.

> The **call** needs a public URL for Twilio to fetch the ElevenLabs audio, so
> place calls from the **deployed** app (Vercel), or tunnel localhost with ngrok
> and set `PUBLIC_BASE_URL`. SMS works from anywhere.

## Deploy

Deploys to **Vercel** as-is. Add the env vars above in project settings. The
call audio URL is auto-detected from the request; set `PUBLIC_BASE_URL` only if
needed.

## Demo script (2 minutes)

1. **Lorenzo** taps *Scan prescription* → meds populate with counts + schedule.
2. Switch to **Massimo** → giant buttons; he taps *I took it* and confirms.
3. Back on **Lorenzo** → adherence updates, stock ticks down, refill calendar
   shows *"buy Aspirin by …"*.
4. Lorenzo taps **Remind** on a pending pill → Massimo's phone shows the SMS,
   then (seconds later) "rings" and an **ElevenLabs voice** reminds him.

---

## Roadmap (post-hackathon)

- Real SMS + outbound calls via **Twilio** (Twilio dials, ElevenLabs voices).
- Real prescription OCR with a vision model.
- Shared cloud state (Supabase) for true multi-device sync.
- Scheduled reminder engine (cron) instead of demo timers.
