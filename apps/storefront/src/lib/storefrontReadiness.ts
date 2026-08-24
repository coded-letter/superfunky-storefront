const LOADING_LABEL = /^(loading|resolving|preparing|selecting|finding)\b/i;

export function hasPendingVisibleContent(root: ParentNode): boolean {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="status"]'))
    .some((status) => {
      if (status.closest("[data-prerendered-cms-snapshot]")) return false;
      const bounds = status.getBoundingClientRect();
      return bounds.top < window.innerHeight
        && bounds.bottom > 0
        && LOADING_LABEL.test(status.textContent?.trim() || "");
    });
}
