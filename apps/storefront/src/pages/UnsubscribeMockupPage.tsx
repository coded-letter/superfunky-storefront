import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useT } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";

export function UnsubscribeMockupPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="mx-auto flex min-h-[68vh] max-w-3xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full rounded-4xl border border-zinc-200/80 bg-white p-6 shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-950 sm:p-8 lg:p-10">
        <div className="max-w-2xl space-y-4">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: t("newsletter.unsubscribe") }]} />
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
            <span>{t("newsletter.unsubscribe")}</span>
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-semibold leading-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
              We’re sorry to see you go.
            </h1>
            <p className="m-0 text-sm leading-7 text-zinc-600 dark:text-zinc-400 sm:text-[15px]">
              Use this mock page to confirm your email address and tell us why you’re unsubscribing. This is ready for a future backend hook.
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">{t("newsletter.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("newsletter.email_placeholder")}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Reason (optional)</span>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={4}
              placeholder="Tell us how we can improve your experience."
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
            >
              {t("newsletter.unsubscribe")}
            </button>
            <Link to="/" className="text-sm font-semibold text-zinc-500 transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-300">
              Back to store
            </Link>
          </div>

          {submitted ? (
            <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4 text-sm text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
              Thanks — your unsubscribe request has been captured in this mockup flow.
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
