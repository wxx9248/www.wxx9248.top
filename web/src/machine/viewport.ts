/**
 * Keep `element` inside the part of the page the visitor can see, so a phone
 * keyboard shrinks the terminal instead of covering its last rows. Chrome and
 * Firefox already shrink the page (interactive-widget in index.html); iOS
 * Safari draws the keyboard over it and only shrinks the visual viewport.
 */
export function followVisualViewport(element: HTMLElement) {
  const view = window.visualViewport;
  if (!view) return;
  const update = () => {
    // A pinch zoom shrinks the visual viewport too; only the keyboard should
    // resize the terminal.
    if (Math.abs(view.scale - 1) > 0.01) return;
    element.style.top = `${view.offsetTop}px`;
    element.style.height = `${view.height}px`;
  };
  view.addEventListener("resize", update);
  view.addEventListener("scroll", update);
  update();
}
