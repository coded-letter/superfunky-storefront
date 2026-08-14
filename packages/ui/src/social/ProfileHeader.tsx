import type { ReactNode } from "react";
import { ResponsiveImage } from "../media";

export type ProfileHeaderLayout = "card" | "cover-banner" | "compact-list" | "immersive" | "split" | "strip";

export type ProfileHeaderProps = {
  /** Which of the six backend-selected header variants to render. */
  layout: ProfileHeaderLayout;
  displayName: string;
  /** Fallback initials shown when `avatarUrl` is absent. */
  initials: string;
  /** Background color for the initials fallback avatar. */
  avatarColor: string;
  avatarUrl?: string | null;
  /** Optional banner image behind the avatar; falls back to `avatarUrl` (blurred) when absent. */
  coverUrl?: string | null;
  /** Rendered next to/below the name — e.g. `@handle` for community members or `Author · EN` for journal authors. */
  subtitle?: ReactNode;
  bio?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  stats?: ReactNode;
  backLink?: ReactNode;
};

/**
 * Shared public-profile header, reused by both `CommunityProfileMockupPage` (community
 * members) and `AuthorMockupPage` (journal authors) so the six backend-selected header
 * layouts stay pixel-identical across both profile types instead of drifting apart.
 * Which variant renders is controlled separately per page by
 * `layout.communityProfileHeaderLayout` / `layout.authorProfileHeaderLayout`.
 */
export function ProfileHeader({
  layout,
  displayName,
  initials,
  avatarColor,
  avatarUrl,
  coverUrl,
  subtitle,
  bio,
  badges,
  actions,
  stats,
  backLink,
}: ProfileHeaderProps) {
  const avatar = (size: "lg" | "xl") =>
    avatarUrl ? (
      <ResponsiveImage
        src={avatarUrl}
        alt={displayName}
        priority
        sizes={size === "xl" ? "7rem" : "5rem"}
        className={`shrink-0 rounded-full object-cover shadow-glow ${size === "xl" ? "h-24 w-24 sm:h-28 sm:w-28" : "h-20 w-20"}`}
      />
    ) : (
      <span
        className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white shadow-glow ${
          size === "xl" ? "h-24 w-24 text-3xl sm:h-28 sm:w-28" : "h-20 w-20 text-2xl"
        }`}
        style={{ backgroundColor: avatarColor }}
        aria-hidden="true"
      >
        {initials}
      </span>
    );

  if (layout === "immersive") {
    return (
      <header className="sf-profile-header relative grid overflow-hidden rounded-3xl border border-zinc-200/80 shadow-soft dark:border-zinc-800">
        <div className="relative flex flex-col items-center gap-4 bg-gradient-to-br from-brand-600 via-brand-500 to-fuchsia-600 px-6 pb-16 pt-10 text-center sm:px-10 sm:pt-12">
          {coverUrl || avatarUrl ? (
            <ResponsiveImage src={coverUrl || avatarUrl || ""} alt="" priority sizes="100vw" aria-hidden="true" className={`absolute inset-0 h-full w-full object-cover opacity-40 ${coverUrl ? "" : "blur-md"}`} />
          ) : null}
          <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
            <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">{backLink}</span>
          </div>
          <div className="relative z-10 grid place-items-center gap-4">
            <div className="rounded-full border-4 border-white/80 shadow-glow">{avatar("xl")}</div>
            <div className="grid gap-1.5">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h1 className="m-0 font-display text-3xl font-bold text-white sm:text-4xl">{displayName}</h1>
              </div>
              <p className="m-0 text-sm font-semibold text-white/80">{subtitle}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">{badges}</div>
            </div>
            <p className="m-0 max-w-xl text-sm text-white/85">{bio}</p>
            {actions}
          </div>
        </div>
        <div className="relative z-10 -mt-8 mx-4 grid grid-cols-2 gap-4 rounded-2xl bg-white p-5 shadow-soft-lg dark:bg-zinc-900 sm:mx-8 sm:flex sm:items-center sm:justify-center sm:gap-10">
          {stats}
        </div>
      </header>
    );
  }

  if (layout === "cover-banner") {
    return (
      <header className="sf-profile-header grid overflow-hidden rounded-3xl border border-zinc-200/80 shadow-soft dark:border-zinc-800">
        <div className="relative h-36 bg-brand-gradient sm:h-44">
          {coverUrl || avatarUrl ? (
            <ResponsiveImage src={coverUrl || avatarUrl || ""} alt="" priority sizes="100vw" aria-hidden="true" className={`h-full w-full object-cover ${coverUrl ? "" : "opacity-50 blur-sm"}`} />
          ) : null}
          <div className="absolute left-4 top-4 sm:left-6 sm:top-6">{backLink}</div>
        </div>
        <div className="relative z-10 grid gap-5 bg-white p-6 dark:bg-zinc-900 sm:p-8">
          <div className="relative z-10 -mt-16 flex flex-wrap items-end justify-between gap-5 sm:-mt-20">
            <div className="flex items-end gap-4">
              <div className="rounded-full border-4 border-white shadow-glow dark:border-zinc-900">{avatar("xl")}</div>
              <div className="grid gap-1.5 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-3xl">{displayName}</h1>
                  {badges}
                </div>
                <p className="m-0 text-sm font-semibold text-brand-600 dark:text-brand-400">{subtitle}</p>
              </div>
            </div>
            {actions}
          </div>
          <p className="m-0 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">{bio}</p>
          <div className="flex flex-wrap items-center gap-6 border-t border-zinc-200/80 pt-5 dark:border-zinc-800">{stats}</div>
        </div>
      </header>
    );
  }

  if (layout === "compact-list") {
    return (
      <header className="sf-profile-header grid gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        {backLink}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {avatar("lg")}
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{displayName}</h1>
                {badges}
              </div>
              <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-brand-600 dark:text-brand-400">{subtitle}</span>
                <span className="mx-2 text-zinc-300 dark:text-zinc-700">&middot;</span>
                {bio}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5 sm:gap-6">
            <div className="hidden sm:flex sm:items-center sm:gap-5">{stats}</div>
            {actions}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 border-t border-zinc-200/80 pt-4 dark:border-zinc-800 sm:hidden">{stats}</div>
      </header>
    );
  }

  if (layout === "split") {
    return (
      <header className="sf-profile-header grid overflow-hidden rounded-3xl border border-zinc-200/80 shadow-soft dark:border-zinc-800 lg:grid-cols-[minmax(0,0.85fr),minmax(0,1.15fr)]">
        <div className="relative min-h-[14rem] lg:min-h-full">
          {coverUrl || avatarUrl ? (
            <ResponsiveImage src={coverUrl || avatarUrl || ""} alt="" priority sizes="(min-width: 1024px) 42vw, 100vw" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-500 to-fuchsia-600" aria-hidden="true" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent lg:bg-gradient-to-r" aria-hidden="true" />
          <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
            <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">{backLink}</span>
          </div>
          <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 lg:hidden">
            {avatar("lg")}
            <div className="sf-profile-stat grid gap-0.5">
              <h1 className="m-0 font-display text-xl font-bold text-white drop-shadow-sm">{displayName}</h1>
              <p className="m-0 text-sm font-semibold text-white/85">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="grid content-center gap-5 bg-white p-6 dark:bg-zinc-900 sm:p-8 lg:p-10">
          <div className="hidden items-center gap-4 lg:flex">{avatar("xl")}</div>
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 hidden font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100 lg:block">{displayName}</h1>
              {badges}
            </div>
            <p className="m-0 hidden text-sm font-semibold text-brand-600 dark:text-brand-400 lg:block">{subtitle}</p>
            <p className="m-0 max-w-lg text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{bio}</p>
          </div>
          <div className="flex flex-wrap items-center gap-6 border-t border-zinc-200/80 pt-5 dark:border-zinc-800">{stats}</div>
          {actions}
        </div>
      </header>
    );
  }

  if (layout === "strip") {
    return (
      <header className="sf-profile-header flex flex-wrap items-center gap-4 rounded-full border border-zinc-200/80 bg-white px-4 py-3 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
        <span className="hidden sm:inline-flex">{backLink}</span>
        {avatar("lg")}
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 truncate font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{displayName}</h1>
            {badges}
          </div>
          <p className="m-0 truncate text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-brand-600 dark:text-brand-400">{subtitle}</span>
            <span className="mx-2 text-zinc-300 dark:text-zinc-700">&middot;</span>
            {bio}
          </p>
        </div>
        <div className="hidden items-center gap-5 md:flex">{stats}</div>
        {actions}
      </header>
    );
  }

  return (
    <header className="sf-profile-header grid gap-6 rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-brand-50 to-white p-8 shadow-soft dark:border-zinc-800 dark:from-brand-950/30 dark:to-zinc-950 sm:p-10">
      {backLink}

      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-wrap items-center gap-5 sm:flex-nowrap">
          {avatar("lg")}
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-4xl">{displayName}</h1>
              {badges}
            </div>
            <p className="m-0 text-sm font-semibold text-brand-600 dark:text-brand-400">{subtitle}</p>
            <p className="m-0 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">{bio}</p>
          </div>
        </div>

        {actions}
      </div>

      <div className="flex flex-wrap items-center gap-6 border-t border-zinc-200/80 pt-5 dark:border-zinc-800">{stats}</div>
    </header>
  );
}

export function ProfileStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid gap-0.5">
      <p className="m-0 text-lg font-bold text-zinc-900 dark:text-zinc-100">{value.toLocaleString()}</p>
      <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
