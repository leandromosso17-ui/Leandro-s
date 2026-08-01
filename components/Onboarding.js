"use client";

import { useState } from "react";

// First-run setup: choose the two names (and optionally the patient's phone).
export default function Onboarding({ settings, onDone }) {
  const [caregiverName, setCaregiver] = useState(settings.caregiverName || "");
  const [patientName, setPatient] = useState(settings.patientName || "");
  const [phone, setPhone] = useState(settings.massimoPhone || "");

  const field =
    "mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  const submit = (e) => {
    e.preventDefault();
    onDone({
      caregiverName: caregiverName.trim() || "Lorenzo",
      patientName: patientName.trim() || "Massimo",
      massimoPhone: phone.trim(),
      onboarded: true,
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <div className="flex items-center gap-2 text-brand-700">
          <span className="text-3xl">🛡️</span>
          <span className="text-2xl font-extrabold tracking-tight">MedGuard</span>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">
          Let's set things up
        </h1>
        <p className="mt-2 text-slate-600">
          Who's caring, and who are we helping stay on their medication?
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block text-sm font-medium text-slate-600">
            Caregiver's name (that's you)
            <input
              className={field}
              value={caregiverName}
              onChange={(e) => setCaregiver(e.target.value)}
              placeholder="Lorenzo"
              autoFocus
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Parent's name
            <input
              className={field}
              value={patientName}
              onChange={(e) => setPatient(e.target.value)}
              placeholder="Massimo"
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Parent's phone (optional — for SMS &amp; call reminders)
            <input
              className={field}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+39 333 123 4567"
              inputMode="tel"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white shadow-sm transition active:scale-[0.99] hover:bg-brand-700"
          >
            Get started →
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          You can change these any time in ⚙️ Settings.
        </p>
      </div>
    </main>
  );
}
