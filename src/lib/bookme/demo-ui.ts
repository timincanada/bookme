import { useEffect, useState } from "react";
import { demoAvailable } from "./student-api";

/**
 * Demo coach / student shortcuts and QA fixture rows.
 * Local dev is on immediately. Production and preview ask the server, which
 * uses demoAllowed() (preview and BOOKME_ALLOW_DEMO=1 stay on). Fail closed.
 */
export function useDemoUi() {
  const [allowed, setAllowed] = useState(() => import.meta.env.DEV === true);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let alive = true;
    demoAvailable()
      .then((res) => {
        if (alive) setAllowed(Boolean(res.demo));
      })
      .catch(() => {
        if (alive) setAllowed(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return allowed;
}
