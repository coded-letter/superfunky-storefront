import assert from "node:assert/strict";
import test from "node:test";
import {
  NEWSLETTER_POPUP_OPEN_DELAY_MS,
  NEWSLETTER_POPUP_STORAGE_KEY,
  readPopupState,
  resolveNewsletterPopupOpenMode,
  type PopupState,
} from "./NewsletterSignupPopup.behavior.ts";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly #values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

function installWindow(storage: Pick<Storage, "getItem" | "setItem">) {
  (globalThis as Record<string, unknown>).window = { localStorage: storage };
}

function uninstallWindow() {
  delete (globalThis as Record<string, unknown>).window;
}

test("reads persisted newsletter popup cooldown state from local storage safely", () => {
  const storage = new MemoryStorage();

  try {
    installWindow(storage);
    assert.deepEqual(readPopupState(), { status: "idle", nextVisibleAt: null });

    storage.setItem(NEWSLETTER_POPUP_STORAGE_KEY, JSON.stringify({ status: "dismissed", nextVisibleAt: 1234 } satisfies PopupState));
    assert.deepEqual(readPopupState(), { status: "dismissed", nextVisibleAt: 1234 });

    storage.setItem(NEWSLETTER_POPUP_STORAGE_KEY, JSON.stringify({ status: "subscribed", nextVisibleAt: 5678 } satisfies PopupState));
    assert.deepEqual(readPopupState(), { status: "subscribed", nextVisibleAt: 5678 });

    storage.setItem(NEWSLETTER_POPUP_STORAGE_KEY, "{not-json");
    assert.deepEqual(readPopupState(), { status: "idle", nextVisibleAt: null });
  } finally {
    uninstallWindow();
  }
});

test("resolves automatic, cooldown, explicit-hash, and disabled newsletter popup modes", () => {
  const futureCooldown: PopupState = { status: "dismissed", nextVisibleAt: 9_999 };
  const subscribedCooldown: PopupState = { status: "subscribed", nextVisibleAt: 9_999 };
  const idleState: PopupState = { status: "idle", nextVisibleAt: null };

  assert.equal(NEWSLETTER_POPUP_OPEN_DELAY_MS, 6000);
  assert.equal(resolveNewsletterPopupOpenMode({
    showNewsletterPopup: true,
    popupState: idleState,
    locationHash: "",
    now: 1_000,
  }), "automatic");
  assert.equal(resolveNewsletterPopupOpenMode({
    showNewsletterPopup: true,
    popupState: futureCooldown,
    locationHash: "",
    now: 1_000,
  }), "cooldown");
  assert.equal(resolveNewsletterPopupOpenMode({
    showNewsletterPopup: true,
    popupState: subscribedCooldown,
    locationHash: "",
    now: 1_000,
  }), "cooldown");
  assert.equal(resolveNewsletterPopupOpenMode({
    showNewsletterPopup: true,
    popupState: futureCooldown,
    locationHash: "#newsletter",
    now: 1_000,
  }), "explicit");
  assert.equal(resolveNewsletterPopupOpenMode({
    showNewsletterPopup: false,
    popupState: idleState,
    locationHash: "#newsletter",
    now: 1_000,
  }), "disabled");
});
