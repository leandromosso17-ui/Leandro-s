# Deploying Medimo (with real SMS + ElevenLabs voice)

This app is an **Expo web (SPA)** export served on Vercel, plus four **serverless
functions** in `/api` that own the Twilio + ElevenLabs credentials.

- Frontend build: `npx expo export -p web` → `dist/` (configured in `vercel.json`)
- Backend: `/api/sms`, `/api/call`, `/api/twiml`, `/api/tts` (Node functions)

The client talks to the backend via the endpoints in the committed `.env`
(`EXPO_PUBLIC_SMS_ENDPOINT=/api/sms`, `EXPO_PUBLIC_VOICE_ENDPOINT=/api/call`).
Without server keys the endpoints return safe mock results, so the app works
immediately; add the keys below to make SMS and the call real.

## Deploy from a GitHub Codespace (what we've been using)

```bash
git pull
npm install            # optional locally; Vercel installs on its side
vercel                 # first run: create/link the project
```
Answer the prompts (Create new project → name `medimo` → directory `.` →
don't customize; it reads `vercel.json`).

### Add the server-side keys (once), then ship to production
```bash
vercel env add ELEVENLABS_API_KEY production
vercel env add TWILIO_ACCOUNT_SID production
vercel env add TWILIO_AUTH_TOKEN production
vercel env add TWILIO_FROM_NUMBER production
vercel --prod
```

Optional voice overrides: `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`.
Only set `PUBLIC_BASE_URL` if Twilio can't reach `/api/twiml` automatically.

## How the reminder call works
1. The app calls `POST /api/call` with `{ to, script }` (script is Italian).
2. `/api/call` places a Twilio call whose TwiML (`/api/twiml`) `<Play>`s the
   ElevenLabs audio from `/api/tts` (falls back to an Italian `<Say>` voice if
   `ELEVENLABS_API_KEY` is missing).
3. `POST /api/sms` sends the reminder text via Twilio.

Twilio trial note: verify the recipient's number in the Twilio console first.

## Reverting to the previous Next.js app
The earlier Next.js version is preserved in git history — check out the commit
before this migration if you ever need it.
