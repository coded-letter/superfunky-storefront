import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BellRing,
  Eye,
  EyeOff,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  User,
  Users,
} from "lucide-react";
import { InputMock, primaryActionButtonClass } from "./shared";
import { CustomerShortcodePage } from "../components/CustomerShortcodePage";
import { useApplicationShortcode, useConfiguredState, useEmbeddedApplicationShortcode } from "../components/applicationShortcodes";
import {
  getCurrentPermission,
  getExistingSubscription,
  isPushBackendConfigured,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  type PushPermission,
} from "../lib/push";
import { ListProductModal, PaginablePostGrid, PaginableProductGrid, ResponsiveImage, SocialFeedGrid, UploadPostModal, WriteArticleModal, useCurrency, useLanguage, useToast, type ListProductInitialValues, type SocialPostCardData, type WriteArticleInitialValues } from "@funky/ui";
import { useCommunityData } from "../state/communityData";
import { useBlogData } from "../state/blogData";
import {
  createCollaboratorPost,
  createCommunityPost,
  createMarketplaceProduct,
  getCollaboratorPostForEditing,
  getMarketplaceProductForEditing,
  searchTranslationCandidatePosts,
  updateCollaboratorPost,
  updateCommunityProfileVisibility,
  updateMarketplaceProduct,
} from "../lib/community";
import { authStore, logOut } from "../lib/auth";
import { useStorefrontPath } from "../lib/storefrontPaths";
import {
  getStorefrontAccount,
  updateStorefrontAddress,
  type AccountAddress,
  type StorefrontAccount,
} from "../lib/account";

type AccountTab = "dashboard" | "orders" | "addresses" | "community";

const ORDER_STATUS_CLASS: Record<string, string> = {
  processing: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  "on-hold": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  pending: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  refunded: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  failed: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
};

const ACCOUNT_TABS: AccountTab[] = ["dashboard", "orders", "addresses", "community"];

function tabFromHash(hash: string): AccountTab | null {
  const candidate = hash.replace("#", "") as AccountTab;
  return ACCOUNT_TABS.includes(candidate) ? candidate : null;
}

/**
 * Account shell backed by authenticated WordPress and WooCommerce account data. The
 * active tab remains URL-addressable for account-menu deep links.
 */
export function AccountMockupPage() {
  const embedded = useEmbeddedApplicationShortcode();
  if (!embedded) {
    return (
      <CustomerShortcodePage
        pageKey="account"
        defaultShortcode="account"
        defaultAttributes={{ "default-tab": "dashboard", tabs: "dashboard,orders,addresses,community" }}
      />
    );
  }
  const location = useLocation();
  const navigate = useNavigate();
  const authLoginPath = useStorefrontPath("auth-login", "/auth");
  const authRegisterPath = useStorefrontPath("auth-register", "/auth/register");
  const config = useApplicationShortcode(["funkycommerce_account", "woocommerce_my_account"], {
    "default-tab": "dashboard",
    tabs: "dashboard,orders,addresses,community",
  });
  const configuredTab = ACCOUNT_TABS.includes(config["default-tab"] as AccountTab) ? config["default-tab"] as AccountTab : "dashboard";
  const allowedTabs = config.tabs.split(",").map((tab) => tab.trim()).filter((tab): tab is AccountTab => ACCOUNT_TABS.includes(tab as AccountTab));
  const defaultTab = allowedTabs.includes(configuredTab) ? configuredTab : allowedTabs[0] ?? "dashboard";
  const [activeTab, setActiveTab] = useConfiguredState<AccountTab>(embedded ? defaultTab : tabFromHash(location.hash) ?? defaultTab);
  const [accountRevision, setAccountRevision] = useState(0);
  const [authUserId, setAuthUserId] = useState(() => authStore.load()?.user?.databaseId || 0);
  const [accountState, setAccountState] = useState<{ data: StorefrontAccount | null; isLoading: boolean; error: Error | null }>({
    data: null,
    isLoading: Boolean(authUserId),
    error: null,
  });
  useEffect(() => authStore.subscribe(() => setAuthUserId(authStore.load()?.user?.databaseId || 0)), []);
  useEffect(() => {
    let cancelled = false;
    if (!authUserId) {
      setAccountState({ data: null, isLoading: false, error: null });
      return () => {
        cancelled = true;
      };
    }
    setAccountState((current) => ({ ...current, isLoading: true, error: null }));
    getStorefrontAccount()
      .then((data) => {
        if (!cancelled) setAccountState({ data, isLoading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setAccountState({ data: null, isLoading: false, error: error instanceof Error ? error : new Error("The account could not be loaded") });
      });
    return () => {
      cancelled = true;
    };
  }, [accountRevision, authUserId]);
  const account = accountState.data;

  useEffect(() => {
    setActiveTab(embedded ? defaultTab : tabFromHash(location.hash) ?? defaultTab);
  }, [defaultTab, embedded, location.hash, setActiveTab]);

  const selectTab = (tab: AccountTab) => {
    setActiveTab(tab);
    if (!embedded) navigate(`/account#${tab}`, { replace: true });
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="grid h-fit gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 lg:sticky lg:top-28">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">
              JD
            </div>
            <div className="grid min-w-0 gap-0.5">
              <p className="m-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{account?.displayName || "Guest account"}</p>
              <p className="m-0 truncate text-xs text-zinc-500 dark:text-zinc-400">{account?.email || "Sign in to load your account"}</p>
            </div>
          </div>

          <nav className="grid gap-1">
            {allowedTabs.includes("dashboard") ? <SidebarTab
              icon={<User className="h-4 w-4" aria-hidden="true" />}
              label="Dashboard"
              isActive={activeTab === "dashboard"}
              onClick={() => selectTab("dashboard")}
            /> : null}
            {allowedTabs.includes("orders") ? <SidebarTab
              icon={<Package className="h-4 w-4" aria-hidden="true" />}
              label="Orders"
              isActive={activeTab === "orders"}
              onClick={() => selectTab("orders")}
            /> : null}
            {allowedTabs.includes("addresses") ? <SidebarTab
              icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
              label="Addresses"
              isActive={activeTab === "addresses"}
              onClick={() => selectTab("addresses")}
            /> : null}
            {allowedTabs.includes("community") ? <SidebarTab
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              label="Community"
              isActive={activeTab === "community"}
              onClick={() => selectTab("community")}
            /> : null}
            {authUserId ? (
              <Link
                to="/"
                onClick={logOut}
                className="mt-1 flex items-center gap-2.5 rounded-xl border-t border-zinc-100 px-3 pt-3 text-sm font-medium text-zinc-500 no-underline transition hover:text-rose-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Log out
              </Link>
            ) : (
              <Link
                to={authLoginPath}
                className="mt-1 flex items-center gap-2.5 rounded-xl border-t border-zinc-100 px-3 pt-3 text-sm font-semibold text-brand-600 no-underline transition hover:text-brand-500 dark:border-zinc-800 dark:text-brand-400"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Sign in or register
              </Link>
            )}
          </nav>
        </aside>

        <section>
          {!authUserId ? <GuestAccountPanel tab={activeTab} authLoginPath={authLoginPath} authRegisterPath={authRegisterPath} /> : null}
          {authUserId && activeTab === "dashboard" ? (
            <DashboardPanel account={account} isLoading={accountState.isLoading} error={accountState.error} />
          ) : null}
          {authUserId && activeTab === "orders" ? <OrdersPanel account={account} isLoading={accountState.isLoading} error={accountState.error} /> : null}
          {authUserId && activeTab === "addresses" ? (
            <AddressesPanel
              account={account}
              isLoading={accountState.isLoading}
              error={accountState.error}
              onSaved={() => setAccountRevision((value) => value + 1)}
            />
          ) : null}
          {authUserId && activeTab === "community" ? <CommunityPanel /> : null}
        </section>
      </div>
    </div>
  );
}

const GUEST_ACCOUNT_CONTENT: Record<AccountTab, { eyebrow: string; title: string; description: string; benefits: string[] }> = {
  dashboard: {
    eyebrow: "Your personal storefront",
    title: "Bring your account experience together",
    description: "Sign in to see your verified profile and the private customer tools available to your WordPress account.",
    benefits: ["Review your profile and account status", "See orders and saved delivery details together", "Discover publishing tools enabled for your role"],
  },
  orders: {
    eyebrow: "Private order history",
    title: "Track every purchase in one place",
    description: "Your order history is private. Sign in to review real order statuses, totals, products, and variation details.",
    benefits: ["See current fulfilment status", "Review line items and variations", "Keep past purchases available for reference"],
  },
  addresses: {
    eyebrow: "Faster checkout",
    title: "Save billing and shipping details",
    description: "Create an account to securely manage the addresses WordPress uses for your customer profile and future checkouts.",
    benefits: ["Edit billing and shipping separately", "Reuse accurate customer details", "Keep address data private to your account"],
  },
  community: {
    eyebrow: "Community and marketplace",
    title: "Unlock the tools assigned to your role",
    description: "Sign in to manage your public profile and access Creator, Collaborator, or administrator publishing actions when permitted.",
    benefits: ["Control public profile visibility", "Publish community posts when eligible", "List products and write articles when eligible"],
  },
};

function GuestAccountPanel({ tab, authLoginPath, authRegisterPath }: { tab: AccountTab; authLoginPath: string; authRegisterPath: string }) {
  const content = GUEST_ACCOUNT_CONTENT[tab];
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <div className="bg-brand-gradient px-6 py-8 text-white sm:px-8">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">{content.eyebrow}</p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{content.title}</h1>
        <p className="mb-0 mt-3 max-w-2xl text-sm leading-relaxed text-white/85">{content.description}</p>
      </div>
      <div className="grid gap-6 p-6 sm:p-8">
        <ul className="grid gap-3 p-0 sm:grid-cols-3">
          {content.benefits.map((benefit) => (
            <li key={benefit} className="flex list-none items-start gap-2 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link to={authLoginPath} className={`${primaryActionButtonClass} inline-flex items-center justify-center no-underline`}>
            Log in
          </Link>
          <Link
            to={authRegisterPath}
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 no-underline transition hover:border-brand-400 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

function SidebarTab({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
        isActive
          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
          : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

type ProfileFormState = {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  phone: string;
  websiteUrl: string;
  bio: string;
  newsletterSubscribed: boolean;
};

const DEFAULT_PROFILE: ProfileFormState = {
  firstName: "",
  lastName: "",
  nickname: "",
  email: "",
  phone: "",
  websiteUrl: "",
  bio: "",
  newsletterSubscribed: false,
};

function DashboardPanel({
  account,
  isLoading,
  error,
}: {
  account: StorefrontAccount | null;
  isLoading: boolean;
  error: Error | null;
}) {
  const [profile, setProfile] = useState<ProfileFormState>(DEFAULT_PROFILE);
  const [draft, setDraft] = useState<ProfileFormState>(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!account) return;
    const nextProfile = {
      ...DEFAULT_PROFILE,
      firstName: account.firstName,
      lastName: account.lastName,
      nickname: account.displayName,
      email: account.email,
      phone: account.billingAddress.phone,
    };
    setProfile(nextProfile);
    setDraft(nextProfile);
  }, [account]);

  const startEditing = () => {
    setDraft(profile);
    setIsEditing(true);
  };
  const cancelEditing = () => {
    setDraft(profile);
    setIsEditing(false);
  };
  const saveEditing = () => {
    setProfile(draft);
    setIsEditing(false);
  };

  const updateDraft = (key: keyof ProfileFormState) => (value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  // Mock-only avatar upload: previews the picked file locally via FileReader (no upload
  // target exists yet) — mirrors the legacy prototype's separate "upload immediately"
  // avatar mutation, decoupled from the main profile Save/Cancel flow.
  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase() || "JD";
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  if (isLoading) return <AccountLoadingDots label="Loading your account" />;
  if (error) return <AccountPanelStatus message={error.message} tone="error" />;
  if (!account) return <AccountPanelStatus message="Sign in to load your profile and account summary." />;

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="grid gap-2">
              {avatarPreview ? (
                <ResponsiveImage
                  src={avatarPreview}
                  alt={fullName}
                  priority
                  sizes="4rem"
                  className="h-16 w-16 rounded-full object-cover shadow-glow"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-gradient text-xl font-bold text-white shadow-glow">
                  {initials}
                </div>
              )}
              {isEditing ? (
                <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 font-semibold text-zinc-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300">
                    <Upload className="h-3 w-3" aria-hidden="true" />
                    Change avatar
                    <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleAvatarChange} className="sr-only" />
                  </span>
                  <span>Max file size 690KB</span>
                </label>
              ) : null}
            </div>
            <div className="grid gap-1">
              <h1 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">Hi, {profile.firstName} 👋</h1>
              <p className="m-0 text-sm capitalize text-zinc-500 dark:text-zinc-400">{account ? `${account.role} role` : "Sign in to load your account"}</p>
            </div>
          </div>
          <div className="grid gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified account
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                profile.newsletterSubscribed
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              {profile.newsletterSubscribed ? "Subscribed to newsletter" : "Not subscribed to newsletter"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders placed" value={(account?.orders.length || 0).toString()} />
        <StatCard label="Saved addresses" value={[account?.billingAddress.address1, account?.shippingAddress.address1].filter(Boolean).length.toString()} />
        <StatCard label="Publishing role" value={account?.role || "Member"} />
      </div>

      <PushNotificationsCard />

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Profile details</h2>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveEditing}
                className={`${primaryActionButtonClass} !px-3.5 !py-1.5 text-xs`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <InputMock label="Username" value={draft.nickname} readOnly helperText="Username can't be changed." />
          <InputMock label="Email" type="email" value={draft.email} onChange={isEditing ? updateDraft("email") : undefined} readOnly={!isEditing} />
          <InputMock label="First name" value={draft.firstName} onChange={isEditing ? updateDraft("firstName") : undefined} readOnly={!isEditing} />
          <InputMock label="Last name" value={draft.lastName} onChange={isEditing ? updateDraft("lastName") : undefined} readOnly={!isEditing} />
          <InputMock label="Phone" value={draft.phone} onChange={isEditing ? updateDraft("phone") : undefined} readOnly={!isEditing} />
          <InputMock label="Website" value={draft.websiteUrl} onChange={isEditing ? updateDraft("websiteUrl") : undefined} readOnly={!isEditing} />
        </div>
        <div className="mt-4">
          <InputMock
            label="Bio"
            multiline
            rows={3}
            value={draft.bio}
            onChange={isEditing ? updateDraft("bio") : undefined}
            readOnly={!isEditing}
          />
        </div>
        {isEditing ? (
          <label className="mt-4 flex items-center gap-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={draft.newsletterSubscribed}
              onChange={(event) => setDraft((previous) => ({ ...previous, newsletterSubscribed: event.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
            />
            Subscribed to the newsletter
          </label>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <p className="m-0 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="m-0 mt-1 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

/** Preview-only push-notification opt-in: registers/checks the `/sw.js` subscription
 * via `lib/push.ts` and reflects real browser permission + subscription state. The
 * actual pushes are configured and sent from the WP backend once it exists — see
 * `lib/push.ts`'s header comment for the expected REST routes. */
function PushNotificationsCard() {
  const [permission, setPermission] = useState<PushPermission>(() => getCurrentPermission());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExistingSubscription().then((subscription) => {
      if (!cancelled) setIsSubscribed(Boolean(subscription));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await subscribeToPush();
      setIsSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enable push notifications.");
    } finally {
      setPermission(getCurrentPermission());
      setIsBusy(false);
    }
  };

  const handleDisable = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
    } catch {
      setError("Couldn't disable push notifications.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <BellRing className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="grid gap-1">
            <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Push notifications</h2>
            <p className="m-0 max-w-md text-sm text-zinc-600 dark:text-zinc-300">
              {isPushSupported
                ? "Get order updates, back-in-stock alerts, and shipping notices sent straight to this device."
                : "Push notifications aren't supported in this browser."}
            </p>
          </div>
        </div>
        {isPushSupported ? (
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              isSubscribed
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {isSubscribed ? "Enabled" : "Disabled"}
          </span>
        ) : null}
      </div>

      {isPushSupported ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isSubscribed ? (
            <button
              type="button"
              onClick={handleDisable}
              disabled={isBusy}
              className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            >
              {isBusy ? "Disabling…" : "Disable notifications"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={isBusy || permission === "denied"}
              className={`${primaryActionButtonClass} !px-4 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isBusy ? "Requesting…" : "Enable notifications"}
            </button>
          )}
          {permission === "denied" && !isSubscribed ? (
            <p className="m-0 text-xs text-rose-600 dark:text-rose-400">
              Blocked in your browser — allow notifications for this site to re-enable.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="m-0 mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}

      {isPushSupported && !isPushBackendConfigured ? (
        <p className="m-0 mt-4 flex items-start gap-1.5 rounded-lg border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Not connected yet — once the WordPress backend is wired up (VAPID key + subscribe endpoint), enabling here
          registers this device to receive its pushes.
        </p>
      ) : null}
    </div>
  );
}

function OrdersPanel({
  account,
  isLoading,
  error,
}: {
  account: StorefrontAccount | null;
  isLoading: boolean;
  error: Error | null;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const orders = account?.orders || [];
  const statusFilters = [
    { label: "All", value: "all" },
    ...Array.from(new Map(orders.map((order) => [order.status, order.statusText])).entries()).map(([value, label]) => ({ value, label })),
  ];
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesQuery = query.trim().length === 0 || order.number.toLowerCase().includes(query.trim().toLowerCase());
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">Order history</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order number..."
            className="rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-3.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:ring-brand-950"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800/60">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              statusFilter === filter.value
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading ? <AccountPanelStatus message="Loading your orders…" /> : null}
      {error ? <AccountPanelStatus message={error.message} tone="error" /> : null}
      {!isLoading && !error && !account ? <AccountPanelStatus message="Sign in to view your order history." /> : null}
      {!isLoading && account && filteredOrders.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-white/60 px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <Package className="h-8 w-8 text-zinc-300 dark:text-zinc-700" aria-hidden="true" />
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">No orders match your search.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredOrders.map((order) => (
            <article
              key={order.databaseId}
              className="grid gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft transition hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-0.5">
                  <p className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Order #{order.number}</p>
                  <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">Placed {formatOrderDate(order.date)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_CLASS[order.status] || "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                  {order.statusText}
                </span>
              </div>

              <ul className="m-0 grid list-none gap-1.5 border-t border-zinc-100 p-0 pt-3 text-sm dark:border-zinc-800">
                {order.items.map((item) => (
                  <li key={`${order.databaseId}-${item.name}-${item.variation}`} className="flex items-center justify-between gap-3 text-zinc-600 dark:text-zinc-300">
                    <span>
                      {item.name} <span className="text-zinc-400 dark:text-zinc-500">{item.variation ? `· ${item.variation} ` : "· "}× {item.quantity}</span>
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.total}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Total: {order.total}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-wide text-zinc-400">{order.currency}</span>
                  <a
                    href={`/order/${order.databaseId}`}
                    className="text-xs font-medium text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    View details
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AddressesPanel({
  account,
  isLoading,
  error,
  onSaved,
}: {
  account: StorefrontAccount | null;
  isLoading: boolean;
  error: Error | null;
  onSaved: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">Addresses</h1>
      </div>

      {isLoading ? <AccountPanelStatus message="Loading your saved addresses…" /> : null}
      {error ? <AccountPanelStatus message={error.message} tone="error" /> : null}
      {!isLoading && !error && !account ? <AccountPanelStatus message="Sign in to manage billing and shipping addresses." /> : null}
      {account ? (
        <div className="grid gap-4 md:grid-cols-2">
          <AddressCard title="Billing address" address={account.billingAddress} onSaved={onSaved} />
          <AddressCard title="Shipping address" address={account.shippingAddress} onSaved={onSaved} />
        </div>
      ) : null}
    </div>
  );
}

/** Authenticated community publishing and marketplace controls. */
function CommunityPanel() {
  const { data: community, viewer: user, refresh } = useCommunityData();
  const { data: blog } = useBlogData();
  const { languageCode } = useLanguage();
  const { baseCurrency, convertSelectedToBase } = useCurrency();
  const [isPublic, setIsPublic] = useState(user?.isPublic ?? true);
  useEffect(() => setIsPublic(user?.isPublic ?? true), [user?.isPublic]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isListProductOpen, setIsListProductOpen] = useState(false);
  const [isWriteArticleOpen, setIsWriteArticleOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ListProductInitialValues | null>(null);
  const [editingArticle, setEditingArticle] = useState<WriteArticleInitialValues | null>(null);
  const [isLoadingEditTarget, setIsLoadingEditTarget] = useState(false);
  const { showToast } = useToast();
  const canPublishCommunityPosts = user?.capabilities.includes("publish_community_posts") ?? false;
  const canPublishMarketplace = user?.capabilities.includes("publish_marketplace_products") ?? false;
  const canPublishArticles = user?.capabilities.includes("publish_collaborator_posts") ?? false;
  const profilesPublicEnabled = community?.profilesPublicEnabled ?? true;
  const myProducts = user ? (community?.marketplaceItems || []).filter(({ vendor }) => vendor.databaseId === user.databaseId).map(({ product }) => product) : [];
  const myArticles = user ? (blog?.posts || []).filter((post) => post.authorDatabaseId === user.databaseId) : [];
  const topProduct = [...myProducts].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))[0];

  const requestCreatorAccess = () => {
    showToast({
      title: "Publishing access is staff-managed",
      description: "Ask an administrator to assign the Creator role for community posts or Collaborator role for marketplace products and articles.",
      tone: "default",
    });
  };

  const openProductForEditing = async (productId: number) => {
    if (isLoadingEditTarget) return;
    setIsLoadingEditTarget(true);
    try {
      const product = await getMarketplaceProductForEditing(productId);
      if (!product) throw new Error("That product could not be loaded.");
      setEditingProduct({ ...product, productId: product.databaseId, imagePreviews: product.imageUrls });
      setIsListProductOpen(true);
    } catch (error) {
      showToast({ title: "Could not load product", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    } finally {
      setIsLoadingEditTarget(false);
    }
  };

  const openArticleForEditing = async (postId: number) => {
    if (isLoadingEditTarget) return;
    setIsLoadingEditTarget(true);
    try {
      const post = await getCollaboratorPostForEditing(postId);
      if (!post) throw new Error("That article could not be loaded.");
      setEditingArticle({
        postId: post.databaseId,
        imageUrl: post.imageUrl,
        title: post.title,
        excerpt: post.excerpt,
        category: post.category,
        tags: post.tags,
        body: post.content,
        slug: post.slug,
        metaTitle: post.metaTitle,
        metaDescription: post.metaDescription,
        focusKeyword: post.focusKeyword,
        languageCode: post.languageCode,
        translationOfId: post.translationOfId,
      });
      setIsWriteArticleOpen(true);
    } catch (error) {
      showToast({ title: "Could not load article", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    } finally {
      setIsLoadingEditTarget(false);
    }
  };

  const myPosts: SocialPostCardData[] = user
    ? (community?.posts || []).filter((post) => post.author.handle === user.handle)
    : [];

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <Users className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div className="grid gap-1">
              <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Community profile</h2>
              <p className="m-0 max-w-md text-sm text-zinc-600 dark:text-zinc-300">
                {profilesPublicEnabled
                  ? "Your uploads appear on the site-wide community feed when your profile is public. Switch to private to only let yourself see them here."
                  : "Public community profiles are disabled globally. Your profile and uploads remain visible only to you."}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            disabled={!user || !profilesPublicEnabled}
            onClick={async () => {
              if (!user) return;
              const nextValue = !isPublic;
              await updateCommunityProfileVisibility(nextValue);
              setIsPublic(nextValue);
              refresh();
            }}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
              isPublic
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {profilesPublicEnabled && isPublic ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
            {profilesPublicEnabled ? (isPublic ? "Public" : "Private") : "Disabled by site"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {user ? <Link
            to={`/community/${user.handle}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 no-underline transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            View my public profile
          </Link> : null}
          {canPublishCommunityPosts ? <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className={`${primaryActionButtonClass} inline-flex items-center gap-1.5 !px-4 !py-2 text-xs`}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Share a post
          </button> : null}
        </div>

        {user && community?.followersEnabled ? (
          <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <div className="grid gap-0.5 text-center">
              <span className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{myPosts.length}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Posts</span>
            </div>
            <div className="grid gap-0.5 text-center">
              <span className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{user.followerCount}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Followers</span>
            </div>
            <div className="grid gap-0.5 text-center">
              <span className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{user.followingCount}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Following</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
              <Store className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div className="grid gap-1">
              <h2 className="m-0 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Marketplace
                {canPublishMarketplace || canPublishArticles ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Publishing enabled
                  </span>
                ) : null}
              </h2>
              <p className="m-0 max-w-md text-sm text-zinc-600 dark:text-zinc-300">
                {canPublishMarketplace || canPublishArticles
                  ? "Your account can publish the enabled WooCommerce products and WordPress articles under your profile."
                  : "Marketplace products and authored articles require the staff-assigned Collaborator role."}
              </p>
            </div>
          </div>
          {!canPublishMarketplace && !canPublishArticles ? (
            <button
              type="button"
              onClick={requestCreatorAccess}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 px-3.5 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
            >
              Publishing roles
            </button>
          ) : null}
        </div>

        {canPublishMarketplace || canPublishArticles ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <DashboardStat label="Published listings" value={myProducts.length.toString()} />
              <DashboardStat label="Published articles" value={myArticles.length.toString()} />
              <DashboardStat label="Top product" value={topProduct?.name ?? "—"} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                to={`/community/${user?.handle || ""}?tab=shop`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 no-underline transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
              >
                <Package className="h-3.5 w-3.5" aria-hidden="true" />
                {myProducts.length} product{myProducts.length === 1 ? "" : "s"} listed
              </Link>
              <Link
                to={`/community/${user?.handle || ""}?tab=articles`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 no-underline transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                {myArticles.length} article{myArticles.length === 1 ? "" : "s"} published
              </Link>
              {canPublishMarketplace ? <button
                type="button"
                onClick={() => setIsListProductOpen(true)}
                className={`${primaryActionButtonClass} inline-flex items-center gap-1.5 !px-4 !py-2 text-xs`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                List a new product
              </button> : null}
              {canPublishArticles ? <button
                type="button"
                onClick={() => setIsWriteArticleOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Write an article
              </button> : null}
            </div>

          </>
        ) : null}
      </div>

      {myPosts.length ? (
        <SocialFeedGrid title="My posts" posts={myPosts} pageSize={6} defaultLayout="compact" />
      ) : (
        <p className="m-0 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          You haven't shared anything to the community feed yet.
        </p>
      )}

      {myArticles.length ? (
        <div className="grid gap-2">
          <PaginablePostGrid title="My articles" posts={myArticles} pageSize={6} cardVariant="minimal" gridVariant="list" />
          {canPublishArticles ? (
            <div className="flex flex-wrap gap-2">
              {myArticles.map((article) => article.databaseId ? (
                <button
                  key={article.databaseId}
                  type="button"
                  disabled={isLoadingEditTarget}
                  onClick={() => openArticleForEditing(article.databaseId as number)}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  Edit "{article.title}"
                </button>
              ) : null)}
            </div>
          ) : null}
        </div>
      ) : null}

      {myProducts.length ? (
        <div className="grid gap-2">
          <PaginableProductGrid title="My products" products={myProducts} pageSize={8} cardVariant="default" allowPurchaseActions={false} />
          {canPublishMarketplace ? (
            <div className="flex flex-wrap gap-2">
              {myProducts.map((product) => product.databaseId ? (
                <button
                  key={product.databaseId}
                  type="button"
                  disabled={isLoadingEditTarget}
                  onClick={() => openProductForEditing(product.databaseId as number)}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  Edit "{product.name}"
                </button>
              ) : null)}
            </div>
          ) : null}
        </div>
      ) : null}

      {isUploadOpen ? (
        <UploadPostModal
          onClose={() => setIsUploadOpen(false)}
          onSubmit={async (draft) => {
            if (!draft.imagePreview) throw new Error("Choose an image before publishing");
            await createCommunityPost({ imageDataUrl: draft.imagePreview, caption: draft.caption, tags: draft.tags, language: languageCode });
            refresh();
          }}
        />
      ) : null}
      {isListProductOpen ? (
        <ListProductModal
          initialProduct={editingProduct || undefined}
          onClose={() => {
            setIsListProductOpen(false);
            setEditingProduct(null);
          }}
          onSubmit={async (draft) => {
            const productInput = {
              name: draft.name,
              subtitle: draft.subtitle,
              description: draft.description,
              category: draft.category,
              brand: draft.brand,
              upsellIds: draft.upsellIds,
              crossSellIds: draft.crossSellIds,
              sku: draft.sku,
              currency: baseCurrency,
              price: draft.productType === "simple" ? convertSelectedToBase(draft.priceAmount) : 0,
              regularPrice: draft.compareAtPriceAmount !== undefined ? convertSelectedToBase(draft.compareAtPriceAmount) : undefined,
              stockQuantity: draft.stockQuantity,
              imageDataUrls: draft.imagePreviews,
              isVirtual: draft.isVirtual,
              isDownloadable: draft.isDownloadable,
              downloadableFiles: draft.downloadableFiles,
              downloadLimit: draft.downloadLimit,
              downloadExpiryDays: draft.downloadExpiryDays,
              attributes: draft.attributes,
              variations: draft.variations.map((variation) => ({
                attributes: variation.attributes,
                sku: variation.sku,
                price: convertSelectedToBase(variation.priceAmount),
                regularPrice: variation.compareAtPriceAmount !== undefined ? convertSelectedToBase(variation.compareAtPriceAmount) : undefined,
                stockQuantity: variation.stockQuantity,
                imageIndex: variation.imageIndex,
              })),
            };
            if (draft.productId) {
              await updateMarketplaceProduct({ ...productInput, productId: draft.productId });
            } else {
              await createMarketplaceProduct({ ...productInput, productType: draft.productType, language: languageCode });
            }
            setEditingProduct(null);
            refresh();
          }}
        />
      ) : null}
      {isWriteArticleOpen ? (
        <WriteArticleModal
          initialPost={editingArticle || undefined}
          searchTranslationCandidates={(query) => searchTranslationCandidatePosts(query, editingArticle?.languageCode || languageCode, editingArticle?.postId)}
          onClose={() => {
            setIsWriteArticleOpen(false);
            setEditingArticle(null);
          }}
          onSubmit={async (draft) => {
            const postInput = {
              title: draft.title,
              excerpt: draft.excerpt,
              content: draft.body,
              category: draft.category,
              tags: draft.tags,
              imageDataUrl: draft.imagePreview || undefined,
              slug: draft.slug,
              metaTitle: draft.metaTitle,
              metaDescription: draft.metaDescription,
              focusKeyword: draft.focusKeyword,
              translationOfId: draft.translationOfId,
            };
            if (draft.postId) {
              await updateCollaboratorPost({ ...postInput, postId: draft.postId });
            } else {
              await createCollaboratorPost({ ...postInput, language: languageCode });
            }
            setEditingArticle(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function DashboardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 rounded-xl border border-zinc-200/80 px-3 py-2.5 dark:border-zinc-800">
      <p className="m-0 truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="m-0 text-[0.68rem] text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

function AddressCard({
  title,
  address,
  onSaved,
}: {
  title: string;
  address: AccountAddress;
  onSaved: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(address);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => setDraft(address), [address]);

  const save = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const { type: _type, ...input } = draft;
      await updateStorefrontAddress(address.type, input);
      setIsEditing(false);
      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The address could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const setField = (field: keyof AccountAddress) => (event: ChangeEvent<HTMLInputElement>) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }));

  const isEmpty = !address.address1 && !address.city && !address.postcode;
  return (
    <article className="grid gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h2>
      </div>
      {isEditing ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <AddressInput label="First name" value={draft.firstName} onChange={setField("firstName")} required />
            <AddressInput label="Last name" value={draft.lastName} onChange={setField("lastName")} required />
          </div>
          <AddressInput label="Company" value={draft.company} onChange={setField("company")} />
          <AddressInput label="Address line 1" value={draft.address1} onChange={setField("address1")} required />
          <AddressInput label="Address line 2" value={draft.address2} onChange={setField("address2")} />
          <div className="grid grid-cols-2 gap-3">
            <AddressInput label="City" value={draft.city} onChange={setField("city")} required />
            <AddressInput label="State / region" value={draft.state} onChange={setField("state")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AddressInput label="Postcode" value={draft.postcode} onChange={setField("postcode")} required />
            <AddressInput label="Country code" value={draft.country} onChange={setField("country")} placeholder="GR" maxLength={2} required />
          </div>
          <AddressInput label="Phone" value={draft.phone} onChange={setField("phone")} type="tel" />
          <AddressInput label="Email" value={draft.email} onChange={setField("email")} type="email" />
          {saveError ? <p role="alert" className="m-0 text-xs font-medium text-rose-600 dark:text-rose-400">{saveError}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={isSaving} className={`${primaryActionButtonClass} !px-4 !py-2 text-xs disabled:opacity-60`}>
              {isSaving ? "Saving…" : "Save address"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(address);
                setSaveError(null);
                setIsEditing(false);
              }}
              className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {isEmpty ? (
            <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">No {address.type} address has been saved yet.</p>
          ) : (
            <div className="grid gap-1 text-sm text-zinc-600 dark:text-zinc-300">
              <p className="m-0 font-semibold text-zinc-900 dark:text-zinc-100">{`${address.firstName} ${address.lastName}`.trim()}</p>
              {address.company ? <p className="m-0">{address.company}</p> : null}
              <p className="m-0">{address.address1}</p>
              {address.address2 ? <p className="m-0">{address.address2}</p> : null}
              <p className="m-0">{[address.city, address.state, address.postcode].filter(Boolean).join(", ")}</p>
              <p className="m-0">{address.country}</p>
              {address.phone ? <p className="m-0 mt-2 flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{address.phone}</p> : null}
              {address.email ? <p className="m-0 flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{address.email}</p> : null}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            {isEmpty ? <Plus className="h-3.5 w-3.5" aria-hidden="true" /> : <Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
            {isEmpty ? "Add address" : "Edit"}
          </button>
        </>
      )}
    </article>
  );
}

function AddressInput({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
      <span>{label}{props.required ? " *" : ""}</span>
      <input
        {...props}
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
    </label>
  );
}

function AccountPanelStatus({ message, tone = "neutral" }: { message: string; tone?: "neutral" | "error" }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`m-0 rounded-2xl border border-dashed px-5 py-4 text-sm ${tone === "error" ? "border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-400" : "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"}`}>
      {message}
    </p>
  );
}

function AccountLoadingDots({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="flex min-h-24 items-center justify-center gap-1.5">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="h-2 w-2 animate-bounce rounded-full bg-brand-500"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </div>
  );
}

function formatOrderDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

