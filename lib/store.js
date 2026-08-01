"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

const STORAGE_KEY = "medguard.state.v1";

// ---------- helpers ----------

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function doseKey(medId, date, time) {
  return `${medId}|${date}|${time}`;
}

export function dosesPerDay(med) {
  return med.schedule.length;
}

export function pillsPerDay(med) {
  return med.pillsPerDose * dosesPerDay(med);
}

// Days of supply remaining given current inventory.
export function daysLeft(med) {
  const perDay = pillsPerDay(med);
  if (perDay <= 0) return Infinity;
  return Math.floor(med.inventory / perDay);
}

export function runOutDate(med) {
  const d = new Date();
  d.setDate(d.getDate() + daysLeft(med));
  return d;
}

// Recommend buying a few days before you actually run out.
export function buyByDate(med, buffer = 3) {
  const d = runOutDate(med);
  d.setDate(d.getDate() - buffer);
  return d;
}

export function formatDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ---------- seed data (Massimo's regimen) ----------

function seedState() {
  const meds = [
    {
      id: "ramipril",
      name: "Ramipril",
      dosage: "10 mg",
      form: "tablet",
      purpose: "Blood pressure",
      pillsPerDose: 1,
      schedule: ["08:00"],
      inventory: 9,
      pillsPerBox: 28,
      emoji: "🔴",
      instructions: "Take with breakfast, with water.",
    },
    {
      id: "metformin",
      name: "Metformin",
      dosage: "850 mg",
      form: "tablet",
      purpose: "Diabetes",
      pillsPerDose: 1,
      schedule: ["08:00", "20:00"],
      inventory: 26,
      pillsPerBox: 60,
      emoji: "🔵",
      instructions: "Take with meals to avoid stomach upset.",
    },
    {
      id: "atorvastatin",
      name: "Atorvastatin",
      dosage: "20 mg",
      form: "tablet",
      purpose: "Cholesterol",
      pillsPerDose: 1,
      schedule: ["20:00"],
      inventory: 30,
      pillsPerBox: 30,
      emoji: "🟡",
      instructions: "Take in the evening.",
    },
    {
      id: "aspirin",
      name: "Aspirin (cardio)",
      dosage: "100 mg",
      form: "tablet",
      purpose: "Heart protection",
      pillsPerDose: 1,
      schedule: ["08:00"],
      inventory: 4,
      pillsPerBox: 30,
      emoji: "⚪",
      instructions: "Take after breakfast.",
    },
  ];

  return { meds, doses: {} };
}

// ---------- context ----------

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(null); // null until hydrated
  const [demoSpeed, setDemoSpeed] = useState(true); // demo = compressed timers

  // hydrate from localStorage once on mount
  useEffect(() => {
    let initial;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      initial = raw ? JSON.parse(raw) : seedState();
    } catch {
      initial = seedState();
    }
    setState(initial);
  }, []);

  // persist
  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

  const takeDose = useCallback((medId, time, date = todayKey()) => {
    setState((prev) => {
      if (!prev) return prev;
      const key = doseKey(medId, date, time);
      if (prev.doses[key]?.status === "taken") return prev; // already taken
      const meds = prev.meds.map((m) =>
        m.id === medId
          ? { ...m, inventory: Math.max(0, m.inventory - m.pillsPerDose) }
          : m
      );
      return {
        ...prev,
        meds,
        doses: {
          ...prev.doses,
          [key]: { status: "taken", takenAt: new Date().toISOString() },
        },
      };
    });
  }, []);

  const undoDose = useCallback((medId, time, date = todayKey()) => {
    setState((prev) => {
      if (!prev) return prev;
      const key = doseKey(medId, date, time);
      if (prev.doses[key]?.status !== "taken") return prev;
      const meds = prev.meds.map((m) =>
        m.id === medId
          ? { ...m, inventory: m.inventory + m.pillsPerDose }
          : m
      );
      const doses = { ...prev.doses };
      delete doses[key];
      return { ...prev, meds, doses };
    });
  }, []);

  const addMed = useCallback((med) => {
    setState((prev) => {
      if (!prev) return prev;
      const id =
        med.id ||
        med.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
      return { ...prev, meds: [...prev.meds, { ...med, id }] };
    });
  }, []);

  const addMedsFromScan = useCallback((meds) => {
    setState((prev) => {
      if (!prev) return prev;
      const withIds = meds.map((m, i) => ({
        ...m,
        id:
          m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
          "-" +
          (Date.now() + i),
      }));
      // avoid duplicates by name
      const existingNames = new Set(prev.meds.map((m) => m.name.toLowerCase()));
      const fresh = withIds.filter(
        (m) => !existingNames.has(m.name.toLowerCase())
      );
      return { ...prev, meds: [...prev.meds, ...fresh] };
    });
  }, []);

  const removeMed = useCallback((medId) => {
    setState((prev) =>
      prev ? { ...prev, meds: prev.meds.filter((m) => m.id !== medId) } : prev
    );
  }, []);

  const resetDemo = useCallback(() => {
    setState(seedState());
  }, []);

  const value = useMemo(
    () => ({
      state,
      ready: !!state,
      demoSpeed,
      setDemoSpeed,
      takeDose,
      undoDose,
      addMed,
      addMedsFromScan,
      removeMed,
      resetDemo,
    }),
    [state, demoSpeed, takeDose, undoDose, addMed, addMedsFromScan, removeMed, resetDemo]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// Build today's dose list (one entry per med per scheduled time), sorted by time.
export function useTodaysDoses() {
  const { state } = useStore();
  const date = todayKey();
  return useMemo(() => {
    if (!state) return [];
    const list = [];
    for (const med of state.meds) {
      for (const time of med.schedule) {
        const key = doseKey(med.id, date, time);
        list.push({
          key,
          med,
          time,
          status: state.doses[key]?.status || "pending",
          takenAt: state.doses[key]?.takenAt || null,
        });
      }
    }
    list.sort((a, b) => a.time.localeCompare(b.time));
    return list;
  }, [state, date]);
}
