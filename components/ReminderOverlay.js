"use client";

import { useEffect, useRef, useState } from "react";
import { speak } from "@/lib/voice";

// Escalation: SMS banner first. If the dose is still not registered after a
// delay (30 min in real life, a few seconds in demo mode), it escalates to a
// phone "call" voiced by ElevenLabs.
export default function ReminderOverlay({
  reminder,
  onClose,
  isStillPending,
  demoSpeed,
}) {
  const [phase, setPhase] = useState("idle"); // idle | sms | calling
  const [countdown, setCountdown] = useState(0);
  const [voiceSource, setVoiceSource] = useState(null);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.forEach((t) => clearInterval(t));
    timers.current = [];
  };

  useEffect(() => {
    if (!reminder) return;
    clearTimers();
    setPhase("sms");
    setVoiceSource(null);

    const escalateSec = demoSpeed ? 8 : 30 * 60;
    setCountdown(escalateSec);

    const tick = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    timers.current.push(tick);

    const escalate = setTimeout(() => {
      clearInterval(tick);
      // Only call if the dose is still not registered.
      if (isStillPending?.(reminder)) {
        setPhase("calling");
        const voiceMsg =
          reminder.voice ||
          `Ciao ${reminder.patient || "Massimo"}. This is your MedGuard reminder from ${
            reminder.from || "Lorenzo"
          }. It is time to take your ${reminder.medName}${
            reminder.dosage ? ", " + reminder.dosage : ""
          }. Please take it now and tap the green button in your app. Thank you, and take care.`;
        speak(voiceMsg).then((r) => setVoiceSource(r?.source || null));
      } else {
        onClose?.();
      }
    }, escalateSec * 1000);
    timers.current.push(escalate);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminder?.at]);

  const handleClose = () => {
    clearTimers();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPhase("idle");
    onClose?.();
  };

  if (!reminder || phase === "idle") return null;

  // ----- SMS phase -----
  if (phase === "sms") {
    return (
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-3">
        <div className="w-full max-w-sm animate-slide-up rounded-2xl bg-slate-900 p-4 text-white shadow-2xl">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="text-lg">💬</span>
            <span className="font-semibold">MedGuard SMS</span>
            <span className="ml-auto">now</span>
          </div>
          <p className="mt-2 text-[15px] leading-snug">
            {reminder.from || "Lorenzo"}: Hi {reminder.patient || "Massimo"}, it's
            time for your <b>{reminder.medName}</b>
            {reminder.dosage ? ` (${reminder.dosage})` : ""}. Please take it and tap
            the green button. 💊
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>
              📞 Calling in{" "}
              <span className="font-mono text-amber-300">{countdown}s</span> if not
              registered
            </span>
            <button
              onClick={handleClose}
              className="rounded-lg bg-white/10 px-3 py-1 font-semibold text-white hover:bg-white/20"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Calling phase -----
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-800 to-slate-950 p-8 text-white">
      <div className="mt-16 text-center">
        <div className="text-sm uppercase tracking-widest text-slate-400">
          Incoming call
        </div>
        <div className="mt-2 text-3xl font-bold">MedGuard</div>
        <div className="mt-1 text-slate-300">Medication reminder</div>
      </div>

      <div className="flex flex-col items-center">
        <div className="animate-ring flex h-32 w-32 items-center justify-center rounded-full bg-emerald-500/20 text-6xl">
          📞
        </div>
        <p className="mt-6 max-w-xs text-center text-lg">
          Time to take your <b>{reminder.medName}</b>
          {reminder.dosage ? ` ${reminder.dosage}` : ""}
        </p>
        {voiceSource && (
          <p className="mt-2 text-xs text-slate-400">
            🔊 Voice: {voiceSource === "elevenlabs" ? "ElevenLabs" : "device fallback"}
          </p>
        )}
      </div>

      <div className="mb-10 flex w-full max-w-xs items-center justify-around">
        <button
          onClick={handleClose}
          className="flex flex-col items-center gap-2"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl shadow-lg">
            ✓
          </span>
          <span className="text-sm text-slate-300">I'll take it</span>
        </button>
        <button
          onClick={handleClose}
          className="flex flex-col items-center gap-2"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-2xl shadow-lg">
            ✕
          </span>
          <span className="text-sm text-slate-300">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
