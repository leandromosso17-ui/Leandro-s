"use client";

import { useState } from "react";
import { EVERY_DAY } from "@/lib/store";

const TIME_OPTIONS = [
  { label: "Morning", time: "08:00" },
  { label: "Afternoon", time: "13:00" },
  { label: "Evening", time: "20:00" },
];

const WEEKDAYS = [
  { label: "M", d: 1 },
  { label: "T", d: 2 },
  { label: "W", d: 3 },
  { label: "T", d: 4 },
  { label: "F", d: 5 },
  { label: "S", d: 6 },
  { label: "S", d: 0 },
];

const EMOJI_OPTIONS = ["💊", "🔴", "🔵", "🟡", "🟢", "🟣", "🟠", "⚪", "💉"];

export default function AddMedModal({ open, onClose, onAdd }) {
  const [form, setForm] = useState({
    name: "",
    dosage: "",
    purpose: "",
    pillsPerDose: 1,
    times: ["08:00"],
    freq: "daily", // "daily" | "weekly"
    days: [1], // used when freq === "weekly"
    inventory: 30,
    pillsPerBox: 30,
    emoji: "💊",
    instructions: "",
  });

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleTime = (time) => {
    setForm((f) => {
      const has = f.times.includes(time);
      const times = has ? f.times.filter((t) => t !== time) : [...f.times, time];
      return { ...f, times: times.sort() };
    });
  };

  const toggleDay = (d) => {
    setForm((f) => {
      const has = f.days.includes(d);
      const days = has ? f.days.filter((x) => x !== d) : [...f.days, d];
      return { ...f, days: days.sort() };
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.times.length === 0) return;
    const days = form.freq === "weekly" ? form.days : EVERY_DAY;
    if (days.length === 0) return; // weekly needs at least one day
    onAdd({
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      purpose: form.purpose.trim(),
      form: "tablet",
      pillsPerDose: Number(form.pillsPerDose) || 1,
      schedule: form.times,
      days,
      inventory: Number(form.inventory) || 0,
      pillsPerBox: Number(form.pillsPerBox) || 0,
      emoji: form.emoji,
      instructions: form.instructions.trim(),
    });
    onClose();
    setForm({
      name: "",
      dosage: "",
      purpose: "",
      pillsPerDose: 1,
      times: ["08:00"],
      freq: "daily",
      days: [1],
      inventory: 30,
      pillsPerBox: 30,
      emoji: "💊",
      instructions: "",
    });
  };

  const field = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Add a medication</h2>
          <button type="button" onClick={onClose} className="text-slate-400">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="col-span-2 text-sm font-medium text-slate-600">
            Name
            <input
              className={field}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Ramipril"
              autoFocus
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            Dosage
            <input
              className={field}
              value={form.dosage}
              onChange={(e) => set("dosage", e.target.value)}
              placeholder="10 mg"
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            Purpose
            <input
              className={field}
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              placeholder="Blood pressure"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium text-slate-600">When to take</div>
          <div className="mt-2 flex gap-2">
            {TIME_OPTIONS.map((o) => {
              const active = form.times.includes(o.time);
              return (
                <button
                  type="button"
                  key={o.time}
                  onClick={() => toggleTime(o.time)}
                  className={`flex-1 rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {o.label}
                  <div className="text-xs font-normal">{o.time}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium text-slate-600">How often</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => set("freq", "daily")}
              className={`flex-1 rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                form.freq === "daily"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              Every day
            </button>
            <button
              type="button"
              onClick={() => set("freq", "weekly")}
              className={`flex-1 rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                form.freq === "weekly"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              Specific days
            </button>
          </div>

          {form.freq === "weekly" && (
            <div className="mt-2 flex gap-1.5">
              {WEEKDAYS.map((w) => {
                const active = form.days.includes(w.d);
                return (
                  <button
                    type="button"
                    key={w.d}
                    onClick={() => toggleDay(w.d)}
                    className={`h-9 flex-1 rounded-lg border text-sm font-semibold transition ${
                      active
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                    aria-label={`weekday ${w.d}`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-400">
            {form.freq === "weekly"
              ? "Taken on the selected weekdays, at the times above."
              : "Taken every day, at the times above."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <label className="text-sm font-medium text-slate-600">
            Pills / dose
            <input
              type="number"
              min="1"
              className={field}
              value={form.pillsPerDose}
              onChange={(e) => set("pillsPerDose", e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            In stock
            <input
              type="number"
              min="0"
              className={field}
              value={form.inventory}
              onChange={(e) => set("inventory", e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-slate-600">
            Box size
            <input
              type="number"
              min="0"
              className={field}
              value={form.pillsPerBox}
              onChange={(e) => set("pillsPerBox", e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium text-slate-600">Icon</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => set("emoji", e)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${
                  form.emoji === e
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-200"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-600">
          Instructions (optional)
          <input
            className={field}
            value={form.instructions}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder="Take with food"
          />
        </label>

        <button
          type="submit"
          className="mt-6 w-full rounded-2xl bg-brand-600 py-3 text-lg font-bold text-white transition active:scale-[0.99] hover:bg-brand-700"
        >
          Add medication
        </button>
      </form>
    </div>
  );
}
