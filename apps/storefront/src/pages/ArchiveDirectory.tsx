import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Seo } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";

export function ArchiveDirectory({
  title,
  kicker,
  description,
  canonical,
  parent,
  count,
  children,
}: {
  title: string;
  kicker: string;
  description: string;
  canonical: string;
  parent?: { label: string; href: string };
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-8">
      <Seo
        title={title}
        description={description}
        canonical={canonical}
        schema={{ pageType: "CollectionPage" }}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          ...(parent ? [parent] : []),
          { label: title },
        ]}
      />
      <header className="grid gap-3 rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-brand-50 to-white p-8 shadow-soft dark:border-zinc-800 dark:from-brand-950/30 dark:to-zinc-950 sm:p-10">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-brand-400">{kicker}</span>
        <h1 className="m-0 font-display text-4xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
        <p className="m-0 max-w-2xl text-zinc-600 dark:text-zinc-300">{description}</p>
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{count} public {count === 1 ? "entry" : "entries"}</span>
      </header>
      {children}
    </div>
  );
}

export function ArchiveDirectoryStatus({
  title,
  message,
  href,
  linkLabel,
  isError = false,
}: {
  title: string;
  message: string;
  href: string;
  linkLabel: string;
  isError?: boolean;
}) {
  return (
    <section
      role={isError ? "alert" : undefined}
      className="mx-auto grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className={`m-0 ${isError ? "text-red-700 dark:text-red-300" : "text-zinc-500 dark:text-zinc-400"}`}>{message}</p>
      <Link to={href} className="mx-auto text-sm font-semibold text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">
        {linkLabel}
      </Link>
    </section>
  );
}
