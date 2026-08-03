import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ProductCardData, PostCardData } from "@funky/ui";

/**
 * Persisted store for the two "edge social" flows from the product spec: a community
 * member with `role: "creator"` listing a product or publishing an article under their
 * own profile, plus the plain "share a post" upload every member can do. This is the
 * mockup-only stand-in for the real backend mutations (`createSocialPost`,
 * `createProduct` with a `vendor` field, `createPost` authored by a customer account —
 * see `socialShared.tsx`'s header comment for the full mapping) — everything here lives
 * in localStorage so the whole flow (form → shows up in the profile/dashboard/feed →
 * has its own page → is commentable) actually works end to end without a server.
 *
 * Static demo content (`CREATOR_PRODUCTS`/`CREATOR_ARTICLES`/`SOCIAL_POSTS` in
 * `socialShared.tsx`) always renders first; anything added here is appended after it,
 * per author handle.
 */

export type CreatorProductInput = {
  name: string;
  subtitle?: string;
  category: string;
  priceLabel: string;
  compareAtPriceLabel?: string;
  imageUrl?: string;
  badge?: string;
};

export type CreatorArticleInput = {
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  imageUrl?: string;
  /** Plain paragraphs, split on blank lines when rendered. */
  body: string;
};

export type CreatorPostInput = {
  imageUrl: string;
  caption: string;
  tags: string[];
};

export type StoredCreatorProduct = ProductCardData & { vendorHandle: string; createdAt: string };
export type StoredCreatorArticle = PostCardData & { vendorHandle: string; body: string; createdAt: string };
export type StoredCreatorPost = {
  id: string;
  authorHandle: string;
  image: string;
  aspect: string;
  caption: string;
  tags: string[];
  likes: number;
  comments: number;
  createdAt: string;
};

type PersistedShape = {
  products: StoredCreatorProduct[];
  articles: StoredCreatorArticle[];
  posts: StoredCreatorPost[];
};

export type CreatorContentValue = PersistedShape & {
  addProduct: (handle: string, input: CreatorProductInput) => void;
  addArticle: (handle: string, input: CreatorArticleInput) => void;
  addPost: (handle: string, input: CreatorPostInput) => void;
  removeProduct: (id: string) => void;
  removeArticle: (id: string) => void;
  removePost: (id: string) => void;
};

const STORAGE_KEY = "funkycommerce-mockup-creator-content-v1";
const EMPTY: PersistedShape = { products: [], articles: [], posts: [] };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const CreatorContentContext = createContext<CreatorContentValue | undefined>(undefined);

export function CreatorContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedShape>(EMPTY);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.articles) && Array.isArray(parsed.posts)) {
          setState(parsed);
        }
      }
    } catch {
      // Ignore malformed/unavailable storage and fall back to empty collections.
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, isHydrated]);

  const value: CreatorContentValue = {
    ...state,
    addProduct: (handle, input) => {
      const product: StoredCreatorProduct = {
        id: uid("cp-user"),
        vendorHandle: handle,
        createdAt: new Date().toISOString(),
        name: input.name,
        subtitle: input.subtitle,
        category: input.category,
        priceLabel: input.priceLabel,
        compareAtPriceLabel: input.compareAtPriceLabel,
        imageUrl: input.imageUrl,
        badge: input.badge,
        isNew: true,
      };
      setState((previous) => ({ ...previous, products: [product, ...previous.products] }));
    },
    addArticle: (handle, input) => {
      const slug = `${slugify(input.title)}-${Date.now().toString(36)}`;
      const wordCount = input.body.trim().split(/\s+/).filter(Boolean).length;
      const article: StoredCreatorArticle = {
        id: uid("ca-user"),
        vendorHandle: handle,
        createdAt: new Date().toISOString(),
        slug,
        title: input.title,
        excerpt: input.excerpt,
        imageUrl: input.imageUrl,
        date: new Date().toISOString().slice(0, 10),
        author: { name: handle },
        wordCount,
        categories: input.category ? [{ name: input.category, slug: slugify(input.category) }] : [],
        tags: input.tags.map((tag) => ({ name: tag, slug: slugify(tag) })),
        href: `/community/${handle}/articles/${slug}`,
        body: input.body,
      };
      setState((previous) => ({ ...previous, articles: [article, ...previous.articles] }));
    },
    addPost: (handle, input) => {
      const post: StoredCreatorPost = {
        id: uid("sp-user"),
        authorHandle: handle,
        image: input.imageUrl,
        aspect: "4/5",
        caption: input.caption,
        tags: input.tags,
        likes: 0,
        comments: 0,
        createdAt: new Date().toISOString(),
      };
      setState((previous) => ({ ...previous, posts: [post, ...previous.posts] }));
    },
    removeProduct: (id) => setState((previous) => ({ ...previous, products: previous.products.filter((item) => item.id !== id) })),
    removeArticle: (id) => setState((previous) => ({ ...previous, articles: previous.articles.filter((item) => item.id !== id) })),
    removePost: (id) => setState((previous) => ({ ...previous, posts: previous.posts.filter((item) => item.id !== id) })),
  };

  return <CreatorContentContext.Provider value={value}>{children}</CreatorContentContext.Provider>;
}

export function useCreatorContent(): CreatorContentValue {
  const context = useContext(CreatorContentContext);
  if (!context) throw new Error("useCreatorContent must be used within a CreatorContentProvider");
  return context;
}
