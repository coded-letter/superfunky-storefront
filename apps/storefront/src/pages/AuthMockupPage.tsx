import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ViewSwitch, useLayoutPreferences, useT } from "@funky/ui";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApplicationShortcode, useConfiguredState, useEmbeddedApplicationShortcode } from "../components/applicationShortcodes";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { saveCheckoutEmail, saveNewsletterEmail } from "../lib/abandonedCart";
import { useResolvedStorefrontPath, useStorefrontPath } from "../lib/storefrontPaths";
import { useNavigationData } from "../state/navigationData";
import { isValidEmail, validateForgotPasswordForm, validateLoginForm, validateNewPassword, validateRegisterForm, type FieldErrors } from "../lib/validation";
import { InputMock, primaryActionButtonClass } from "./shared";
import {
  login,
  loginWithProvider,
  registerCustomer,
  resetUserPassword,
  sendPasswordResetEmail,
  useIsUserLoggedIn,
  useLoginClients,
  type LoginClient,
  type LoginProvider,
} from "../lib/auth";

export type AuthMode = "login" | "register" | "forgot-password";
export type AuthShortcodeMode = AuthMode | "combined";

/** Three alternate shells for the login/register/forgot-password forms — the form
 * content itself (`AuthFormColumn`) is identical across all three, only the
 * surrounding page chrome changes:
 * - `split` (default, current): 50/50 background split, form left, branded dark panel right.
 * - `centered`: no split background, a single centered card on a plain page.
 * - `image-bg`: full-bleed photographic background with a glass-morphism card floating on top.
 */
const AUTH_BACKGROUND_IMAGE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80";

const TITLE_KEYS: Record<AuthMode, string> = {
  login: "auth.title.login",
  register: "auth.title.register",
  "forgot-password": "auth.title.forgot",
};

const DESCRIPTION_KEYS: Record<AuthMode, string> = {
  login: "auth.desc.login",
  register: "auth.desc.register",
  "forgot-password": "auth.desc.forgot",
};

const AUTH_MODE_OPTIONS = [
  { value: "login" as const, labelKey: "auth.tab.login" },
  { value: "register" as const, labelKey: "auth.tab.register" },
  { value: "forgot-password" as const, labelKey: "auth.tab.forgot" },
];

export function AuthMockupPage({ mode }: { mode: AuthShortcodeMode }) {
  const t = useT();
  const embedded = useEmbeddedApplicationShortcode();
  const { path: accountPath, isLoading: isLoadingAccountPath } = useResolvedStorefrontPath("account", "/account");
  const authLoginPath = useStorefrontPath("auth-login", "/auth");
  const authRegisterPath = useStorefrontPath("auth-register", "/auth/register");
  const authForgotPath = useStorefrontPath("auth-forgot-password", "/auth/forgot-password");
  const [searchParams] = useSearchParams();
  const config = useApplicationShortcode(["funkycommerce_auth"], { mode });
  const brandName = useNavigationData().data?.storefrontConfig.branding.storeName || "FunkyCommerce";
  const { authLayout: layout } = useLayoutPreferences();
  const combined = mode === "combined";
  const configuredDefaultMode = AUTH_MODE_OPTIONS.some((option) => option.value === config["default-mode"])
    ? config["default-mode"] as AuthMode
    : "login";
  const [activeMode, setActiveMode] = useConfiguredState<AuthMode>(combined ? configuredDefaultMode : mode);
  const isLoggedIn = useIsUserLoggedIn();

  if (isLoggedIn) {
    if (isLoadingAccountPath) return null;
    return <Navigate to={accountPath} replace />;
  }

  const formColumn = (
    <div className="grid content-start gap-6">
      <div className="grid gap-1">
        <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t(TITLE_KEYS[activeMode])}</h1>
        <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{t(DESCRIPTION_KEYS[activeMode], { brand: brandName })}</p>
      </div>

      {combined ? (
        <ViewSwitch
          label={t("auth.mode_selector")}
          hideLabel
          options={AUTH_MODE_OPTIONS.map((option) => ({ ...option, label: t(option.labelKey) }))}
          value={activeMode}
          onChange={setActiveMode}
        />
      ) : embedded ? null : (
        <div className="flex flex-wrap gap-1.5 rounded-control bg-zinc-100 p-1 dark:bg-zinc-800/60">
          <AuthTab href={authLoginPath} label={t("auth.tab.login")} isActive={activeMode === "login"} />
          <AuthTab href={authRegisterPath} label={t("auth.tab.register")} isActive={activeMode === "register"} />
          <AuthTab href={authForgotPath} label={t("auth.tab.forgot")} isActive={activeMode === "forgot-password"} />
        </div>
      )}

      {activeMode === "login" && searchParams.get("password-reset") === "success" ? (
        <p role="status" className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {t("auth.password_updated")}
        </p>
      ) : null}

      {activeMode === "login" || activeMode === "register" ? <AuthProviders /> : null}

      {activeMode === "login" ? <LoginFormMock accountPath={accountPath} authForgotPath={authForgotPath} /> : null}
      {activeMode === "register" ? <RegisterFormMock accountPath={accountPath} authLoginPath={authLoginPath} /> : null}
      {activeMode === "forgot-password" ? <ForgotPasswordFormMock authLoginPath={authLoginPath} /> : null}
    </div>
  );

  if (layout === "centered") {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
          {formColumn}
        </div>
      </div>
    );
  }

  if (layout === "image-bg") {
    return (
      <div
        className="relative -mt-8 -mb-16 grid min-h-[70vh] place-items-center overflow-hidden rounded-3xl bg-cover bg-center px-4 py-16"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(9,9,11,0.35), rgba(9,9,11,0.75)), url(${AUTH_BACKGROUND_IMAGE})` }}
      >
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/95 p-8 shadow-soft-lg backdrop-blur-md dark:bg-zinc-900/90 sm:p-10">
          {formColumn}
        </div>
      </div>
    );
  }

  return <AuthSplitLayout brandName={brandName}>{formColumn}</AuthSplitLayout>;
}

function AuthSplitLayout({ children, brandName }: { children: ReactNode; brandName: string }) {
  const t = useT();
  return (
    <div className="relative -mt-8 -mb-16 overflow-hidden rounded-3xl">
      {/* 50/50 background split, now capped to the same `max-w-7xl` content column every
          other page uses (this section lives inside `<main>`'s own `max-w-7xl px-4 sm:px-6
          lg:px-8` box) instead of breaking out to the raw viewport edge — on ultra-wide
          screens the dark right-hand panel used to keep stretching past the theme's normal
          content bounds instead of stopping at them like every other section does. */}
      <div className="absolute inset-0 grid lg:grid-cols-2" aria-hidden="true">
        <div className="bg-zinc-50 dark:bg-zinc-950" />
        <div className="relative hidden overflow-hidden bg-zinc-900 lg:block">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        </div>
      </div>

      <div className="relative grid w-full px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-16">
        <div className="grid content-start lg:content-center">
          <div className="mx-auto grid w-full max-w-md gap-6 lg:mx-0">{children}</div>
        </div>

        <div className="relative hidden flex-col items-end justify-between text-right text-white lg:flex">
          <div className="relative grid justify-items-end gap-3">
            <span className="inline-grid h-11 w-11 place-items-center rounded-2xl bg-brand-gradient shadow-glow">✦</span>
            <h2 className="m-0 font-display text-2xl font-bold">{brandName}</h2>
            <p className="m-0 max-w-xs text-sm text-white/70">
              {t("auth.brand_tagline")}
            </p>
          </div>
          <p className="relative m-0 text-xs text-white/50">© {new Date().getFullYear()} {brandName}</p>
        </div>
      </div>
    </div>
  );
}

function AuthProviders() {
  const t = useT();
  const { clients, error } = useLoginClients();
  const providers = clients.filter((client) =>
    client.provider !== "PASSWORD" &&
    client.provider !== "SITETOKEN" &&
    Boolean(client.authorizationUrl) &&
    isSafeAuthorizationUrl(client.authorizationUrl),
  );
  if (error) {
    return <p role="alert" className="m-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{error.message}</p>;
  }
  if (!providers.length) return null;
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
        {t("auth.or_continue")}
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {providers.map((provider) => {
          const meta = AUTH_PROVIDER_META[provider.provider];
          return (
            <a
              key={provider.provider}
              href={provider.authorizationUrl || undefined}
              title={t("auth.continue_with", { provider: providerLabel(provider) })}
              aria-label={t("auth.continue_with", { provider: providerLabel(provider) })}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-brand-500"
            >
              <span className={`inline-grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${meta.badgeClass}`}>
                {meta.icon ? <img src={meta.icon} alt="" className={meta.iconClass} aria-hidden="true" /> : meta.shortLabel}
              </span>
              <span className="hidden sm:inline">{providerLabel(provider)}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Per-provider brand colour + dark-mode icon treatment (see comment above). */
const AUTH_PROVIDER_META: Record<LoginProvider, { badgeClass: string; icon?: string; iconClass: string; shortLabel: string }> = {
  GOOGLE: { badgeClass: "bg-[#4285F4]", icon: "/icons/social/google.svg", iconClass: "h-3 w-3 brightness-0 invert", shortLabel: "G" },
  GITHUB: { badgeClass: "bg-zinc-900 dark:bg-white", icon: "/icons/social/github.svg", iconClass: "h-3 w-3 brightness-0 invert dark:invert-0", shortLabel: "GH" },
  FACEBOOK: { badgeClass: "bg-[#1877F2]", icon: "/icons/social/facebook.svg", iconClass: "h-3 w-3 brightness-0 invert", shortLabel: "F" },
  INSTAGRAM: { badgeClass: "bg-gradient-to-br from-fuchsia-500 to-amber-400", icon: "/icons/social/instagram.svg", iconClass: "h-3 w-3 brightness-0 invert", shortLabel: "IG" },
  LINKEDIN: { badgeClass: "bg-[#0A66C2]", icon: "/icons/social/linkedin.svg", iconClass: "h-3 w-3 brightness-0 invert", shortLabel: "IN" },
  OAUTH2_GENERIC: { badgeClass: "bg-violet-600", iconClass: "", shortLabel: "O" },
  SITETOKEN: { badgeClass: "bg-emerald-600", iconClass: "", shortLabel: "ST" },
  PASSWORD: { badgeClass: "bg-zinc-700", iconClass: "", shortLabel: "P" },
};

function providerLabel(provider: LoginClient): string {
  if (provider.name.trim()) return provider.name;
  return {
    FACEBOOK: "Facebook",
    GITHUB: "GitHub",
    GOOGLE: "Google",
    INSTAGRAM: "Instagram",
    LINKEDIN: "LinkedIn",
    OAUTH2_GENERIC: "OAuth2",
    PASSWORD: "Password",
    SITETOKEN: "Site Token",
  }[provider.provider];
}

function isSafeAuthorizationUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
  } catch {
    return false;
  }
}

function LoginFormMock({ accountPath, authForgotPath }: { accountPath: string; authForgotPath: string }) {
  const t = useT();
  const navigate = useNavigate();
  const [values, setValues] = useState({ identity: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateLoginForm(values);
    setErrors(localizeFieldErrors(result.errors, values, {
      identity: { label: t("auth.login.username"), min: 3, max: 254, required: true },
      password: { label: t("auth.login.password"), min: 1, max: 72, required: true },
    }, t));
    if (!result.isValid) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await login(values.identity, values.password, rememberMe);
      navigate(accountPath, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("auth.login.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <InputMock
        label={t("auth.login.username")}
        value={values.identity}
        onChange={(value) => setValues((previous) => ({ ...previous, identity: value }))}
        error={errors.identity}
      />
      <InputMock
        label={t("auth.login.password")}
        type="password"
        value={values.password}
        onChange={(value) => setValues((previous) => ({ ...previous, password: value }))}
        error={errors.password}
      />
      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="accent-brand-600"
          />
          {t("auth.login.remember")}
        </label>
        <Link to={authForgotPath} className="text-sm font-medium text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">
          {t("auth.login.forgot_link")}
        </Link>
      </div>
      {submitError ? <p role="alert" className="m-0 text-sm font-medium text-rose-600 dark:text-rose-400">{submitError}</p> : null}
      <button type="submit" disabled={isSubmitting} className={`${primaryActionButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}>
        {isSubmitting ? t("auth.login.cta_loading") : t("auth.login.cta")}
      </button>
    </form>
  );
}

function RegisterFormMock({ accountPath, authLoginPath }: { accountPath: string; authLoginPath: string }) {
  const t = useT();
  const navigate = useNavigate();
  const [values, setValues] = useState({ firstName: "", lastName: "", username: "", email: "", password: "", confirmPassword: "" });
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateRegisterForm(values);
    setErrors(localizeFieldErrors(result.errors, values, {
      firstName: { label: t("auth.register.first_name"), min: 1, max: 35, required: true },
      lastName: { label: t("auth.register.last_name"), min: 1, max: 35, required: true },
      username: { label: t("auth.register.username"), min: 3, max: 35, required: true, type: "username" },
      email: { label: t("auth.register.email"), min: 6, max: 254, required: true, type: "email" },
      password: { label: t("auth.register.password"), min: 8, max: 72, required: true },
      confirmPassword: { label: t("auth.register.confirm"), min: 0, max: 0 },
    }, t));
    if (!result.isValid) return;

    // Same "checkout_form"-style persistence the abandoned-cart tracker reads from,
    // plus the newsletter key when the visitor opted in — so a cart abandoned right
    // after registering can still be matched back to an email.
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      saveCheckoutEmail(values.email);
      if (marketingConsent) saveNewsletterEmail(values.email);
      const session = await registerCustomer(values);
      if (session) {
        navigate(accountPath, { replace: true });
      } else {
        setSubmitted(true);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("auth.register.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        <p className="m-0 font-semibold">{t("auth.register.success.heading")}</p>
        <p className="m-0">{t("auth.register.success.body")}</p>
        <Link to={authLoginPath} className="font-semibold text-emerald-800 dark:text-emerald-200">{t("auth.register.success.cta")}</Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputMock
          label={t("auth.register.first_name")}
          value={values.firstName}
          onChange={(value) => setValues((previous) => ({ ...previous, firstName: value }))}
          error={errors.firstName}
          required
        />
        <InputMock
          label={t("auth.register.last_name")}
          value={values.lastName}
          onChange={(value) => setValues((previous) => ({ ...previous, lastName: value }))}
          error={errors.lastName}
          required
        />
      </div>
      <InputMock
        label={t("auth.register.username")}
        value={values.username}
        onChange={(value) => setValues((previous) => ({ ...previous, username: value }))}
        error={errors.username}
        placeholder={t("auth.register.username_placeholder")}
        helperText={t("auth.register.username_helper")}
        required
      />
      <InputMock
        label={t("auth.register.email")}
        type="email"
        value={values.email}
        onChange={(value) => setValues((previous) => ({ ...previous, email: value }))}
        error={errors.email}
        required
      />
      <InputMock
        label={t("auth.register.password")}
        type="password"
        value={values.password}
        onChange={(value) => setValues((previous) => ({ ...previous, password: value }))}
        error={errors.password}
        helperText={t("auth.register.password_helper")}
        required
      />
      <InputMock
        label={t("auth.register.confirm")}
        type="password"
        value={values.confirmPassword}
        onChange={(value) => setValues((previous) => ({ ...previous, confirmPassword: value }))}
        error={errors.confirmPassword}
        required
      />
      <label className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(event) => setMarketingConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <span>{t("auth.register.newsletter")}</span>
      </label>
      {submitError ? <p role="alert" className="m-0 text-sm font-medium text-rose-600 dark:text-rose-400">{submitError}</p> : null}
      <button type="submit" disabled={isSubmitting} className={`${primaryActionButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}>
        {isSubmitting ? t("auth.register.cta_loading") : t("auth.register.cta")}
      </button>
    </form>
  );
}

function ForgotPasswordFormMock({ authLoginPath }: { authLoginPath: string }) {
  const t = useT();
  const [identity, setIdentity] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateForgotPasswordForm({ identity });
    setErrors(localizeFieldErrors(result.errors, { identity }, {
      identity: { label: t("auth.forgot.field"), min: 3, max: 254, required: true },
    }, t));
    if (!result.isValid) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await sendPasswordResetEmail(identity);
      setSent(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("auth.forgot.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <p className="m-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        {t("auth.forgot.success", { identity })}
      </p>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <InputMock label={t("auth.forgot.field")} value={identity} onChange={setIdentity} error={errors.identity} />
      {submitError ? <p role="alert" className="m-0 text-sm font-medium text-rose-600 dark:text-rose-400">{submitError}</p> : null}
      <button type="submit" disabled={isSubmitting} className={`${primaryActionButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}>
        {isSubmitting ? t("auth.forgot.cta_loading") : t("auth.forgot.cta")}
      </button>
    </form>
  );
}

/**
 * Reset-password is a special, one-off destination reached only via the `key`/`login`
 * link emailed after a "forgot password" request (see the legacy prototype's
 * `auth/reset-password.tsx`) — it deliberately isn't part of the login/register/forgot
 * tab switcher, so it can't be navigated to directly. Without both params (e.g. an
 * expired or tampered link) it shows an error state instead of a form.
 */
export function ResetPasswordMockupPage() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authLoginPath = useStorefrontPath("auth-login", "/auth");
  const authForgotPath = useStorefrontPath("auth-forgot-password", "/auth/forgot-password");
  const key = searchParams.get("key");
  const login = searchParams.get("login");
  const hasValidLink = Boolean(key && login);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!key || !login) return;
    const passwordError = validateNewPassword(password);
    if (passwordError) {
      setSubmitError(localizePasswordValidationMessage(passwordError, t));
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError(t("auth.reset.error.mismatch"));
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await resetUserPassword(key, login, password);
      navigate(`${authLoginPath}?password-reset=success`, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("auth.reset.error.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-[60vh] place-items-center px-4 py-16">
      <div className="grid w-full max-w-md gap-6 text-center">
        <div className="grid gap-1">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: t("auth.reset.breadcrumb") }]}
            className="justify-center"
          />
          <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">Reset your password</h1>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {hasValidLink ? "Choose a new password to finish securing your account." : "This reset link is missing, expired, or invalid."}
          </p>
        </div>
        {hasValidLink ? (
          <form className="grid gap-4 text-left" onSubmit={submit}>
            <InputMock label="New password" type="password" value={password} onChange={setPassword} />
            <InputMock label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
            {submitError ? <p role="alert" className="m-0 text-sm font-medium text-rose-600 dark:text-rose-400">{submitError}</p> : null}
            <button type="submit" disabled={isSubmitting} className={`${primaryActionButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}>
              {isSubmitting ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : (
          <Link
            to={authForgotPath}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5 hover:shadow-soft dark:bg-zinc-100 dark:text-zinc-900"
          >
            Request a new reset link
          </Link>
        )}
      </div>
    </div>
  );
}

export function OAuthCallbackPage() {
  const t = useT();
  const { provider = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const accountPath = useStorefrontPath("account", "/account");
  const authLoginPath = useStorefrontPath("auth-login", "/auth");
  const [error, setError] = useState<string | null>(null);
  const normalizedProvider = provider.toUpperCase() as LoginProvider;
  const code = searchParams.get("code") || "";
  const state = searchParams.get("state") || undefined;
  const providerError = searchParams.get("error_description") || searchParams.get("error");

  useEffect(() => {
    if (providerError) {
      setError(providerError);
      return;
    }
    if (!(normalizedProvider in AUTH_PROVIDER_META) || normalizedProvider === "PASSWORD" || normalizedProvider === "SITETOKEN" || !code) {
      setError(t("auth.oauth.callback_error"));
      return;
    }
    let cancelled = false;
    loginWithProvider(normalizedProvider, code, state)
      .then(() => {
        if (!cancelled) navigate(accountPath, { replace: true });
      })
      .catch((callbackError) => {
        if (!cancelled) setError(callbackError instanceof Error ? callbackError.message : t("auth.oauth.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [code, navigate, normalizedProvider, providerError, state, t]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4 py-16">
      <div className="grid w-full max-w-md gap-3 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{error ? "Sign-in could not be completed" : "Completing secure sign-in"}</h1>
        {error ? (
          <>
            <p role="alert" className="m-0 text-sm text-rose-600 dark:text-rose-400">{error}</p>
            <Link to={authLoginPath} className="text-sm font-semibold text-brand-600 dark:text-brand-400">Return to sign in</Link>
          </>
        ) : (
          <p role="status" className="m-0 text-sm text-zinc-500 dark:text-zinc-400">Exchanging the authorization response with the site…</p>
        )}
      </div>
    </div>
  );
}

function AuthTab({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <Link
      to={href}
      className={[
        "flex-1 rounded-control px-3 py-1.5 text-center text-xs font-semibold no-underline transition",
        isActive
          ? "bg-white text-zinc-900 shadow-soft dark:bg-zinc-900 dark:text-zinc-100"
          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

type TranslateFn = (key: string, replacements?: Record<string, string | number>) => string;
type ValidationRule = {
  label: string;
  min: number;
  max: number;
  required?: boolean;
  type?: "email" | "username";
};

function localizeFieldErrors<T extends Record<string, string>>(
  errors: FieldErrors,
  values: T,
  rules: Record<string, ValidationRule>,
  t: TranslateFn,
): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, rawError]) => [
      field,
      localizeFieldError(rawError, values[field] ?? "", rules[field], t),
    ]),
  );
}

function localizeFieldError(rawError: string, value: string, rule: ValidationRule | undefined, t: TranslateFn): string {
  if (rawError === "Passwords don't match") return t("validation.passwords_mismatch");
  if (!rule) return rawError;
  const trimmed = value.trim();
  if (rule.required && trimmed.length === 0) return t("validation.required", { label: rule.label });
  if (trimmed.length < rule.min) return t("validation.min_length", { label: rule.label, min: rule.min });
  if (trimmed.length > rule.max) return t("validation.max_length", { label: rule.label, max: rule.max });
  if (rule.type === "email" && !isValidEmail(trimmed)) return t("validation.email", { label: rule.label });
  if (rule.type === "username" && !/^[a-zA-Z0-9_.-]+$/.test(trimmed)) return t("validation.username_chars", { label: rule.label });
  return rawError;
}

function localizePasswordValidationMessage(message: string, t: TranslateFn): string {
  switch (message) {
    case "Use at least 8 characters.":
      return t("validation.password.min_length");
    case "Include an uppercase letter.":
      return t("validation.password.uppercase");
    case "Include a lowercase letter.":
      return t("validation.password.lowercase");
    case "Include a number.":
      return t("validation.password.number");
    case "Include a special character.":
      return t("validation.password.special");
    default:
      return message;
  }
}
