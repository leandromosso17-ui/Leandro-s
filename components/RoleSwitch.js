"use client";

import Link from "next/link";

// Top-right segmented switch between the two landings.
export default function RoleSwitch({ current, caregiverName, patientName }) {
  const base =
    "px-3 py-1.5 rounded-full text-sm font-semibold transition whitespace-nowrap";
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-white/20 p-1 backdrop-blur">
      <Link
        href="/lorenzo"
        className={
          base +
          (current === "lorenzo"
            ? " bg-white text-slate-900 shadow"
            : " text-white/90 hover:bg-white/10")
        }
      >
        {caregiverName || "Lorenzo"}
      </Link>
      <Link
        href="/massimo"
        className={
          base +
          (current === "massimo"
            ? " bg-white text-slate-900 shadow"
            : " text-white/90 hover:bg-white/10")
        }
      >
        {patientName || "Massimo"}
      </Link>
    </div>
  );
}
