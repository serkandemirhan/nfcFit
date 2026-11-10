import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { zonedDate } from "@/lib/coaching-performance";
import { sessionTimezone } from "@/lib/session-presentation";

/** Update at local-day rollover and foreground return, without rerendering every minute. */
export function useSessionClock(preferredTimezone?: string) {
  const timezone = sessionTimezone(preferredTimezone);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow((previous) =>
        zonedDate(previous, timezone) === zonedDate(current, timezone)
          ? previous
          : current,
      );
    };
    setNow(new Date());
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          tick();
          schedule();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    schedule();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [timezone]);
  return now;
}
