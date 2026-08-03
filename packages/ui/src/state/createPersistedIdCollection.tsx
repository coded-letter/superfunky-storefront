import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type PersistedIdCollection = {
  ids: string[];
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
};

/**
 * Factory for a small "saved item ids" store (wishlist, reading list, ...) that is
 * persisted to localStorage. Mockup-only state — no server sync, no optimistic
 * conflict handling — but real enough to survive reloads while designs are reviewed.
 */
export function createPersistedIdCollection(storageKey: string) {
  const CollectionContext = createContext<PersistedIdCollection | undefined>(undefined);

  function Provider({ children }: { children: ReactNode }) {
    const [ids, setIds] = useState<string[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setIds(parsed.filter((value): value is string => typeof value === "string"));
        }
      } catch {
        // Ignore malformed/unavailable storage and fall back to an empty collection.
      } finally {
        setIsHydrated(true);
      }
    }, []);

    useEffect(() => {
      if (!isHydrated) return;
      window.localStorage.setItem(storageKey, JSON.stringify(ids));
    }, [ids, isHydrated]);

    const value: PersistedIdCollection = {
      ids,
      count: ids.length,
      has: (id) => ids.includes(id),
      toggle: (id) => setIds((previous) => (previous.includes(id) ? previous.filter((existing) => existing !== id) : [...previous, id])),
      clear: () => setIds([]),
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
