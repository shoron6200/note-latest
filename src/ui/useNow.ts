import { useEffect, useState } from 'react';

/** The current time, refreshed every minute, so "Today" and "5 min ago" stay true. */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(h);
  }, [everyMs]);
  return now;
}
