/** Keep a focused field above the keyboard without jumping the header off screen. */
export function keepFieldVisible(el: HTMLElement) {
  const run = () => {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  run();
  window.setTimeout(run, 280);
}
