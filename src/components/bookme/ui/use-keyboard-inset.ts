import { useEffect, useState, type RefObject } from "react";

/**
 * While the keyboard is open on a phone, pin the coach shell to the visual
 * viewport so the composer and focused fields stay on screen. Chrome also
 * gets interactive-widget=resizes-content; this covers iOS, where dvh does not
 * shrink for the keyboard.
 */
export function useCoachKeyboard(
  shellRef: RefObject<HTMLElement | null>,
  opts: { active: boolean; fill: boolean },
) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!opts.active) return;
    const shell = shellRef.current;
    const vv = window.visualViewport;
    if (!shell || !vv) return;
    const mq = window.matchMedia("(max-width: 767px)");

    const clearPin = () => {
      shell.style.height = "";
      shell.style.position = "";
      shell.style.top = "";
      shell.style.left = "";
      shell.style.right = "";
      shell.style.width = "";
      shell.style.overflowY = "";
    };

    const sync = () => {
      if (!mq.matches) {
        clearPin();
        document.documentElement.removeAttribute("data-keyboard");
        setKeyboardOpen(false);
        return;
      }
      const obscured = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const open = obscured > 120;
      setKeyboardOpen((prev) => (prev === open ? prev : open));
      if (open) document.documentElement.setAttribute("data-keyboard", "true");
      else document.documentElement.removeAttribute("data-keyboard");
      if (!open) {
        clearPin();
        return;
      }
      shell.style.height = `${vv.height}px`;
      shell.style.position = "fixed";
      shell.style.top = `${vv.offsetTop}px`;
      shell.style.left = "0";
      shell.style.right = "0";
      shell.style.width = "100%";
      shell.style.overflowY = opts.fill ? "" : "auto";
      const active = document.activeElement;
      if (active instanceof HTMLElement && shell.contains(active) && !opts.fill) {
        window.setTimeout(() => active.scrollIntoView({ block: "nearest" }), 40);
      }
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    mq.addEventListener("change", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      mq.removeEventListener("change", sync);
      clearPin();
      document.documentElement.removeAttribute("data-keyboard");
    };
  }, [opts.active, opts.fill, shellRef]);

  return keyboardOpen;
}
