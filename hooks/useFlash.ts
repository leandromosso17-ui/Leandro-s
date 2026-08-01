import { useCallback, useEffect, useRef, useState } from 'react';

/** Short-lived confirmation message shown after an action ("SMS sent", ...). */
export function useFlash(durationMs = 3200) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(
    (text: string) => {
      setMessage(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { message, flash, clear };
}
