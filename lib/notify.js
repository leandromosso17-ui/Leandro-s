"use client";

import { sendReminderSignal } from "./reminder";
import { reminderText, isDoseTaken } from "./store";

// Low-level: send the SMS stage. Real Twilio if enabled + phone set, else the
// in-app simulated banner on Massimo's screen.
export async function fireSms({ settings, dose, from = "Lorenzo", patient = "Massimo" }) {
  const medName = `${dose.med.name} ${dose.med.dosage}`.trim();
  const body = reminderText(medName, patient);
  if (settings?.useTwilio && settings?.massimoPhone) {
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: settings.massimoPhone, body }),
      });
      const data = await res.json().catch(() => ({}));
      return { real: true, ok: res.ok, data };
    } catch (e) {
      return { real: true, ok: false, data: { error: String(e) } };
    }
  }
  sendReminderSignal({ stage: "sms", medName, patient, from });
  return { real: false, ok: true };
}

// Low-level: place the call stage (ElevenLabs voice via Twilio, or simulated).
export async function fireCall({ settings, dose, patient = "Massimo" }) {
  const medName = `${dose.med.name} ${dose.med.dosage}`.trim();
  const text = reminderText(medName, patient);
  if (settings?.useTwilio && settings?.massimoPhone) {
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: settings.massimoPhone, text }),
      });
      const data = await res.json().catch(() => ({}));
      return { real: true, ok: res.ok, data };
    } catch (e) {
      return { real: true, ok: false, data: { error: String(e) } };
    }
  }
  sendReminderSignal({ stage: "call", medName, patient, voice: text });
  return { real: false, ok: true };
}

// Run the full escalation starting now: SMS immediately, then after the "call
// after" window, call only if the dose is still not registered. In demo mode the
// window is compressed to a few seconds so it's stage-friendly. Returns a cancel().
export function runReminderNow({ settings, dose, demoSpeed, from, patient, onStage }) {
  fireSms({ settings, dose, from, patient }).then((r) => onStage?.("sms", r));

  const afterSec = demoSpeed ? 8 : (settings?.callAfterMin ?? 5) * 60;
  const timer = setTimeout(() => {
    if (!isDoseTaken(dose.med.id, dose.time)) {
      fireCall({ settings, dose, patient }).then((r) => onStage?.("call", r));
    } else {
      onStage?.("skipped-taken");
    }
  }, afterSec * 1000);

  return () => clearTimeout(timer);
}
