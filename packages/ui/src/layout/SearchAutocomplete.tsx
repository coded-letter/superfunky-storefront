import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, FolderTree, LayoutTemplate, Package, Search, Tags } from "lucide-react";

export type SearchResultItem = {
  type: "product" | "post" | "page" | "category" | "tag";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

// Small mock search index — stands in for a real product/post search endpoint so the
// header's search inputs have something to demo. Kept local to the header (rather than
// pulled from an app's own mock catalog) since `packages/ui` is shared across apps and
// shouldn't reach into any single app's page-level mock data.
const SEARCH_INDEX: SearchResultItem[] = [
  { type: "product", id: "p-001", title: "Nebula Hoodie", subtitle: "Apparel · €79.00", href: "/shop/nebula-hoodie" },
  { type: "product", id: "p-002", title: "Orbit Crossbody Bag", subtitle: "Accessories · €49.00", href: "/shop/orbit-crossbody-bag" },
  { type: "product", id: "p-003", title: "Flux Sneakers", subtitle: "Footwear · €119.00", href: "/shop/flux-sneakers" },
  { type: "product", id: "p-004", title: "Pulse Joggers", subtitle: "Apparel · €59.00", href: "/shop/pulse-joggers" },
  { type: "product", id: "p-005", title: "Mono Cap", subtitle: "Accessories · €24.00", href: "/shop/mono-cap" },
  { type: "product", id: "p-006", title: "Shift Tee", subtitle: "Apparel · €29.00", href: "/shop/shift-tee" },
  {
    type: "post",
    id: "r-1",
    title: "How to choose your next performance outfit",
    subtitle: "Guide · 4 min read",
    href: "/blog/how-to-choose-your-next-performance-outfit",
  },
  {
    type: "post",
    id: "r-2",
    title: "Shipping policy explained",
    subtitle: "Guide · 4 min read",
    href: "/blog/shipping-policy-explained",
  },
  {
    type: "post",
    id: "post-nebula",
    title: "Behind the design of the Nebula collection",
    subtitle: "Behind the Scenes · 6 min read",
    href: "/blog/behind-the-design-of-the-nebula-collection",
  },
];

function matchResults(query: string): SearchResultItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return SEARCH_INDEX.filter(
    (item) => item.title.toLowerCase().includes(needle) || item.subtitle.toLowerCase().includes(needle),
  ).slice(0, 5);
}

export type SearchAutocompleteProps = {
  /** Wrapper className — controls responsive visibility/sizing from the call site. */
  className?: string;
  placeholder?: string;
  /** Stretches the input/panel to the parent's full width and centers the placeholder —
   * used inside the mobile drawer, mirroring `LanguageSwitcher`/`CurrencySwitcher`'s
   * own `fullWidth` convention. */
  fullWidth?: boolean;
  /** Called after a result is picked (e.g. to close the mobile drawer on navigation). */
  onNavigate?: () => void;
  search?: (query: string) => Promise<SearchResultItem[]>;
};

export function SearchAutocomplete({
  className = "",
  placeholder = "Search products, categories, tags...",
  fullWidth = false,
  onNavigate,
  search,
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [remoteResults, setRemoteResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsFocused(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!search || query.trim().length < 2) {
      setRemoteResults([]);
      setIsLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setError("");
      search(query.trim())
        .then((results) => {
          if (!controller.signal.aborted) setRemoteResults(results.slice(0, 6));
        })
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) {
            setRemoteResults([]);
            setError(searchError instanceof Error ? searchError.message : "Search is unavailable");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, search]);

  const results = search ? remoteResults : matchResults(query);
  const isOpen = isFocused && query.trim().length > 0;

  return (
    <div ref={containerRef} className={`funky-search-autocomplete relative ${fullWidth ? "w-full" : ""} ${className}`}>
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="header-search-results"
          aria-autocomplete="list"
          className="w-full rounded-2xl border border-zinc-200 bg-zinc-100/70 py-2.5 pl-11 pr-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:bg-zinc-900 dark:focus:ring-brand-400"
        />
      </label>

      {isOpen ? (
        <ul
          id="header-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 z-50 mt-2 grid gap-0.5 rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {isLoading ? (
            <li className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">Searching WordPress…</li>
          ) : error ? (
            <li role="alert" className="px-3 py-4 text-center text-sm text-red-600 dark:text-red-400">{error}</li>
          ) : results.length ? (
            results.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <Link
                  to={item.href}
                  role="option"
                  onClick={() => {
                    setQuery("");
                    setIsFocused(false);
                    onNavigate?.();
                  }}
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-left no-underline transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-500">
                    <SearchResultIcon type={item.type} />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</span>
                    <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{item.subtitle}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {searchResultTypeLabel(item.type)}
                  </span>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">No results for &ldquo;{query.trim()}&rdquo;</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

function SearchResultIcon({ type }: { type: SearchResultItem["type"] }) {
  const Icon = type === "product"
    ? Package
    : type === "page"
      ? LayoutTemplate
      : type === "category"
        ? FolderTree
        : type === "tag"
          ? Tags
          : FileText;
  return <Icon className="h-4 w-4" aria-hidden="true" />;
}

function searchResultTypeLabel(type: SearchResultItem["type"]): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
