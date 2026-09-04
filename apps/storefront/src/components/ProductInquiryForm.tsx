import { useState, type FormEvent } from "react";
import { useT } from "@funky/ui";
import { authStore } from "../lib/auth";
import { prefillFromCustomer, submitProductInquiry, type ProductInquiryContext } from "../lib/productInquiry";

/**
 * Inquiry-only product UI shown instead of pricing/add-to-cart controls when a
 * product resolves to the "inquiry" price mode (see `resolveProductPriceMode`).
 * Submits through the existing generic form-submission endpoint with product
 * context attached, and prefills the authenticated customer's name/email when
 * available.
 */
export function ProductInquiryForm({
  product,
  heading,
  buttonLabel,
  copy,
}: {
  product: ProductInquiryContext;
  heading: string;
  buttonLabel: string;
  copy: string;
}) {
  const t = useT();
  const localizedHeading = heading === "Product inquiry" ? t("inquiry.heading") : heading;
  const localizedButtonLabel = buttonLabel === "Ask about this product" ? t("inquiry.button") : buttonLabel;
  const localizedCopy = copy === "Send us a message and we will follow up with availability and pricing."
    ? t("inquiry.copy")
    : copy;
  const customer = authStore.load()?.user;
  const prefill = prefillFromCustomer(customer);
  const [name, setName] = useState(prefill.name || "");
  const [email, setEmail] = useState(prefill.email || "");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      await submitProductInquiry(
        product,
        { name, email, message },
        {
          language: typeof document !== "undefined" ? document.documentElement.lang : undefined,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
          validationMessages: {
            nameRequired: t("inquiry.validation.name_required"),
            emailInvalid: t("inquiry.validation.email_invalid"),
            messageRequired: t("inquiry.validation.message_required"),
          },
        },
      );
      setShowSuccess(true);
      setMessage("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("inquiry.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sf-product-inquiry grid gap-4 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <div className="grid gap-1">
        <h3 className="m-0 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{localizedHeading}</h3>
        <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{localizedCopy}</p>
      </div>

      {showSuccess ? (
        <div role="status" className="rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {t("inquiry.success")}
        </div>
      ) : null}

      {formError ? (
        <div role="alert" className="rounded-xl bg-rose-100 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {formError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("inquiry.field.name")}</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              required
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900 dark:focus:ring-brand-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("inquiry.field.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900 dark:focus:ring-brand-950"
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{t("inquiry.field.message")}</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isSubmitting}
            required
            rows={4}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900 dark:focus:ring-brand-950"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="justify-self-start rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t("inquiry.sending") : localizedButtonLabel}
        </button>
      </form>
    </div>
  );
}
