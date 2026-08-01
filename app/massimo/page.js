"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore, useTodaysDoses, doseKey, todayKey } from "@/lib/store";
import ConfirmDialog from "@/components/ConfirmDialog";
import ReminderOverlay from "@/components/ReminderOverlay";
import { subscribeReminder, sendReminderSignal } from "@/lib/reminder";

function timeLabel(t) {
  const [h] = t.split(":").map(Number);
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MassimoPage() {
  const { ready, state, takeDose, undoDose, demoSpeed } = useStore();
  const doses = useTodaysDoses();
  const [pendingConfirm, setPendingConfirm] = useState(null); // {medId, time, med}
  const [reminder, setReminder] = useState(null);

  useEffect(() => {
    return subscribeReminder((payload) => setReminder(payload));
  }, []);

  const takenCount = doses.filter((d) => d.status === "taken").length;
  const total = doses.length;
  const pct = total ? Math.round((takenCount / total) * 100) : 0;

  const isStillPending = (rem) => {
    if (!rem?.medId || !rem?.time || !state) return false;
    const key = doseKey(rem.medId, todayKey(), rem.time);
    return state.doses[key]?.status !== "taken";
  };

  const firstPending = useMemo(
    () => doses.find((d) => d.status !== "taken"),
    [doses]
  );

  if (!ready) {
    return <div className="p-8 text-center text-slate-400">Loading…</div>;
  }

  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
      ? "Good afternoon"
      : "Good evening";

  return (
    <main className="min-h-screen bg-slate-50 pb-28">
      <header className="bg-emerald-600 px-5 pb-6 pt-6 text-white">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-emerald-100">
            ← Home
          </Link>
          <span className="text-sm text-emerald-100">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold">{greeting}, Massimo 👋</h1>
        <p className="mt-1 text-emerald-100">Here are your pills for today.</p>

        <div className="mt-5 rounded-2xl bg-white/15 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>Today's progress</span>
            <span className="font-semibold">
              {takenCount} of {total} taken
            </span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4">
        <ul className="mt-5 space-y-4">
          {doses.map((d) => {
            const taken = d.status === "taken";
            return (
              <li
                key={d.key}
                className={`rounded-3xl border p-5 shadow-sm transition ${
                  taken
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-4xl">
                    {d.med.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-bold text-slate-900">
                      {d.med.name}
                    </div>
                    <div className="text-slate-500">
                      {d.med.dosage} · {d.med.pillsPerDose} {d.med.form}
                      {d.med.pillsPerDose > 1 ? "s" : ""}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      🕗 {timeLabel(d.time)} · {d.time}
                    </div>
                  </div>
                </div>

                {d.med.instructions && !taken && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    ℹ️ {d.med.instructions}
                  </p>
                )}

                {taken ? (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-lg font-semibold text-emerald-700">
                      ✓ Taken at {fmtTime(d.takenAt)}
                    </span>
                    <button
                      onClick={() => undoDose(d.med.id, d.time)}
                      className="text-sm font-medium text-slate-400 underline"
                    >
                      Undo
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      setPendingConfirm({
                        medId: d.med.id,
                        time: d.time,
                        med: d.med,
                      })
                    }
                    className="mt-4 w-full rounded-2xl bg-emerald-500 py-5 text-2xl font-extrabold text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-600"
                  >
                    I took it
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {total > 0 && takenCount === total && (
          <div className="mt-6 animate-pop rounded-3xl bg-emerald-100 p-6 text-center">
            <div className="text-4xl">🎉</div>
            <p className="mt-2 text-lg font-bold text-emerald-800">
              All done for today. Great job, Massimo!
            </p>
          </div>
        )}

        {/* Demo control: simulate a missed-dose reminder for the first pending pill */}
        {firstPending && (
          <button
            onClick={() =>
              sendReminderSignal({
                medId: firstPending.med.id,
                time: firstPending.time,
                medName: firstPending.med.name,
                dosage: firstPending.med.dosage,
                patient: "Massimo",
                from: "Lorenzo",
              })
            }
            className="mt-8 w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm text-slate-400"
          >
            ▶︎ Demo: simulate reminder for {firstPending.med.name}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingConfirm}
        med={pendingConfirm?.med}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          takeDose(pendingConfirm.medId, pendingConfirm.time);
          setPendingConfirm(null);
        }}
      />

      <ReminderOverlay
        reminder={reminder}
        demoSpeed={demoSpeed}
        isStillPending={isStillPending}
        onClose={() => setReminder(null)}
      />
    </main>
  );
}
