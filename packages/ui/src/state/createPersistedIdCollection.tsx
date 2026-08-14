import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SavedListSyncState } from "./savedListSync";

export type PersistedIdCollection = {
  ids: string[];
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
  /** True while a toggle/clear/login-merge round trip to the backend is in flight. */
  isSyncing: boolean;
  /** Set when the most recent backend round trip failed; the optimistic local
   * change was rolled back. Cleared automatically on the next successful sync. */
  syncError: string | null;
};

/**
 * Backend adapter for a `createPersistedIdCollection` instance. When supplied to the
 * Provider (together with an `accountId`), the collection stops being guest-local
 * only: on becoming authenticated it merges its locally-accumulated guest ids into
 * the backend, and every later `toggle`/`clear` optimistically updates local state
 * and then reconciles with the backend's authoritative response — rolling the
 * optimistic change back and surfacing `syncError` if the backend call fails.
 */
export type PersistedIdCollectionRemote = {
  /** Merge locally-accumulated guest ids into the backend collection, returning the
   * authoritative merged ids (the backend may drop invalid/over-cap ids). */
  mergeGuestIds: (guestIds: string[]) => Promise<string[]>;
  /** Toggle one id on the backend, returning the authoritative ids afterward. */
  toggleId: (id: string) => Promise<string[]>;
  /** Clear the backend collection, returning the (normally empty) authoritative ids. */
  clearIds: () => Promise<string[]>;
};

/**
 * Factory for a small "saved item ids" store (wishlist, reading list, ...) that is
 * persisted to localStorage and optionally synchronized with an authenticated
 * backend collection through the `PersistedIdCollectionRemote` adapter passed to
 * the Provider. Without a `remote` adapter (or while no `accountId` is available) it
 * behaves exactly as the original guest/mockup-only store: no server sync, no
 * conflict handling, but real enough to survive reloads while designs are reviewed.
 */
export function createPersistedIdCollection(storageKey: string) {
  const CollectionContext = createContext<PersistedIdCollection | undefined>(undefined);

  function Provider({
    children,
    accountId = null,
    remote,
  }: {
    children: ReactNode;
    /** Stable account identity. A boolean is unsafe because account switches must not
     * retain another user's authoritative collection. */
    accountId?: string | number | null;
    remote?: PersistedIdCollectionRemote;
  }) {
    const [ids, setIds] = useState<string[]>([]);
    const [guestIds, setGuestIds] = useState<string[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const guestIdsRef = useRef<string[]>([]);
    const syncStateRef = useRef(new SavedListSyncState());
    const scopeRef = useRef<string | null>(null);
    const queueRef = useRef<Promise<void>>(Promise.resolve());
    const pendingRequestCountRef = useRef(0);
    const mergeFailedScopeRef = useRef<string | null>(null);
    const accountScope = remote && accountId !== null && accountId !== undefined ? `account:${String(accountId)}` : null;

    useEffect(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const restoredIds = [...new Set(parsed.filter((value): value is string => typeof value === "string"))];
            guestIdsRef.current = restoredIds;
            syncStateRef.current.reset(restoredIds);
            setGuestIds(restoredIds);
            setIds(restoredIds);
          }
        }
      } catch {
        // Ignore malformed/unavailable storage and fall back to an empty collection.
      } finally {
        setIsHydrated(true);
      }
    }, []);

    useEffect(() => {
      if (!isHydrated) return;
      window.localStorage.setItem(storageKey, JSON.stringify(guestIds));
    }, [guestIds, isHydrated]);

    const renderSyncState = () => setIds(syncStateRef.current.ids);

    const enqueue = (scope: string, request: () => Promise<void>) => {
      pendingRequestCountRef.current += 1;
      setIsSyncing(true);
      queueRef.current = queueRef.current
        .then(async () => {
          if (scopeRef.current === scope) await request();
        })
        .finally(() => {
          if (scopeRef.current !== scope) return;
          pendingRequestCountRef.current -= 1;
          setIsSyncing(pendingRequestCountRef.current > 0);
        });
    };

    // Authenticated state is account-scoped, never localStorage-backed. Each scope
    // first merges the separately stored guest list (including an empty list, which
    // fetches the account's authoritative snapshot), then serializes later changes.
    useEffect(() => {
      if (!isHydrated) return;
      if (scopeRef.current === accountScope) return;

      scopeRef.current = accountScope;
      queueRef.current = Promise.resolve();
      pendingRequestCountRef.current = 0;
      mergeFailedScopeRef.current = null;
      setIsSyncing(false);
      setSyncError(null);
      syncStateRef.current.reset(guestIdsRef.current);
      renderSyncState();

      if (!accountScope || !remote) {
        return;
      }

      const guestIdsToMerge = guestIdsRef.current;
      enqueue(accountScope, async () => {
        if (mergeFailedScopeRef.current === accountScope) return;
        try {
          const mergedIds = await remote.mergeGuestIds(guestIdsToMerge);
          if (scopeRef.current !== accountScope) return;
          syncStateRef.current.replaceAuthoritative(mergedIds);
          guestIdsRef.current = [];
          setGuestIds([]);
          renderSyncState();
          setSyncError(null);
        } catch (error) {
          if (scopeRef.current !== accountScope) return;
          // Keep this browser's guest data intact and make queued clicks guest-local
          // too; an uncertain failed merge must never cause server toggles to invert it.
          const localIds = syncStateRef.current.ids;
          syncStateRef.current.reset(localIds);
          guestIdsRef.current = localIds;
          setGuestIds(localIds);
          setIds(localIds);
          mergeFailedScopeRef.current = accountScope;
          setSyncError(error instanceof Error ? error.message : "The saved list could not be synced");
        }
      });
    }, [accountScope, isHydrated, remote]);

    const value: PersistedIdCollection = {
      ids,
      count: ids.length,
      has: (id) => ids.includes(id),
      toggle: (id) => {
        if (!accountScope || !remote || mergeFailedScopeRef.current === accountScope) {
          const nextGuestIds = guestIdsRef.current.includes(id)
            ? guestIdsRef.current.filter((existing) => existing !== id)
            : [...guestIdsRef.current, id];
          guestIdsRef.current = nextGuestIds;
          syncStateRef.current.reset(nextGuestIds);
          setGuestIds(nextGuestIds);
          setIds(nextGuestIds);
          return;
        }
        const revision = syncStateRef.current.toggle(id);
        renderSyncState();
        setSyncError(null);
        enqueue(accountScope, async () => {
          if (mergeFailedScopeRef.current === accountScope) return;
          try {
            const authoritativeIds = await remote.toggleId(id);
            if (scopeRef.current !== accountScope) return;
            syncStateRef.current.resolve(revision, authoritativeIds);
            renderSyncState();
            setSyncError(null);
          } catch (error) {
            if (scopeRef.current !== accountScope) return;
            syncStateRef.current.reject(revision);
            renderSyncState();
            setSyncError(error instanceof Error ? error.message : "The change could not be saved");
          }
        });
      },
      clear: () => {
        if (!accountScope || !remote || mergeFailedScopeRef.current === accountScope) {
          guestIdsRef.current = [];
          syncStateRef.current.reset([]);
          setGuestIds([]);
          setIds([]);
          return;
        }
        const revision = syncStateRef.current.clear();
        renderSyncState();
        setSyncError(null);
        enqueue(accountScope, async () => {
          if (mergeFailedScopeRef.current === accountScope) return;
          try {
            const authoritativeIds = await remote.clearIds();
            if (scopeRef.current !== accountScope) return;
            syncStateRef.current.resolve(revision, authoritativeIds);
            renderSyncState();
            setSyncError(null);
          } catch (error) {
            if (scopeRef.current !== accountScope) return;
            syncStateRef.current.reject(revision);
            renderSyncState();
            setSyncError(error instanceof Error ? error.message : "The list could not be cleared");
          }
        });
      },
      isSyncing,
      syncError,
    };

    return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
  }

  function useCollection(): PersistedIdCollection {
    const context = useContext(CollectionContext);
    if (!context) {
      throw new Error(`Collection hook for "${storageKey}" must be used within its Provider`);
    }
    return context;
  }

  return { Provider, useCollection };
}
