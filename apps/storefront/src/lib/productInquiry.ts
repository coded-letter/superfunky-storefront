/** Product inquiry submission — reuses the existing generic form-submission endpoint
 *  (`funkycommerce_rest_create_form_submission`) with a fixed `formId` and explicit
 *  product context, rather than a bespoke inquiry endpoint. */

import { submitFormSubmission } from "./submissions.ts";

export const PRODUCT_INQUIRY_FORM_ID = "product-inquiry";

export type ProductInquiryContext = {
  databaseId: number;
  name: string;
  uri: string;
  sku?: string;
};

export type ProductInquiryValues = {
  name: string;
  email: string;
  message: string;
};

export type ProductInquiryPrefill = {
  name?: string;
  email?: string;
};

export type ProductInquiryValidationMessages = {
  nameRequired: string;
  emailInvalid: string;
  messageRequired: string;
};

const DEFAULT_VALIDATION_MESSAGES: ProductInquiryValidationMessages = {
  nameRequired: "Enter your name so we know who to reply to.",
  emailInvalid: "Enter a valid email address.",
  messageRequired: "Enter a message describing what you'd like to know.",
};

/** Best-effort split of a display name into a form's separate name field — the
 *  authenticated customer session only stores a single display name. */
export function prefillFromCustomer(customer: { email?: string; displayName?: string } | null | undefined): ProductInquiryPrefill {
  if (!customer) return {};
  const name = customer.displayName?.trim();
  const email = customer.email?.trim();
  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
  };
}

/** Validate and normalize inquiry field values, throwing an explicit, user-facing
 *  error for the first invalid field. */
export function validateProductInquiryValues(
  values: ProductInquiryValues,
  messages: ProductInquiryValidationMessages = DEFAULT_VALIDATION_MESSAGES,
): ProductInquiryValues {
  const name = values.name.trim();
  const email = values.email.trim();
  const message = values.message.trim();

  if (!name) throw new Error(messages.nameRequired);
  if (!email || !/\S+@\S+\.\S+/.test(email)) throw new Error(messages.emailInvalid);
  if (!message) throw new Error(messages.messageRequired);

  return { name, email, message };
}

/** Build the generic form-submission payload for a product inquiry, attaching
 *  product context (name, id, SKU) as extra fields and using the product page as
 *  the submission source. */
export function buildProductInquirySubmission(
  product: ProductInquiryContext,
  values: ProductInquiryValues,
  options: { language?: string; origin?: string; validationMessages?: ProductInquiryValidationMessages } = {},
): Parameters<typeof submitFormSubmission>[0] {
  const { name, email, message } = validateProductInquiryValues(values, options.validationMessages);
  const source = options.origin ? new URL(product.uri, options.origin).toString() : product.uri;

  return {
    formId: PRODUCT_INQUIRY_FORM_ID,
    formName: "Product inquiry",
    subject: `Product inquiry: ${product.name}`,
    email,
    source,
    language: options.language,
    fields: {
      Name: name,
      Email: email,
      Message: message,
      Product: product.name,
      ProductId: product.databaseId,
      ...(product.sku ? { SKU: product.sku } : {}),
    },
  };
}

/** Submit a product inquiry through the existing generic submission endpoint,
 *  surfacing explicit success/error outcomes to the caller. */
export async function submitProductInquiry(
  product: ProductInquiryContext,
  values: ProductInquiryValues,
  options: { language?: string; origin?: string; validationMessages?: ProductInquiryValidationMessages } = {},
): Promise<void> {
  await submitFormSubmission(buildProductInquirySubmission(product, values, options));
}
