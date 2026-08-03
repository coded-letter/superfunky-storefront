/** Frontend form validation — a dependency-free TypeScript rewrite of the legacy
 * prototype's `src/validator/{register,login,checkout}.js` trio. The originals leaned
 * on the `validator` and `lodash` npm packages purely for `isEmail`/`isLength`/
 * `isEmpty`/`trim`/`escape` — all of which are a handful of lines of plain JS, so this
 * version drops both dependencies rather than adding them to a project that doesn't
 * use them yet. Behaviour (error keys, messages, min/max length rules) is kept the same
 * shape as the legacy validators so the eventual backend integration doesn't need
 * to re-learn a different error contract. */

export type FieldErrors = Record<string, string>;

export type ValidationResult<T = Record<string, string>> = {
  errors: FieldErrors;
  sanitizedData: T;
  isValid: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose international-friendly phone check — digits, spaces, dashes, parens, and an
// optional leading "+", 7-15 digits total (E.164 upper bound).
const PHONE_PATTERN = /^\+?[\d\s\-().]{7,20}$/;

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}

/** Strips the handful of characters that make injected HTML/script dangerous when a
 * value is later rendered unescaped — mirrors `validator.escape()`'s intent without
 * pulling in the package. Sanitizing (not validating) — always applied to the
 * "clean" copy of a field regardless of whether it passed validation. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

type FieldRule = {
  field: string;
  label: string;
  min: number;
  max: number;
  type?: "email" | "phone" | "username" | "string";
  required?: boolean;
};

function runFieldRules(data: Record<string, unknown>, rules: FieldRule[]): ValidationResult {
  const errors: FieldErrors = {};
  const sanitizedData: Record<string, string> = {};

  for (const { field, label, min, max, type = "string", required = false } of rules) {
    const raw = typeof data[field] === "string" ? (data[field] as string) : "";
    const trimmed = raw.trim();

    if (required && isEmpty(raw)) {
      errors[field] = `${label} is required`;
      continue;
    }

    // Optional-and-empty fields (e.g. "Company name") skip length/format checks —
    // only required fields or fields the visitor actually typed something into get them.
    if (!required && isEmpty(raw)) {
      sanitizedData[field] = "";
      continue;
    }

    if (trimmed.length < min || trimmed.length > max) {
      errors[field] = `${label} must be ${min} to ${max} characters`;
      continue;
    }

    if (type === "email" && !isValidEmail(trimmed)) {
      errors[field] = `${label} is not a valid email address`;
      continue;
    }

    if (type === "phone" && !isValidPhone(trimmed)) {
      errors[field] = `${label} is not a valid phone number`;
      continue;
    }

    if (type === "username" && !/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      errors[field] = `${label} may only contain letters, numbers, underscores, hyphens, and dots`;
      continue;
    }

    sanitizedData[field] = escapeHtml(trimmed);
  }

  return { errors, sanitizedData, isValid: isEmpty(errors) };
}

export type RegisterFormInput = {
  firstName?: string;
  lastName?: string;
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
  marketingConsent?: boolean;
};

export function validateRegisterForm(data: RegisterFormInput): ValidationResult {
  const result = runFieldRules(data, [
    { field: "firstName", label: "First name", min: 1, max: 35, required: true },
    { field: "lastName", label: "Last name", min: 1, max: 35, required: true },
    { field: "username", label: "Username", min: 3, max: 35, type: "username", required: true },
    { field: "email", label: "Email", min: 6, max: 254, type: "email", required: true },
    { field: "password", label: "Password", min: 8, max: 72, required: true },
  ]);

  if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
    result.errors.confirmPassword = "Passwords don't match";
    result.isValid = false;
  }

  return result;
}

export type LoginFormInput = { identity: string; password: string };

export function validateLoginForm(data: LoginFormInput): ValidationResult {
  return runFieldRules(data, [
    { field: "identity", label: "Username or email", min: 3, max: 254, required: true },
    { field: "password", label: "Password", min: 1, max: 72, required: true },
  ]);
}

export function validateForgotPasswordForm(data: { identity: string }): ValidationResult {
  return runFieldRules(data, [{ field: "identity", label: "Username or email", min: 3, max: 254, required: true }]);
}

export function validateNewPassword(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Include a lowercase letter.";
  if (!/\d/.test(password)) return "Include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Include a special character.";
  return null;
}

export type CheckoutFormInput = {
  firstName: string;
  lastName: string;
  company?: string;
  country: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  phone: string;
  email: string;
  customerNote?: string;
  createAccount?: boolean;
  username?: string;
  password?: string;
  requiresShipping?: boolean;
};

export function validateCheckoutForm(data: CheckoutFormInput): ValidationResult {
  const requiresShipping = data.requiresShipping ?? true;

  const result = runFieldRules(data, [
    { field: "firstName", label: "First name", min: 1, max: 35, required: true },
    { field: "lastName", label: "Last name", min: 1, max: 35, required: true },
    { field: "company", label: "Company name", min: 0, max: 35 },
    { field: "country", label: "Country", min: 2, max: 55, required: true },
    { field: "address1", label: "Street address", min: 4, max: 100, required: requiresShipping },
    { field: "address2", label: "Address line 2", min: 0, max: 254 },
    { field: "city", label: "Town / city", min: 1, max: 85, required: requiresShipping },
    { field: "state", label: "State / county", min: 0, max: 254 },
    { field: "postcode", label: "Postcode / ZIP", min: 2, max: 12, required: requiresShipping },
    { field: "phone", label: "Phone", min: 7, max: 20, type: "phone", required: true },
    { field: "email", label: "Email", min: 6, max: 254, type: "email", required: true },
    { field: "customerNote", label: "Order notes", min: 0, max: 500 },
  ]);

  if (data.createAccount) {
    const accountResult = runFieldRules(data, [
      { field: "username", label: "Username", min: 2, max: 35, required: true },
      { field: "password", label: "Password", min: 8, max: 72, required: true },
    ]);
    Object.assign(result.errors, accountResult.errors);
    Object.assign(result.sanitizedData, accountResult.sanitizedData);
    result.isValid = result.isValid && accountResult.isValid;
  }

  return result;
}

export function validateNewsletterForm(data: { email: string }): ValidationResult {
  return runFieldRules(data, [{ field: "email", label: "Email", min: 6, max: 254, type: "email", required: true }]);
}
