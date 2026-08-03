import type { ComponentType, SVGProps } from "react";

export type ViewSwitchOption<TValue extends string> = {
  value: TValue;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

export type ViewSwitchProps<TValue extends string> = {
  /** Short caption shown before the options — makes it clear this toggles a preview
   * rather than being a permanent piece of site content (e.g. "Hero layout preview"). */
  label: string;
  options: ViewSwitchOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
};

/**
 * Generic segmented-control toggle for previewing alternate section layouts/behaviours
 * across the mockup — the home hero was the first to use it (`HomeMockupPage`), and the
 * paginable grids' "Pages vs Infinite scroll" toggle reuses it too. Lives in the shared
 * `ui` package (rather than app-local) specifically so package-level components like
 * `PaginableProductGrid`/`PaginablePostGrid`/`SocialFeedGrid` can use it as well. Purely
 * a client-side preview toggle: nothing here is persisted or wired to a real backend
 * setting yet (a future WP customizer option would pick a default site-wide instead of
 * a per-visit local toggle like this).
 */
export function ViewSwitch<TValue extends string>({ label, options, value, onChange }: ViewSwitchProps<TValue>) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <span className="font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</span>
      <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(option.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition ${
                isActive
                  ? "bg-brand-gradient text-white shadow-glow"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
