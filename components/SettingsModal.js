"use client";

import { useState } from "react";

export default function SettingsModal({ open, settings, onSave, onClose }) {
  const [form, setForm] = useState(settings);
  const [test, setTest] = useState(null); // {kind, ok, msg}

  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const field =
    "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  const runTest = async (kind) => {
    setTest({ kind, ok: null, msg: "Sending…" });
    if (!form.massimoPhone) {
      setTest({ kind, ok: false, msg: "Enter Massimo's phone number first." });
      return;
    }
    try {
      const endpoint = kind === "sms" ? "/api/sms" : "/api/call";
      const payload =
        kind === "sms"
          ? { to: form.massimoPhone, body: "Ciao Massimo, this is a MedGuard test. Have a great day." }
          : { to: form.massimoPhone, text: "Ciao Massimo, this is a MedGuard test call. Have a great day." };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTest({ kind, ok: true, msg: `Sent ✓ (${data.status || "queued"})` });
      } else if (res.status === 503) {
        setTest({ kind, ok: false, msg: "Twilio not configured on the server (env vars)." });
      } else {
        setTest({ kind, ok: false, msg: data?.detail || data?.error || "Failed." });
      }
    } catch (e) {
      setTest({ kind, ok: false, msg: String(e) });
    }
  };

  const save = () => {
    onSave({
      ...form,
      smsLeadMin: Number(form.smsLeadMin) || 15,
      callAfterMin: Number(form.callAfterMin) || 5,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div className="max-h-[92vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">⚙️ Reminder settings</h2>
          <button onClick={onClose} className="text-slate-400">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-600">
            Caregiver's name
            <input
              className={field}
              value={form.caregiverName || ""}
              onChange={(e) => set("caregiverName", e.target.value)}
              placeholder="Lorenzo"
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            Parent's name
            <input
              className={field}
              value={form.patientName || ""}
              onChange={(e) => set("patientName", e.target.value)}
              placeholder="Massimo"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-600">
          {form.patientName || "Massimo"}'s phone (E.164)
          <input
            className={field}
            value={form.massimoPhone}
            onChange={(e) => set("massimoPhone", e.target.value)}
            placeholder="+39 333 123 4567"
          />
          <span className="mt-1 block text-xs text-slate-400">
            On a Twilio trial, this number must be verified in the Twilio console.
          </span>
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-600">
            SMS before dose (min)
            <input
              type="number"
              min="0"
              className={field}
              value={form.smsLeadMin}
              onChange={(e) => set("smsLeadMin", e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            Call after dose (min)
            <input
              type="number"
              min="0"
              className={field}
              value={form.callAfterMin}
              onChange={(e) => set("callAfterMin", e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={!!form.useTwilio}
              onChange={(e) => set("useTwilio", e.target.checked)}
              className="h-5 w-5 accent-brand-600"
            />
            <span className="text-sm">
              <b>Use Twilio</b> for real SMS &amp; calls
              <span className="block text-xs text-slate-400">
                Off = simulate on Massimo's screen (great for offline demos).
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={!!form.autoReminders}
              onChange={(e) => set("autoReminders", e.target.checked)}
              className="h-5 w-5 accent-brand-600"
            />
            <span className="text-sm">
              <b>Automatic reminders</b> at scheduled times
              <span className="block text-xs text-slate-400">
                Fires SMS {form.smsLeadMin || 15}m before &amp; a call {form.callAfterMin || 5}m
                after — while this dashboard stays open.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => runTest("sms")}
            className="flex-1 rounded-xl border border-brand-200 bg-brand-50 py-2 text-sm font-semibold text-brand-700"
          >
            Send test SMS
          </button>
          <button
            onClick={() => runTest("call")}
            className="flex-1 rounded-xl border border-brand-200 bg-brand-50 py-2 text-sm font-semibold text-brand-700"
          >
            Test call
          </button>
        </div>
        {test && (
          <p
            className={`mt-2 text-sm ${
              test.ok === true
                ? "text-emerald-600"
                : test.ok === false
                ? "text-rose-600"
                : "text-slate-500"
            }`}
          >
            {test.kind === "sms" ? "SMS: " : "Call: "}
            {test.msg}
          </p>
        )}

        <button
          onClick={save}
          className="mt-6 w-full rounded-2xl bg-brand-600 py-3 text-lg font-bold text-white hover:bg-brand-700"
        >
          Save settings
        </button>
      </div>
    </div>
  );
}
