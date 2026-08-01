"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import Onboarding from "@/components/Onboarding";

export default function Home() {
  const { ready, settings, updateSettings } = useStore();

  if (!ready) {
    return <div className="p-8 text-center text-slate-400">Loading…</div>;
  }

  if (!settings.onboarded) {
    return <Onboarding settings={settings} onDone={updateSettings} />;
  }

  const caregiver = settings.caregiverName || "Lorenzo";
  const patient = settings.patientName || "Massimo";

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-700">
            <span className="text-3xl">🛡️</span>
            <span className="text-2xl font-extrabold tracking-tight">MedGuard</span>
          </div>
        </div>
        <h1 className="mt-6 text-3xl font-bold leading-tight text-slate-900">
          Keep {patient} on their medication — on time, every time.
        </h1>
        <p className="mt-3 text-slate-600">
          Open the caregiver dashboard, or {patient}'s simple daily view. You can
          switch between them any time from the button in the top right.
        </p>

        <div className="mt-8 space-y-4">
          <Link
            href="/lorenzo"
            className="block rounded-2xl border border-brand-200 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">
                🧑‍💻
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  I'm {caregiver}
                </div>
                <div className="text-sm text-slate-500">
                  Caregiver — manage {patient}'s meds, stock &amp; reminders
                </div>
              </div>
              <div className="ml-auto text-brand-500">→</div>
            </div>
          </Link>

          <Link
            href="/massimo"
            className="block rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
                👴
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  I'm {patient}
                </div>
                <div className="text-sm text-slate-500">
                  My pills for today, big and simple
                </div>
              </div>
              <div className="ml-auto text-emerald-500">→</div>
            </div>
          </Link>
        </div>

        <button
          onClick={() => updateSettings({ onboarded: false })}
          className="mt-8 w-full text-center text-xs text-slate-400 underline"
        >
          Change names
        </button>
      </div>
    </main>
  );
}
