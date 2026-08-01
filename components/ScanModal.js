"use client";

import { useState } from "react";
import { SAMPLE_SCAN } from "@/lib/sampleScan";

// Simulated prescription scan. A real build would POST the photo to a vision
// model (e.g. Claude vision) and receive structured medication data; here we
// return a pre-baked result so the demo reliably populates the dashboard.
export default function ScanModal({ open, onClose, onAddMeds }) {
  const [step, setStep] = useState("capture"); // capture | analyzing | review
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState({});

  if (!open) return null;

  const reset = () => {
    setStep("capture");
    setPreview(null);
    setSelected({});
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
    startAnalyze();
  };

  const startAnalyze = () => {
    setStep("analyzing");
    setTimeout(() => {
      const sel = {};
      SAMPLE_SCAN.meds.forEach((_, i) => (sel[i] = true));
      setSelected(sel);
      setStep("review");
    }, 1800);
  };

  const confirm = () => {
    const meds = SAMPLE_SCAN.meds.filter((_, i) => selected[i]);
    onAddMeds(meds);
    onClose();
    reset();
  };

  const close = () => {
    onClose();
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div className="max-h-[92vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">📷 Scan prescription</h2>
          <button onClick={close} className="text-slate-400">
            ✕
          </button>
        </div>

        {step === "capture" && (
          <div className="mt-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-brand-400 hover:bg-brand-50">
              <span className="text-5xl">🖼️</span>
              <span className="mt-3 font-semibold text-slate-700">
                Choose a prescription photo
              </span>
              <span className="mt-1 text-sm text-slate-400">
                from your gallery / files
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </label>
            <button
              onClick={startAnalyze}
              className="mt-4 w-full rounded-2xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-700"
            >
              Use sample prescription
            </button>
          </div>
        )}

        {step === "analyzing" && (
          <div className="mt-4 flex flex-col items-center py-10">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="prescription"
                className="mb-6 max-h-40 rounded-xl object-contain shadow"
              />
            )}
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            <p className="mt-4 font-semibold text-slate-700">
              Reading prescription…
            </p>
            <p className="text-sm text-slate-400">
              Extracting medications, doses &amp; schedule
            </p>
          </div>
        )}

        {step === "review" && (
          <div className="mt-4">
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✓ Found {SAMPLE_SCAN.meds.length} medications · {SAMPLE_SCAN.doctor},{" "}
              {SAMPLE_SCAN.date}
            </div>
            <ul className="mt-3 space-y-2">
              {SAMPLE_SCAN.meds.map((m, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"
                >
                  <input
                    type="checkbox"
                    checked={!!selected[i]}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [i]: e.target.checked }))
                    }
                    className="h-5 w-5 accent-brand-600"
                  />
                  <span className="text-2xl">{m.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">
                      {m.name} {m.dosage}
                    </div>
                    <div className="text-sm text-slate-500">
                      {m.purpose} · {m.schedule.length}×/day · {m.inventory} in box
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={confirm}
              className="mt-5 w-full rounded-2xl bg-brand-600 py-3 text-lg font-bold text-white hover:bg-brand-700"
            >
              Add selected to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
