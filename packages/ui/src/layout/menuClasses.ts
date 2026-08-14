export type MegaMenuConfiguration = {
  columns: number;
  explicit: boolean;
};

export function hasMenuClass(
  cssClasses: string[] | undefined,
  className: string,
): boolean {
  return cssClasses?.includes(className) || false;
}

export function getMegaMenuConfiguration(
  cssClasses: string[] | undefined,
  childCount: number,
): MegaMenuConfiguration | null {
  for (const className of cssClasses || []) {
    const match = /^mega-([2-9]|1[0-4])$/.exec(className);
    if (!match) continue;

    const columns = Number(match[1]);
    return { columns, explicit: true };
  }

  if (!hasMenuClass(cssClasses, "mega")) return null;
  return {
    columns: Math.max(2, Math.min(14, childCount)),
    explicit: false,
  };
}
