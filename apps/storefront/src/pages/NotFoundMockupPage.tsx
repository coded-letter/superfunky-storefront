import { Link } from "react-router-dom";

export function NotFoundMockupPage() {
  return (
    <section className="mx-auto mt-16 grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">Mock page not found</h1>
      <p className="m-0 text-zinc-500 dark:text-zinc-400">
        This path has no mockup yet. Use the main navigation to access available pages.
      </p>
      <Link to="/" className="mx-auto text-sm font-semibold text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">
        Back to home
      </Link>
    </section>
  );
}
