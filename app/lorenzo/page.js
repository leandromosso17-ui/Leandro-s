"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useStore,
  useTodaysDoses,
  daysLeft,
  runOutDate,
  buyByDate,
  formatDate,
  pillsPerDay,
} from "@/lib/store";
import AddMedModal from "@/components/AddMedModal";
import ScanModal from "@/components/ScanModal";
import SettingsModal from "@/components/SettingsModal";
import { runReminderNow } from "@/lib/notify";
import { useAutoReminders } from "@/lib/useAutoReminders";

function stockTone(days) {
  if (days <= 5) return { bar: "bg-rose-500", text: "text-rose-600", chip: "bg-rose-50 text-rose-700" };
  if (days <= 10) return { bar: "bg-amber-500", text: "text-amber-600", chip: "bg-amber-50 text-amber-700" };
  return { bar: "bg-emerald-500", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700" };
}

export default function LorenzoPage() {
  const {
    ready,
    state,
    settings,
    demoSpeed,
    addMed,
    addMedsFromScan,
    removeMed,
    updateSettings,
    resetDemo,
  } = useStore();
  const doses = useTodaysDoses();
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);

  useAutoReminders(doses, settings);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const takenCount = doses.filter((d) => d.status === "taken").length;
  const pendingDoses = doses.filter((d) => d.status !== "taken");

  const buyList = useMemo(() => {
    if (!state) return [];
    return [...state.meds]
      .map((m) => ({ med: m, days: daysLeft(m) }))
      .sort((a, b) => a.days - b.days);
  }, [state]);

  if (!ready) {
    return <div className="p-8 text-center text-slate-400">Loading…</div>;
  }

  const lowStock = buyList.filter((b) => b.days <= 10);

  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-brand-700 px-5 pb-6 pt-6 text-white">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-brand-100">
            ← Home
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs font-semibold text-white/90 underline"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => {
                if (confirm("Reset demo data?")) resetDemo();
              }}
              className="text-xs text-brand-200 underline"
            >
              reset demo
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <h1 className="text-2xl font-extrabold">Caregiver dashboard</h1>
        </div>
        <p className="mt-1 text-brand-100">
          Managing <b>Massimo's</b> medication · {state.meds.length} active meds
        </p>
        <p className="mt-1 text-xs text-brand-200">
          Reminders:{" "}
          {settings.useTwilio && settings.massimoPhone
            ? `📞 Twilio → ${settings.massimoPhone}`
            : "🖥️ simulated on Massimo's screen"}
          {settings.autoReminders ? " · auto ON" : ""}
        </p>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setShowScan(true)}
            className="flex-1 rounded-2xl bg-white py-3 font-bold text-brand-700 shadow-sm transition active:scale-[0.99]"
          >
            📷 Scan prescription
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex-1 rounded-2xl bg-brand-500 py-3 font-bold text-white shadow-sm transition active:scale-[0.99]"
          >
            ＋ Add manually
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-4 pt-5">
        {/* Adherence today */}
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Today's adherence</h2>
            <span className="text-sm font-semibold text-slate-500">
              {takenCount}/{doses.length} taken
            </span>
          </div>

          {pendingDoses.length === 0 ? (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              ✓ Massimo has taken everything scheduled so far.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pendingDoses.map((d) => (
                <li
                  key={d.key}
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"
                >
                  <span className="text-2xl">{d.med.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">
                      {d.med.name} {d.med.dosage}
                    </div>
                    <div className="text-xs text-slate-500">
                      scheduled {d.time} · not yet taken
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      runReminderNow({
                        settings,
                        dose: d,
                        demoSpeed,
                        from: "Lorenzo",
                        patient: "Massimo",
                        onStage: (stage, r) => {
                          if (stage === "call" && r?.real && !r.ok) {
                            flash(`Call failed: ${r.data?.detail || r.data?.error || "check Twilio"}`);
                          } else if (stage === "call") {
                            flash(`📞 Calling Massimo about ${d.med.name}`);
                          }
                        },
                      });
                      flash(
                        settings.useTwilio && settings.massimoPhone
                          ? `SMS sent to Massimo for ${d.med.name}`
                          : `Reminder shown on Massimo's screen for ${d.med.name}`
                      );
                    }}
                    className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Remind
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Buy calendar / low stock */}
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">🗓️ Refill calendar</h2>
          <p className="text-xs text-slate-500">
            When to send the doctor for a new prescription and restock.
          </p>

          {lowStock.length > 0 && (
            <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              ⚠️ {lowStock.length} medication{lowStock.length > 1 ? "s" : ""} running
              low — order soon.
            </div>
          )}

          <ul className="mt-3 space-y-3">
            {buyList.map(({ med, days }) => {
              const tone = stockTone(days);
              return (
                <li key={med.id} className="rounded-2xl border border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{med.emoji}</span>
                    <div className="font-semibold text-slate-900">
                      {med.name} {med.dosage}
                    </div>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${tone.chip}`}
                    >
                      {days === Infinity ? "—" : `${days} days left`}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div>
                      Runs out:{" "}
                      <b className={tone.text}>{formatDate(runOutDate(med))}</b>
                    </div>
                    <div>
                      Buy by:{" "}
                      <b className="text-slate-700">{formatDate(buyByDate(med))}</b>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* All medications */}
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">All medications</h2>
          <ul className="mt-3 space-y-3">
            {state.meds.map((med) => {
              const days = daysLeft(med);
              const tone = stockTone(days);
              const pct = med.pillsPerBox
                ? Math.min(100, Math.round((med.inventory / med.pillsPerBox) * 100))
                : 0;
              return (
                <li key={med.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                      {med.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">
                        {med.name} {med.dosage}
                      </div>
                      <div className="text-xs text-slate-500">
                        {med.purpose} · {med.pillsPerDose}/dose ·{" "}
                        {med.schedule.join(", ")} · {pillsPerDay(med)}/day
                      </div>
                    </div>
                    <button
                      onClick={() => removeMed(med.id)}
                      className="text-slate-300 hover:text-rose-500"
                      aria-label="remove"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Stock</span>
                      <span className={`font-semibold ${tone.text}`}>
                        {med.inventory} / {med.pillsPerBox} pills
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${tone.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-slide-up rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
          ✓ {toast}
        </div>
      )}

      <AddMedModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={addMed} />
      <ScanModal
        open={showScan}
        onClose={() => setShowScan(false)}
        onAddMeds={addMedsFromScan}
      />
      <SettingsModal
        open={showSettings}
        settings={settings}
        onSave={updateSettings}
        onClose={() => setShowSettings(false)}
      />
    </main>
  );
}
