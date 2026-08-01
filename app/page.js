import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="flex items-center gap-2 text-brand-700">
          <span className="text-3xl">🛡️</span>
          <span className="text-2xl font-extrabold tracking-tight">MedGuard</span>
        </div>
        <h1 className="mt-6 text-3xl font-bold leading-tight text-slate-900">
          Keep the people you love on their medication — on time, every time.
        </h1>
        <p className="mt-3 text-slate-600">
          A caregiver dashboard for adult children, and a beautifully simple
          reminder app for their parents. Track doses, stock, and never run out.
        </p>

        <div className="mt-8 space-y-4">
          <Link
            href="/lorenzo"
            className="block rounded-2xl border border-brand-200 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">
                🧑‍💻
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  I'm Lorenzo
                </div>
                <div className="text-sm text-slate-500">
                  Caregiver — manage Dad's meds, stock & reminders
                </div>
              </div>
              <div className="ml-auto text-brand-500">→</div>
            </div>
          </Link>

          <Link
            href="/massimo"
            className="block rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
                👴
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  I'm Massimo
                </div>
                <div className="text-sm text-slate-500">
                  Patient — my pills for today, big and simple
                </div>
              </div>
              <div className="ml-auto text-emerald-500">→</div>
            </div>
          </Link>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Hackathon MVP · SMS &amp; call reminders simulated · voice by ElevenLabs
        </p>
      </div>
    </main>
  );
}
