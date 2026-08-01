"use client";

// Double-check dialog so an accidental tap never marks a dose as taken.
export default function ConfirmDialog({ open, med, onConfirm, onCancel }) {
  if (!open || !med) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm animate-slide-up rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
          {med.emoji}
        </div>
        <h2 className="mt-4 text-center text-xl font-bold text-slate-900">
          Confirm you took it
        </h2>
        <p className="mt-2 text-center text-slate-600">
          Did you just take your{" "}
          <span className="font-semibold text-slate-900">
            {med.name} {med.dosage}
          </span>
          ?
        </p>

        <div className="mt-6 space-y-3">
          <button
            onClick={onConfirm}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-lg font-bold text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-600"
          >
            ✓ Yes, I took it
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-2xl bg-slate-100 py-4 text-lg font-semibold text-slate-700 transition active:scale-[0.98] hover:bg-slate-200"
          >
            No, cancel
          </button>
        </div>
      </div>
    </div>
  );
}
