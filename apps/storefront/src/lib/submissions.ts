import { restUrl } from "./env";

type SubmissionError = {
  message?: string;
};

export async function submitNewsletterSubmission(
  email: string,
  options: { source: string; language?: string },
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
      consent: true,
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
}): Promise<void> {
  const endpoint = restUrl("funkycommerce/v1/form-submissions");
  if (!endpoint) {
    throw new Error("Form submissions are not connected to a backend.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, website: "" }),
  });

  if (!response.ok) {
    const responsePayload = (await response.json().catch(() => null)) as SubmissionError | null;
    throw new Error(responsePayload?.message || "The form submission could not be saved.");
  }
}
