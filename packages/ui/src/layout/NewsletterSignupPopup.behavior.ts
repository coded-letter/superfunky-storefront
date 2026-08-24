export type PopupState = {
  status: "idle" | "dismissed" | "subscribed";
  nextVisibleAt: number | null;
};

export const NEWSLETTER_POPUP_STORAGE_KEY = "funkycommerce-mailing-list-popup";
export const NEWSLETTER_POPUP_OPEN_DELAY_MS = 6000;

const DEFAULT_POPUP_STATE: PopupState = {
  status: "idle",
  nextVisibleAt: null,
};

function hashMatchesNewsletter(hash: string) {
  return hash.replace(/^#/, "") === "newsletter";
}

export function resolveNewsletterPopupOpenMode({
  showNewsletterPopup,
  popupState,
  locationHash,
  now = Date.now(),
}: {
  showNewsletterPopup: boolean;
  popupState: PopupState;
  locationHash: string;
  now?: number;
}): "disabled" | "explicit" | "cooldown" | "automatic" {
  if (!showNewsletterPopup) return "disabled";
  if (hashMatchesNewsletter(locationHash)) return "explicit";
  return popupState.nextVisibleAt && now < popupState.nextVisibleAt ? "cooldown" : "automatic";
}

export function readPopupState(): PopupState {
  if (typeof window === "undefined") return DEFAULT_POPUP_STATE;

  try {
    const parsed = window.localStorage.getItem(NEWSLETTER_POPUP_STORAGE_KEY);
    if (!parsed) return DEFAULT_POPUP_STATE;

    const value = JSON.parse(parsed) as Partial<PopupState>;
    return {
      status: value.status === "dismissed" || value.status === "subscribed" ? value.status : "idle",
      nextVisibleAt: typeof value.nextVisibleAt === "number" ? value.nextVisibleAt : null,
    };
  } catch {
    return DEFAULT_POPUP_STATE;
  }
}
