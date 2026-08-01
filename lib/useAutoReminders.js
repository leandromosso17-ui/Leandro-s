"use client";

import { useEffect } from "react";
import { isDoseTaken } from "./store";
import { fireSms, fireCall } from "./notify";

function todayAt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// Automatically fires the reminder chain at real clock times:
//   SMS  at  doseTime - smsLeadMin   (default 15 min before)
//   Call at  doseTime + callAfterMin (default 5 min after) — only if still pending
// Runs while this page (Lorenzo's dashboard) stays open. Opt-in via settings.
export function useAutoReminders(doses, settings) {
  useEffect(() => {
    if (!settings?.autoReminders || !doses?.length) return;
    const now = Date.now();
    const timers = [];

    for (const d of doses) {
      if (d.status === "taken") continue;
      const doseMs = todayAt(d.time);
      const smsAt = doseMs - (settings.smsLeadMin ?? 15) * 60000;
      const callAt = doseMs + (settings.callAfterMin ?? 5) * 60000;

      if (smsAt > now) {
        timers.push(
          setTimeout(() => {
            if (!isDoseTaken(d.med.id, d.time)) fireSms({ settings, dose: d });
          }, smsAt - now)
        );
      }
      if (callAt > now) {
        timers.push(
          setTimeout(() => {
            if (!isDoseTaken(d.med.id, d.time)) fireCall({ settings, dose: d });
          }, callAt - now)
        );
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [
    doses,
    settings?.autoReminders,
    settings?.smsLeadMin,
    settings?.callAfterMin,
    settings?.useTwilio,
    settings?.massimoPhone,
  ]);
}
