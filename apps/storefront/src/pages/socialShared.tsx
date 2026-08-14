/**
 * Mock data for the community social feed (Pinterest/Instagram-style user-generated
 * board — see `CommunityFeedMockupPage`/`CommunityProfileMockupPage`). This is a
 * mockup-only stand-in for the eventual WordPress custom post type (one post per
 * upload, authored by a customer account rather than a staff `Author`) exposed over
 * GraphQL: fetching the feed becomes a paginated posts-by-type query, and uploading
 * becomes a `createSocialPost` mutation carrying the image, caption, and tags —
 * `UploadPostModal` documents the expected shape in its own header comment.
 *
 * Also mocks the planned **creator/marketplace** tier: an account can be promoted to
 * `role: "creator"` (a future WP capability, e.g. `edit_products`/`publish_posts`
 * granted to a customer role rather than staff) which unlocks listing products and
 * writing articles under their own profile — see `CREATOR_PRODUCTS`/`CREATOR_ARTICLES`
 * and the "Shop"/"Articles" tabs on `CommunityProfileMockupPage`. In the real backend
 * this turns the storefront into a lightweight multi-vendor marketplace: products stay
 * regular WooCommerce products (queried the same way as `MOCK_PRODUCTS`) but gain an
 * `author`/`vendor` field, and articles are ordinary WP posts authored by that
 * customer account instead of a staff `Author`.
 */

import type { ProductCardData, PostCardData, SocialPostMedia } from "@funky/ui";
import type { ProductReview } from "./shared";

export type SocialUser = {
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio: string;
  followers: number;
  following: number;
  /** Public profiles list their feed on the community-wide feed and their own profile
   * page; private profiles only ever show their feed to themselves (mirrors an
   * Instagram-style private-account switch, toggled from Account → Community). */
  isPublic: boolean;
  /** Defaults to a standard member when omitted. `"creator"` unlocks the Shop/Articles
   * tabs on this user's profile — mirrors a WP role/capability upgrade that would, in
   * the real backend, be granted by staff rather than self-served. */
  role?: "creator";
};

export type SocialPost = {
  id: string;
  authorHandle: string;
  image: string;
  title?: string;
  description?: string;
  media?: SocialPostMedia[];
  /** CSS aspect-ratio value (e.g. `"4/5"`) — the source image is pre-cropped to match,
   * so masonry layout (which renders images at their intrinsic size, uncropped) never
   * letterboxes or distorts. */
  aspect: string;
  caption: string;
  tags: string[];
  likes: number;
  comments: number;
  createdAt: string;
};

/** The account currently "logged in" for this mockup — matches the Account page's
 * hard-coded "Jordan Doe" dashboard identity, so `/community/jordandoe` can render as
 * an own-profile view (upload entry point, privacy switch reflected, etc.). */
export const CURRENT_SOCIAL_USER_HANDLE = "jordandoe";

export const SOCIAL_USERS: SocialUser[] = [
  {
    handle: "jordandoe",
    displayName: "Jordan Doe",
    bio: "Sneakerhead and weekend hiker, always looking for the next great hoodie.",
    followers: 482,
    following: 210,
    isPublic: true,
    role: "creator",
  },
  {
    handle: "mina.k",
    displayName: "Mina Kowalski",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&h=200&q=80",
    bio: "Thrifted layers and color-blocking. Based in Warsaw, styling year-round.",
    followers: 1204,
    following: 356,
    isPublic: true,
  },
  {
    handle: "theo.wanders",
    displayName: "Theo Novak",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&h=200&q=80",
    bio: "Trail-to-street fits. If it survives a hike, it makes the feed.",
    followers: 876,
    following: 142,
    isPublic: true,
  },
  {
    handle: "sara.styles",
    displayName: "Sara Bianchi",
    avatarUrl: "https://images.unsplash.com/photo-1499887142886-791eca5918cd?auto=format&fit=crop&w=200&h=200&q=80",
    bio: "Minimalist wardrobe, maximalist accessories. Milan-based stylist.",
    followers: 2310,
    following: 98,
    isPublic: true,
    role: "creator",
  },
  {
    handle: "kenji.folds",
    displayName: "Kenji Sato",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80",
    bio: "Unboxings, restocks, and the occasional fit check. Tokyo.",
    followers: 3021,
    following: 64,
    isPublic: true,
  },
  {
    handle: "ruth.thread",
    displayName: "Ruth Okafor",
    avatarUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=200&h=200&q=80",
    bio: "Behind-the-seams shots of every alteration I make. Lagos.",
    followers: 654,
    following: 210,
    isPublic: true,
    role: "creator",
  },
  {
    handle: "davidloops",
    displayName: "David Kim",
    avatarUrl: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=200&h=200&q=80",
    bio: "Private board — approved followers only.",
    followers: 58,
    following: 41,
    isPublic: false,
  },
];

export function getSocialUserByHandle(handle: string): SocialUser | undefined {
  return SOCIAL_USERS.find((user) => user.handle === handle);
}

export const SOCIAL_POSTS: SocialPost[] = [
  {
    id: "sp-1",
    authorHandle: "mina.k",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Layering the Nebula hoodie under a raw-denim jacket for the first cold snap of the season.",
    tags: ["layering", "hoodie-season", "ootd"],
    likes: 342,
    comments: 28,
    createdAt: "2026-07-27T09:15:00Z",
  },
  {
    id: "sp-2",
    authorHandle: "theo.wanders",
    image: "https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=800&h=800&q=80",
    aspect: "1/1",
    caption: "Trailhead fit check before the sunrise loop — everything held up past mile 8.",
    tags: ["streetwear", "sneakers", "ootd"],
    likes: 511,
    comments: 41,
    createdAt: "2026-07-26T06:40:00Z",
  },
  {
    id: "sp-3",
    authorHandle: "sara.styles",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&h=1067&q=80",
    aspect: "3/4",
    caption: "Minimal base, one statement accessory. The Orbit crossbody carries the whole look.",
    tags: ["minimalist", "accessories", "color-story"],
    likes: 289,
    comments: 19,
    createdAt: "2026-07-25T14:05:00Z",
  },
  {
    id: "sp-4",
    authorHandle: "kenji.folds",
    image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&h=600&q=80",
    aspect: "4/3",
    caption: "Restock day. Flux Sneakers box art is genuinely too good to recycle.",
    tags: ["unboxing", "sneakers"],
    likes: 764,
    comments: 63,
    createdAt: "2026-07-25T11:20:00Z",
  },
  {
    id: "sp-5",
    authorHandle: "ruth.thread",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Took the Mono Cap apart to reinforce the brim stitch — small fix, huge difference.",
    tags: ["behind-the-seams", "thrift-flip"],
    likes: 198,
    comments: 34,
    createdAt: "2026-07-24T17:50:00Z",
  },
  {
    id: "sp-6",
    authorHandle: "jordandoe",
    image: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&h=1422&q=80",
    aspect: "9/16",
    caption: "Weekend hike fit — Nebula Hoodie handled the wind better than expected.",
    tags: ["ootd", "hoodie-season", "layering"],
    likes: 156,
    comments: 12,
    createdAt: "2026-07-24T08:10:00Z",
  },
  {
    id: "sp-7",
    authorHandle: "mina.k",
    image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=800&h=450&q=80",
    aspect: "16/9",
    caption: "Studio wall of everything I'm styling this week — color-blocking mood board.",
    tags: ["studio-tour", "color-story"],
    likes: 421,
    comments: 22,
    createdAt: "2026-07-23T13:00:00Z",
  },
  {
    id: "sp-8",
    authorHandle: "theo.wanders",
    image: "https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Thrifted this shell jacket for €12 and gave it a new zipper pull.",
    tags: ["thrift-flip", "streetwear"],
    likes: 233,
    comments: 17,
    createdAt: "2026-07-23T09:35:00Z",
  },
  {
    id: "sp-9",
    authorHandle: "sara.styles",
    image: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?auto=format&fit=crop&w=800&h=800&q=80",
    aspect: "1/1",
    caption: "Accessory drawer reset — every piece earns its spot or it goes.",
    tags: ["accessories", "minimalist"],
    likes: 302,
    comments: 26,
    createdAt: "2026-07-22T16:45:00Z",
  },
  {
    id: "sp-10",
    authorHandle: "kenji.folds",
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&h=1067&q=80",
    aspect: "3/4",
    caption: "Full fit breakdown from today's pickup — tagged everything below.",
    tags: ["ootd", "sneakers", "streetwear"],
    likes: 588,
    comments: 47,
    createdAt: "2026-07-22T10:15:00Z",
  },
  {
    id: "sp-11",
    authorHandle: "ruth.thread",
    image: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&h=600&q=80",
    aspect: "4/3",
    caption: "Seam-ripping an old jacket down to pattern pieces for a custom fit.",
    tags: ["behind-the-seams", "thrift-flip"],
    likes: 176,
    comments: 15,
    createdAt: "2026-07-21T18:30:00Z",
  },
  {
    id: "sp-12",
    authorHandle: "jordandoe",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Cap and crossbody combo for a rainy commute — kept everything dry.",
    tags: ["accessories", "ootd"],
    likes: 132,
    comments: 9,
    createdAt: "2026-07-21T07:55:00Z",
  },
  {
    id: "sp-13",
    authorHandle: "mina.k",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Color-story of the week: rust, cream, and one loud teal accessory.",
    tags: ["color-story", "minimalist"],
    likes: 267,
    comments: 20,
    createdAt: "2026-07-20T15:10:00Z",
  },
  {
    id: "sp-14",
    authorHandle: "theo.wanders",
    image: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&h=800&q=80",
    aspect: "1/1",
    caption: "Post-trail cooldown fit, straight off the summit.",
    tags: ["ootd", "streetwear"],
    likes: 349,
    comments: 31,
    createdAt: "2026-07-20T06:20:00Z",
  },
  {
    id: "sp-15",
    authorHandle: "kenji.folds",
    image: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=800&h=450&q=80",
    aspect: "16/9",
    caption: "Shelf update — new arrivals lined up by colorway, obviously.",
    tags: ["unboxing", "studio-tour"],
    likes: 445,
    comments: 39,
    createdAt: "2026-07-19T12:00:00Z",
  },
  {
    id: "sp-16",
    authorHandle: "sara.styles",
    image: "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?auto=format&fit=crop&w=800&h=1067&q=80",
    aspect: "3/4",
    caption: "One coat, four ways to style it this month.",
    tags: ["minimalist", "layering"],
    likes: 398,
    comments: 33,
    createdAt: "2026-07-18T14:40:00Z",
  },
  {
    id: "sp-17",
    authorHandle: "ruth.thread",
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Reinforced the crossbody strap stitching — should outlast the bag itself now.",
    tags: ["behind-the-seams", "accessories"],
    likes: 154,
    comments: 11,
    createdAt: "2026-07-18T09:05:00Z",
  },
  {
    id: "sp-18",
    authorHandle: "jordandoe",
    image: "https://images.unsplash.com/photo-1552902019-ebcd97aa9aa0?auto=format&fit=crop&w=800&h=800&q=80",
    aspect: "1/1",
    caption: "Everyday carry, laid out flat — sneakers, cap, hoodie.",
    tags: ["ootd", "sneakers"],
    likes: 121,
    comments: 8,
    createdAt: "2026-07-17T19:25:00Z",
  },
  {
    id: "sp-19",
    authorHandle: "mina.k",
    image: "https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=800&h=600&q=80",
    aspect: "4/3",
    caption: "Thrifted this coat for a steal — new buttons and it's a whole new piece.",
    tags: ["thrift-flip", "color-story"],
    likes: 289,
    comments: 24,
    createdAt: "2026-07-17T11:15:00Z",
  },
  {
    id: "sp-20",
    authorHandle: "theo.wanders",
    image: "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=800&h=1422&q=80",
    aspect: "9/16",
    caption: "Full-length fit from the ridge line — wind layer over the hoodie was clutch.",
    tags: ["hoodie-season", "layering", "ootd"],
    likes: 512,
    comments: 45,
    createdAt: "2026-07-16T08:45:00Z",
  },
  {
    id: "sp-21",
    authorHandle: "kenji.folds",
    image: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Sneaker rotation for the month, ranked worst to best (fight me).",
    tags: ["sneakers", "unboxing"],
    likes: 673,
    comments: 58,
    createdAt: "2026-07-15T17:30:00Z",
  },
  {
    id: "sp-22",
    authorHandle: "sara.styles",
    image: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&h=800&q=80",
    aspect: "1/1",
    caption: "Simple palette, three textures — wool, canvas, leather.",
    tags: ["minimalist", "color-story"],
    likes: 356,
    comments: 27,
    createdAt: "2026-07-15T10:10:00Z",
  },
  {
    id: "sp-23",
    authorHandle: "ruth.thread",
    image: "https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?auto=format&fit=crop&w=800&h=1067&q=80",
    aspect: "3/4",
    caption: "Started a new alterations project — before shot, will post the reveal soon.",
    tags: ["behind-the-seams", "studio-tour"],
    likes: 143,
    comments: 10,
    createdAt: "2026-07-14T16:00:00Z",
  },
  {
    id: "sp-24",
    authorHandle: "jordandoe",
    image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Cold-weather layering test, three pieces deep and still moved fine on the trail.",
    tags: ["layering", "hoodie-season"],
    likes: 187,
    comments: 14,
    createdAt: "2026-07-14T07:20:00Z",
  },
  {
    id: "sp-25",
    authorHandle: "mina.k",
    image: "https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Accessory-first outfit planning — starting from the bag this time.",
    tags: ["accessories", "color-story", "ootd"],
    likes: 231,
    comments: 18,
    createdAt: "2026-07-13T13:50:00Z",
  },
  {
    id: "sp-26",
    authorHandle: "davidloops",
    image: "https://images.unsplash.com/photo-1520975954732-35dd22299614?auto=format&fit=crop&w=800&h=1000&q=80",
    aspect: "4/5",
    caption: "Private test post — only approved followers can see this one.",
    tags: ["ootd"],
    likes: 12,
    comments: 2,
    createdAt: "2026-07-12T10:00:00Z",
  },
];

export const ALL_SOCIAL_TAGS: string[] = Array.from(new Set(SOCIAL_POSTS.flatMap((post) => post.tags))).sort();

/** Every post from public profiles, newest first — the source for the community-wide
 * feed. Private users' uploads are intentionally excluded here (they only ever appear
 * on that user's own profile, and only to that user in this mockup). Kept as a plain
 * constant (no locally-saved posts merged in) for callers that only need the static
 * demo set — see `getPublicSocialPosts` for the version merged with `useCreatorContent`'s
 * localStorage-backed uploads. */
export const PUBLIC_SOCIAL_POSTS: SocialPost[] = SOCIAL_POSTS.filter((post) => getSocialUserByHandle(post.authorHandle)?.isPublic).sort(
  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
);

/** Same as `PUBLIC_SOCIAL_POSTS`, but also merges in posts a member has shared through
 * `UploadPostModal` this session (persisted via `useCreatorContent().posts`) — pass
 * that array in from the calling component so this file stays free of a direct React
 * context dependency. */
export function getPublicSocialPosts(userPosts: SocialPost[] = []): SocialPost[] {
  return [...SOCIAL_POSTS, ...userPosts]
    .filter((post) => getSocialUserByHandle(post.authorHandle)?.isPublic)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getPostsByHandle(handle: string, userPosts: SocialPost[] = []): SocialPost[] {
  return [...SOCIAL_POSTS, ...userPosts]
    .filter((post) => post.authorHandle === handle)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function isCreatorHandle(handle: string): boolean {
  return getSocialUserByHandle(handle)?.role === "creator";
}

/** Products a creator lists under their own profile — same `ProductCardData` shape the
 * rest of the shop uses (`/shop/:slug` links keep working unchanged), just grouped by
 * the creator's handle instead of living in one global catalog. In the real backend
 * these are ordinary WooCommerce products with an added `vendor`/`author` field. */
export const CREATOR_PRODUCTS: Record<string, ProductCardData[]> = {
  "ruth.thread": [
    {
      id: "cp-ruth-1",
      name: "Hand-Stitched Crossbody",
      subtitle: "Full-grain leather, made to order",
      category: "Accessories",
      imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80",
      priceLabel: "€128.00",
      rating: 5,
      reviewCount: 19,
      badge: "Handmade",
      isNew: true,
    },
    {
      id: "cp-ruth-2",
      name: "Reinforced Tote",
      subtitle: "Canvas body, leather straps",
      category: "Accessories",
      imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80",
      priceLabel: "€96.00",
      rating: 4.9,
      reviewCount: 12,
    },
  ],
  "sara.styles": [
    {
      id: "cp-sara-1",
      name: "Milan Capsule Scarf",
      subtitle: "Hand-rolled edges, merino wool",
      category: "Accessories",
      imageUrl: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=800&q=80",
      priceLabel: "€64.00",
      rating: 4.8,
      reviewCount: 31,
      badge: "Creator pick",
    },
  ],
  jordandoe: [
    {
      id: "cp-jordan-1",
      name: "Trail Mix Enamel Pin Set",
      subtitle: "Set of 3, hiking-trip inspired",
      category: "Accessories",
      imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80",
      priceLabel: "€18.00",
      rating: 4.7,
      reviewCount: 6,
      isNew: true,
    },
  ],
};

/** Articles a creator writes under their own profile — same `PostCardData` shape as
 * the main blog (`author.slug` is intentionally omitted so the byline renders as plain
 * text instead of linking into the staff `/blog/author/:slug` archive, which doesn't
 * index customer accounts). In the real backend these are ordinary WP posts authored
 * by the customer's user account rather than a staff `Author`. */
export type CreatorArticleData = PostCardData & { body?: string };

export const CREATOR_ARTICLES: Record<string, CreatorArticleData[]> = {
  "ruth.thread": [
    {
      id: "ca-ruth-1",
      slug: "reinforcing-a-crossbody-strap-the-slow-way",
      href: "/community/ruth.thread/articles/reinforcing-a-crossbody-strap-the-slow-way",
      title: "Reinforcing a crossbody strap the slow way",
      excerpt: "Why I triple-stitch every strap seam by hand, and what it costs in time versus a machine bar-tack.",
      imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=80",
      date: "2026-07-19",
      author: { name: "Ruth Okafor" },
      wordCount: 410,
      readingTimeMinutes: 3,
      categories: [{ name: "Maker Notes", slug: "maker-notes" }],
      tags: [{ name: "Leatherwork", slug: "leatherwork" }],
      body: "Every crossbody strap that leaves my workbench gets the same treatment: three passes of waxed thread, hand-stitched, before it ever sees a bar-tack machine.\n\nIt's slower — a single strap can take the better part of an hour once you count marking, awl work, and pulling every stitch tight enough to bite into the leather. A machine bar-tack does the same job in about four seconds.\n\nBut hand stitching fails gracefully. If one stitch eventually wears through, the row next to it is still holding — the seam degrades a thread at a time instead of popping open on a crowded train platform. A machine bar-tack is a single lockstitch: cut through the wrong loop and the whole tack lets go at once.\n\nFor a bag that's going to ride against someone's hip for years, that difference is the whole point.",
    },
  ],
  "sara.styles": [
    {
      id: "ca-sara-1",
      title: "Building a five-piece capsule for Milan winters",
      slug: "building-a-five-piece-capsule-for-milan-winters",
      href: "/community/sara.styles/articles/building-a-five-piece-capsule-for-milan-winters",
      excerpt: "The exact five pieces I rotate from November through February, and why each one earns its spot.",
      imageUrl: "https://images.unsplash.com/photo-1499887142886-791eca5918cd?auto=format&fit=crop&w=1200&q=80",
      date: "2026-07-05",
      author: { name: "Sara Bianchi" },
      wordCount: 560,
      readingTimeMinutes: 4,
      categories: [{ name: "Style Guides", slug: "style-guides" }],
      tags: [{ name: "Capsule Wardrobe", slug: "capsule-wardrobe" }],
      body: "Milan winters are damp more often than they're cold, which changes what actually earns a spot in a five-piece capsule.\n\nThe Nebula Hoodie is piece one — heavyweight enough to be the only mid-layer I need under a shell, and it doesn't pill after a season of being stuffed in a bag between meetings.\n\nPiece two is a raw-denim jacket, worn open over almost everything else here. It's the one item that makes four base pieces read as different outfits depending on what's underneath it.\n\nThe Orbit Crossbody carries everything I need without ever needing a second bag, and its waterproof shell means I stop checking the forecast before I leave the apartment.\n\nFlux Sneakers round it out on the days I'm walking more than riding — grippy enough for the cobblestones near the Duomo without looking like a hiking boot.\n\nFive pieces, worn on rotation, is genuinely enough. The trick is picking pieces that layer well with each other rather than chasing five separate 'looks.'",
    },
  ],
};

export function getCreatorProducts(handle: string, userProducts: ProductCardData[] = []): ProductCardData[] {
  return [...(CREATOR_PRODUCTS[handle] ?? []), ...userProducts];
}

export function getCreatorArticles(handle: string, userArticles: CreatorArticleData[] = []): CreatorArticleData[] {
  return [...(CREATOR_ARTICLES[handle] ?? []), ...userArticles];
}

/** Looks up a single creator article by handle + slug — used by the article detail
 * page (`/community/:handle/articles/:slug`). Searches both the static demo articles
 * and anything the member has published this session via `useCreatorContent().articles`. */
export function getCreatorArticleBySlug(handle: string, slug: string, userArticles: CreatorArticleData[] = []): CreatorArticleData | undefined {
  return getCreatorArticles(handle, userArticles).find((article) => article.slug === slug);
}

export function getSocialPostById(id: string, userPosts: SocialPost[] = []): SocialPost | undefined {
  return [...SOCIAL_POSTS, ...userPosts].find((post) => post.id === id);
}

/**
 * Mock discussion threads for the community post detail page (`/community/post/:id`),
 * keyed by post id — reuses `ProductReview`'s shape (and `CommentThread.tsx`'s
 * `CommentsSection`/`ReviewThread` components wholesale) since a community post's
 * comments are, structurally, the exact same WordPress-comment entity as a product
 * review or blog comment, just without a star rating. Posts not listed here simply
 * render with zero starting comments (still fully commentable).
 */
export const SOCIAL_POST_COMMENTS: Record<string, ProductReview[]> = {
  "sp-1": [
    { id: "spc-1-1", author: "Priya N.", date: "2026-07-27", content: "That raw-denim jacket over the hoodie is such a clean combo — stealing this for next week." },
    { id: "spc-1-2", author: "Jordan Doe", date: "2026-07-27", content: "Agreed, the color pairing works way better than I expected!", parentId: "spc-1-1" },
    { id: "spc-1-3", author: "Marcus T.", date: "2026-07-28", content: "How's the Nebula hoodie holding up wash after wash? Thinking of grabbing one." },
  ],
  "sp-2": [
    { id: "spc-2-1", author: "Elin S.", date: "2026-07-26", content: "Mile 8 and still looking fresh, respect. What sneakers are those?" },
    { id: "spc-2-2", author: "Theo Novak", date: "2026-07-26", content: "Flux Sneakers — surprisingly grippy on loose gravel too.", parentId: "spc-2-1" },
  ],
  "sp-3": [
    { id: "spc-3-1", author: "Noah B.", date: "2026-07-25", content: "The Orbit crossbody really does all the heavy lifting here. Great restraint on the rest of the fit." },
  ],
  "sp-4": [
    { id: "spc-4-1", author: "Ayaan R.", date: "2026-07-25", content: "That box art alone deserves a frame, honestly." },
    { id: "spc-4-2", author: "Kenji Sato", date: "2026-07-25", content: "Right?? I can never bring myself to recycle these.", parentId: "spc-4-1" },
    { id: "spc-4-3", author: "Lucia M.", date: "2026-07-26", content: "Restock notification when?? Missed the last drop." },
  ],
  "sp-17": [
    { id: "spc-17-1", author: "Femi A.", date: "2026-07-18", content: "This is such a good tip — do you double up the thread on the bar-tack too?" },
    { id: "spc-17-2", author: "Ruth Okafor", date: "2026-07-18", content: "Always — a single line never survives daily crossbody use.", parentId: "spc-17-1" },
  ],
  "sp-6": [
    { id: "spc-6-1", author: "Sam K.", date: "2026-07-24", content: "Didn't expect a hoodie to cut wind that well up there, nice find." },
  ],
};

export function getPostComments(postId: string): ProductReview[] {
  return SOCIAL_POST_COMMENTS[postId] ?? [];
}

/** A community member's rating/review of a purchased product — distinct from
 * `SOCIAL_POST_COMMENTS` (those are replies on a social post; these are proper
 * star-rated product reviews, just surfaced on the community page attributed to a
 * member's handle instead of shown only on the PDP). In the real backend this is the
 * same WooCommerce product-review comment, just queried by author instead of by
 * product for this section. */
export type CommunityReview = {
  id: string;
  reviewerHandle: string;
  productName: string;
  rating: number;
  content: string;
  date: string;
};

export const COMMUNITY_REVIEWS: CommunityReview[] = [
  {
    id: "cr-1",
    reviewerHandle: "mina.k",
    productName: "Nebula Hoodie",
    rating: 5,
    content: "Wore this through an entire Warsaw winter and the color still looks new. The heavyweight cotton is worth every euro.",
    date: "2026-07-22",
  },
  {
    id: "cr-2",
    reviewerHandle: "theo.wanders",
    productName: "Flux Sneakers",
    rating: 4,
    content: "Grippy enough for loose gravel on trail-to-street days, just wish they came in a wider fit.",
    date: "2026-07-20",
  },
  {
    id: "cr-3",
    reviewerHandle: "sara.styles",
    productName: "Orbit Crossbody Bag",
    rating: 5,
    content: "The waterproof shell has saved this bag through two surprise Milan downpours already. Genuinely obsessed.",
    date: "2026-07-17",
  },
  {
    id: "cr-4",
    reviewerHandle: "kenji.folds",
    productName: "Nebula Hoodie",
    rating: 5,
    content: "Restocked mine the day it sold out last time — this is the one hoodie I never rotate out of the drawer.",
    date: "2026-07-14",
  },
  {
    id: "cr-5",
    reviewerHandle: "ruth.thread",
    productName: "Reinforced Tote",
    rating: 4,
    content: "As someone who sews bag straps for a living, I can confirm this canvas + leather combo is built to actually last.",
    date: "2026-07-10",
  },
  {
    id: "cr-6",
    reviewerHandle: "jordandoe",
    productName: "Trail Mix Enamel Pin Set",
    rating: 5,
    content: "Made a set just like this for my own hiking trips — pairs great with a jacket full of patches.",
    date: "2026-07-06",
  },
];
