import { useEffect, useState } from "react";

/** Milliseconds since mount, ticking while `running`. */
export function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const start = performance.now() - elapsed;
    const timer = window.setInterval(() => setElapsed(performance.now() - start), 120);
    return () => window.clearInterval(timer);
    // `elapsed` is only the resume point; re-running on each tick would reset the timer.
  }, [running]);

  return elapsed;
}
