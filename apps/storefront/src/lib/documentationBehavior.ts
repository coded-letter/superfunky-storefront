type Cleanup = () => void;

export function mountDocumentationBehavior(container: HTMLElement): Cleanup {
  const root = container.querySelector<HTMLElement>(
    '[data-superfunky-docs-page][data-funky-behavior~="docs-navigation"]',
  );
  if (!root) return () => undefined;

  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-doc-toc-link]"));
  const headingById = new Map(
    Array.from(root.querySelectorAll<HTMLElement>("[data-doc-article] h2, [data-doc-article] h3"))
      .map((heading) => [heading.id, heading]),
  );
  const headings = links.flatMap((link) => {
    const heading = headingById.get(decodeURIComponent(link.hash.slice(1)));
    return heading ? [heading] : [];
  });
  if (!headings.length) return () => undefined;

  const initialState = links.map((link) => ({
    active: link.getAttribute("data-active"),
    current: link.getAttribute("aria-current"),
  }));
  const setActive = (id: string) => {
    links.forEach((link) => {
      const active = decodeURIComponent(link.hash.slice(1)) === id;
      link.dataset.active = String(active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };
  const update = () => {
    const viewportHeight = window.innerHeight;
    const focusLine = Math.min(Math.max(viewportHeight * 0.15, 112), 160);
    const positions = headings.map((heading) => ({
      heading,
      top: heading.getBoundingClientRect().top,
      bottom: heading.getBoundingClientRect().bottom,
    }));
    const visible = positions.filter(({ top, bottom }) => bottom > 0 && top < viewportHeight);
    const passedFocus = visible.filter(({ top }) => top <= focusLine);
    const active = passedFocus.at(-1)?.heading
      || visible[0]?.heading
      || positions.filter(({ top }) => top <= focusLine).at(-1)?.heading
      || headings[0];
    setActive(active.id);
  };

  window.addEventListener("scroll", update, { passive: true });
  document.addEventListener("scroll", update, { passive: true, capture: true });
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", update);
  update();

  return () => {
    window.removeEventListener("scroll", update);
    document.removeEventListener("scroll", update, { capture: true });
    window.removeEventListener("resize", update);
    window.removeEventListener("hashchange", update);
    links.forEach((link, index) => {
      restoreAttribute(link, "data-active", initialState[index].active);
      restoreAttribute(link, "aria-current", initialState[index].current);
    });
  };
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
