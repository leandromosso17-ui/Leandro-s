"use client";

import { useEffect, useState } from "react";
import { speak } from "@/lib/voice";

// Renders the current reminder stage pushed to Massimo's screen (simulate mode):
//   stage "sms"  -> SMS banner at the top
//   stage "call" -> full-screen incoming call, voiced by ElevenLabs
export default function ReminderOverlay({ reminder, onClose }) {
  const [voiceSource, setVoiceSource] = useState(null);

  useEffect(() => {
    if (reminder?.stage === "call" && reminder?.voice) {
      setVoiceSource(null);
      speak(reminder.voice).then((r) => setVoiceSource(r?.source || null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminder?.at, reminder?.stage]);

  const close = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    onClose?.();
  };

  if (!reminder) return null;

  if (reminder.stage === "sms") {
    return (
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-3">
        <div className="w-full max-w-sm animate-slide-up rounded-2xl bg-slate-900 p-4 text-white shadow-2xl">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="text-lg">💬</span>
            <span className="font-semibold">MedGuard SMS</span>
            <span className="ml-auto">now</span>
          </div>
          <p className="mt-2 text-[15px] leading-snug">
            {reminder.from || "Lorenzo"}: Ciao {reminder.patient || "Massimo"}, don't
            forget to take <b>{reminder.medName}</b>. Have a great day. 💊
          </p>
          <div className="mt-3 text-right">
            <button
              onClick={close}
              className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  // call stage
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
          Ciao {reminder.patient || "Massimo"}, don't forget to take{" "}
          <b>{reminder.medName}</b>.
        </p>
        {voiceSource && (
          <p className="mt-2 text-xs text-slate-400">
            🔊 Voice: {voiceSource === "elevenlabs" ? "ElevenLabs" : "device fallback"}
          </p>
        )}
      </div>

      <div className="mb-10 flex w-full max-w-xs items-center justify-around">
        <button onClick={close} className="flex flex-col items-center gap-2">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl shadow-lg">
            ✓
          </span>
          <span className="text-sm text-slate-300">I'll take it</span>
        </button>
        <button onClick={close} className="flex flex-col items-center gap-2">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-2xl shadow-lg">
            ✕
          </span>
          <span className="text-sm text-slate-300">Dismiss</span>
        </button>
      </div>
    </div>
  );
}
