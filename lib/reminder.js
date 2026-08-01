"use client";

// Lightweight reminder bus. Lorenzo's dashboard can push a reminder to Massimo's
// screen across browser tabs / devices (same browser) via a localStorage key,
// and within the same tab via a CustomEvent.

const SIGNAL_KEY = "medguard.reminder.signal";

export function sendReminderSignal(payload) {
  const data = { ...payload, at: Date.now() };
  try {
    window.localStorage.setItem(SIGNAL_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("medguard-reminder", { detail: data }));
}

export function subscribeReminder(cb) {
  const onStorage = (e) => {
    if (e.key === SIGNAL_KEY && e.newValue) {
      try {
        cb(JSON.parse(e.newValue));
      } catch {
        /* ignore */
      }
    }
  };
  const onLocal = (e) => cb(e.detail);
  window.addEventListener("storage", onStorage);
  window.addEventListener("medguard-reminder", onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("medguard-reminder", onLocal);
  };
}
