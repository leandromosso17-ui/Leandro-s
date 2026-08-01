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
  (In this MVP the scan returns a pre-baked sample so the demo is reliable;
  the code is structured to drop in a real vision model.)
- **Add manually** — full form to add a medication (dose, schedule, stock,
  box size, icon, instructions).
- **Live stock tracking** — every confirmed dose decrements inventory, and
  the run-out prediction updates automatically.

### 📞 The reminder escalation
1. **SMS first** — 15 minutes before a dose (an SMS banner in the demo).
2. **Phone call** — if the dose isn't registered within 30 minutes, MedGuard
   "calls" Massimo and a **real ElevenLabs voice** tells him which pill to take.

In **demo mode** these timers are compressed to seconds so you can show the
whole chain live. Trigger it from Lorenzo's dashboard (**Remind**) or from the
demo button on Massimo's screen — open the two pages in separate tabs/devices
and the reminder jumps from one to the other.

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
cp .env.example .env.local   # add your ELEVENLABS_API_KEY (optional)
npm run dev
```

Open <http://localhost:3000> and pick **Lorenzo** or **Massimo**.

## Deploy

Deploys to **Vercel** as-is. Add `ELEVENLABS_API_KEY` (and optionally
`ELEVENLABS_VOICE_ID`) as environment variables in the project settings.

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
