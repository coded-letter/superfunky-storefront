import { restUrl } from "@funky/sdk";

type SubmissionError = {
  message?: string;
};

export async function submitNewsletterSubmission(
  email: string,
  options: { source: string; language?: string; consent?: boolean },
): Promise<void> {
  const endpoint = restUrl("funkycommerce/v1/newsletter-submissions");
  if (!endpoint) {
    throw new Error("Newsletter submissions are not connected to a backend.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      consent: options.consent ?? true,
      source: options.source,
      language: options.language,
      website: "",
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as SubmissionError | null;
    throw new Error(payload?.message || "The newsletter signup could not be saved.");
  }
}

export async function submitFormSubmission(payload: {
  formId: string;
  formName?: string;
  subject?: string;
  email?: string;
  source?: string;
  language?: string;
  fields: Record<string, string | number | boolean>;
  files?: File[];
}): Promise<void> {
  const endpoint = restUrl("funkycommerce/v1/form-submissions");
  if (!endpoint) {
    throw new Error("Form submissions are not connected to a backend.");
  }

  const { files = [], ...values } = payload;
  if (files.length > 5) {
    throw new Error("No more than five files may be uploaded.");
  }
  const body = files.length ? new FormData() : JSON.stringify({ ...values, website: "" });
  const headers: HeadersInit = {};
  if (body instanceof FormData) {
    Object.entries(values).forEach(([key, value]) => {
      body.append(key, key === "fields" ? JSON.stringify(value) : String(value ?? ""));
    });
    body.append("website", "");
    files.forEach((file) => body.append("files[]", file, file.name));
  } else {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(endpoint, { method: "POST", headers, body });

  if (!response.ok) {
    const responsePayload = (await response.json().catch(() => null)) as SubmissionError | null;
    throw new Error(responsePayload?.message || "The form submission could not be saved.");
  }
}

export async function requestNewsletterUnsubscribe(email: string): Promise<string> {
  const endpoint = restUrl("funkycommerce/v1/newsletter-unsubscribe");
  if (!endpoint) {
    throw new Error("Newsletter subscriptions are not connected to a backend.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = (await response.json().catch(() => null)) as (SubmissionError & { received?: boolean }) | null;
  if (!response.ok) {
    throw new Error(payload?.message || "The unsubscribe request could not be sent.");
  }
  return payload?.message || "Check your email for a confirmation link.";
}
