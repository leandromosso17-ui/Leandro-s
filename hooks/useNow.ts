import { useEffect, useState } from 'react';

/**
 * Ticking clock so dose statuses (upcoming / due / late) stay live while a
 * screen is open. Default cadence is cheap enough for the whole app.
 */
export function useNow(intervalMs = 20_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
