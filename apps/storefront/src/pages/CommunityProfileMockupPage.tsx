import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Lock,
  PenSquare,
  PlusCircle,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
} from "lucide-react";
import {
  ListProductModal,
  PaginableProductGrid,
  PaginablePostGrid,
  ProfileHeader,
  ProfileStat,
  ResponsiveImage,
  SocialFeedGrid,
  UploadPostModal,
  WriteArticleModal,
  avatarColorFor,
  useCurrency,
  useLanguage,
  useLayoutPreferences,
  useT,
  useToast,
  type ListProductInitialValues,
  type SocialPostCardData,
  type WriteArticleInitialValues,
} from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import {
  createCollaboratorPost,
  createCommunityPost,
  createMarketplaceProduct,
  deleteCollaboratorPost,
  followCommunityProfile,
  getCommunityProfile,
  getCommunityProfileMember,
  getCommunityProfileConnection,
  getCollaboratorPostForEditing,
  getMarketplaceProductForEditing,
  searchTranslationCandidateCommunityPosts,
  searchTranslationCandidatePosts,
  toggleCommunityPostLike,
  unfollowCommunityProfile,
  updateCollaboratorPost,
  updateMarketplaceProduct,
  type CommunityProfileConnection,
  type CommunityProfileData,
  type CommunityMember,
} from "../lib/community";
import { useCommunityData } from "../state/communityData";
import { useBlogData } from "../state/blogData";
import { NotFoundMockupPage } from "./NotFoundMockupPage";
import { useCreatorContent } from "../state/creatorContent";
import { isBackendConfigured } from "@funky/sdk";
import { communityHandlesMatch, resolvePublicCommunityMember } from "../lib/communityProfiles";
import { resolveMarketplaceMutationPrice } from "../lib/marketplaceProductPricing";
import {
  getCreatorArticles,
  getCreatorProducts,
  getPostsByHandle,
  getSocialUserByHandle,
} from "./socialShared";

type ProfileTab = "posts" | "shop" | "articles" | "followers" | "following";

/**
 * A single community member's public profile — mirrors `AuthorMockupPage`'s bio-hero
 * structure (avatar, name, bio, stats) but for a customer account rather than a staff
 * `Author`, and swaps the paginated post list for a `SocialFeedGrid` of that user's
 * own uploads. Private profiles (`isPublic: false`) show a locked notice instead of
 * the feed — unless you're viewing your own profile, matching Instagram's behaviour.
 */
export function CommunityProfileMockupPage() {
  const t = useT();
  const { handle = "" } = useParams();
  const { data: liveCommunity, viewer, refresh, isLoading, isRevalidating, error } = useCommunityData();
  const fallbackUser = isBackendConfigured ? null : getSocialUserByHandle(handle);
  const { data: liveBlog } = useBlogData();
  const { communityProfileHeaderLayout: headerLayout } = useLayoutPreferences();
  const { configuredLanguageCodes, languageCode } = useLanguage();
  const filterByLanguage = configuredLanguageCodes.length > 1;
  const { baseCurrency, convertSelectedToBase } = useCurrency();
  const [profileData, setProfileData] = useState<CommunityProfileData | null>(null);
  const [profileMember, setProfileMember] = useState<CommunityMember | null>(null);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(isBackendConfigured);
  useEffect(() => {
    if (!isBackendConfigured) return;
    let active = true;
    setProfileMember((current) =>
      current && communityHandlesMatch(handle, current.handle) ? current : null,
    );
    getCommunityProfileMember(handle)
      .then((member) => {
        if (active) setProfileMember(member);
      })
      .catch(() => {
        if (active) setProfileMember(null);
      });
    return () => {
      active = false;
    };
  }, [handle, viewer?.databaseId, liveCommunity]);
  useEffect(() => {
    if (!isBackendConfigured) return;
    let active = true;
    setProfileData((current) =>
      current && communityHandlesMatch(handle, current.member.handle) ? current : null,
    );
    setIsProfileLoading(true);
    setProfileError(null);
    getCommunityProfile(handle, languageCode)
      .then((profile) => {
        if (active) setProfileData(profile);
      })
      .catch((reason) => {
        if (active) {
          setProfileData(null);
          setProfileError(reason instanceof Error ? reason : new Error("Could not load community profile"));
        }
      })
      .finally(() => {
        if (active) setIsProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [handle, languageCode, viewer?.databaseId, liveCommunity]);
  const currentProfileData = profileData && communityHandlesMatch(handle, profileData.member.handle) ? profileData : null;
  const authoritativeMember = currentProfileData?.member
    || (profileMember && communityHandlesMatch(handle, profileMember.handle) ? profileMember : null);
  const liveMember = authoritativeMember || (liveCommunity
    ? resolvePublicCommunityMember(
        liveCommunity.members,
        handle,
        viewer,
        liveCommunity.profilesPublicEnabled,
      )
    : null);
  const resolvedLiveMember = liveMember;
  const followersEnabled = liveCommunity?.followersEnabled !== false;
  const user = resolvedLiveMember
    ? resolvedLiveMember
    : fallbackUser
      ? {
          ...fallbackUser,
          databaseId: 0,
          followerCount: fallbackUser.followers,
          followingCount: fallbackUser.following,
          isFollowedByViewer: false,
          relationshipState: "none" as const,
          canAccess: fallbackUser.isPublic,
          isLocked: !fallbackUser.isPublic,
          role: fallbackUser.role || "member",
        }
      : null;

  // Optimistic follow state — starts from live backend value, toggled locally on mutation.
  const [followState, setFollowState] = useState<{ relationshipState: "none" | "pending" | "accepted" | "owner"; followerCount: number } | null>(null);
  useEffect(() => setFollowState(null), [handle, resolvedLiveMember?.databaseId]);
  const effectiveRelationship = followState?.relationshipState || user?.relationshipState || "none";
  const effectiveFollowerCount = followState !== null ? followState.followerCount : (user?.followerCount ?? 0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const handleFollowToggle = async () => {
    if (!resolvedLiveMember || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      const result = effectiveRelationship === "pending" || effectiveRelationship === "accepted"
        ? await unfollowCommunityProfile(resolvedLiveMember.databaseId)
        : await followCommunityProfile(resolvedLiveMember.databaseId);
      setFollowState(result);
      refresh();
    } catch (err) {
      showToast({
        title: "Could not update follow status",
        description: err instanceof Error ? err.message : "Try again.",
        tone: "error",
      });
    } finally {
      setIsFollowLoading(false);
    }
  };
  const creatorContent = useCreatorContent();
  const { showToast } = useToast();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isListProductOpen, setIsListProductOpen] = useState(false);
  const [isWriteArticleOpen, setIsWriteArticleOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ListProductInitialValues | null>(null);
  const [editingArticle, setEditingArticle] = useState<WriteArticleInitialValues | null>(null);
  const [isLoadingEditTarget, setIsLoadingEditTarget] = useState(false);
  const [followersConnection, setFollowersConnection] = useState<CommunityProfileConnection | null>(null);
  const [followingConnection, setFollowingConnection] = useState<CommunityProfileConnection | null>(null);
  const [isLoadingConnection, setIsLoadingConnection] = useState(false);
  useEffect(() => {
    setFollowersConnection(currentProfileData?.followers || null);
    setFollowingConnection(currentProfileData?.following || null);
  }, [currentProfileData]);
  // Supports deep links like `/community/:handle?tab=shop` (e.g. from a post detail
  // page's "Shop @handle's listings" link) landing directly on the right tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkTab = searchParams.get("tab");
  const activeTab: ProfileTab = deepLinkTab === "shop"
    || deepLinkTab === "articles"
    || deepLinkTab === "followers"
    || deepLinkTab === "following"
    ? deepLinkTab
    : "posts";

  const isOwnProfile = Boolean(viewer && communityHandlesMatch(handle, viewer.handle));
  const isCreator = user?.role === "creator";
  const isCollaborator = user?.role === "collaborator";
  const canPublishPosts = isOwnProfile && (viewer?.capabilities.includes("publish_community_posts") ?? false);
  const canPublishProducts = isOwnProfile && (viewer?.capabilities.includes("publish_marketplace_products") ?? false);
  const canPublishArticles = isOwnProfile && (viewer?.capabilities.includes("publish_collaborator_posts") ?? false);

  const feedPosts = useMemo<SocialPostCardData[]>(() => {
    if (!user) return [];
    if (currentProfileData) {
      return currentProfileData.posts.filter((post) =>
        !filterByLanguage || !post.languageCode || post.languageCode.toLowerCase() === languageCode
      );
    }
    if (liveCommunity) {
      return liveCommunity.posts.filter((post) =>
        communityHandlesMatch(post.author.handle, user.handle)
        && (!filterByLanguage || !post.languageCode || post.languageCode.toLowerCase() === languageCode)
      );
    }
    return getPostsByHandle(user.handle, creatorContent.posts).map((post) => ({
      id: post.id,
      image: post.image,
      aspect: post.aspect,
      title: post.title,
      description: post.description,
      media: post.media,
      caption: post.caption,
      tags: post.tags,
      likes: post.likes,
      comments: post.comments,
      createdAt: post.createdAt,
      author: { handle: user.handle, displayName: user.displayName, avatarUrl: user.avatarUrl },
    }));
  }, [user, creatorContent.posts, liveCommunity, currentProfileData, filterByLanguage, languageCode]);

  const ownProducts = useMemo(
    () => (user ? creatorContent.products.filter((product) => product.vendorHandle === user.handle) : []),
    [user, creatorContent.products],
  );
  const ownArticles = useMemo(
    () => (user ? creatorContent.articles.filter((article) => article.vendorHandle === user.handle) : []),
    [user, creatorContent.articles],
  );
  const creatorProducts = useMemo(
    () => user
      ? liveCommunity
        ? currentProfileData?.products || liveCommunity.marketplaceItems.filter(({ vendor }) => vendor.handle === user.handle).map(({ product }) => product)
        : getCreatorProducts(user.handle, ownProducts)
      : [],
    [user, ownProducts, liveCommunity, currentProfileData],
  );
  const creatorArticles = useMemo(
    () => user
      ? liveMember && liveBlog
        ? (currentProfileData?.articles || liveBlog.posts.filter((post) => post.authorDatabaseId === user.databaseId))
            .filter((post) => !filterByLanguage || !post.languageCode || post.languageCode.toLowerCase() === languageCode)
        : getCreatorArticles(user.handle, ownArticles)
      : [],
    [user, ownArticles, liveBlog, liveMember, currentProfileData, filterByLanguage, languageCode],
  );
  const hasPublishingTabs = isCollaborator
    || creatorProducts.length > 0
    || creatorArticles.length > 0
    || canPublishProducts
    || canPublishArticles;
  const selectTab = (tab: ProfileTab) => {
    setSearchParams(tab === "posts" ? {} : { tab });
  };
  const loadMoreProfiles = async (direction: "followers" | "following") => {
    const connection = direction === "followers" ? followersConnection : followingConnection;
    if (!connection?.hasNextPage || isLoadingConnection) return;
    setIsLoadingConnection(true);
    try {
      const next = await getCommunityProfileConnection(handle, direction, connection.endCursor);
      const merged = { ...next, nodes: [...connection.nodes, ...next.nodes] };
      if (direction === "followers") setFollowersConnection(merged);
      else setFollowingConnection(merged);
    } catch (reason) {
      showToast({
        title: `Could not load ${direction}`,
        description: reason instanceof Error ? reason.message : "Try again.",
        tone: "error",
      });
    } finally {
      setIsLoadingConnection(false);
    }
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

  if (!user && (isLoading || isRevalidating || isProfileLoading)) return <ContentLoadingState label={t("loading.community_profile")} />;
  if (!user && (error || profileError)) {
    return (
      <section role="alert" className="mx-auto grid max-w-lg gap-3 rounded-3xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/60 dark:bg-red-950/30">
        <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">Community profile unavailable</h1>
        <p className="m-0 text-sm text-red-700 dark:text-red-300">{(profileError || error)?.message}</p>
      </section>
    );
  }
  if (!user) return <NotFoundMockupPage />;

  const initials = user.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const canViewFeed = user.canAccess || isOwnProfile;

  const badgesNode = (
    <>
      {!user.isPublic ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Private
        </span>
      ) : null}
      {isCreator || isCollaborator ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {isCollaborator ? "Collaborator" : "Creator"}
        </span>
      ) : null}
      {isOwnProfile ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
          That's you
        </span>
      ) : null}
    </>
  );

  const actionButtonNode = isOwnProfile ? (
    isCreator || canPublishPosts ? (
      <button
        type="button"
        onClick={() => setIsUploadOpen(true)}
        className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        Share a post
      </button>
    ) : null
  ) : followersEnabled ? (
    <button
      type="button"
      disabled={isFollowLoading}
      onClick={handleFollowToggle}
      className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
        effectiveRelationship === "accepted" || effectiveRelationship === "pending"
          ? "border-brand-300 bg-brand-50 text-brand-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-brand-600 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:border-red-600 dark:hover:text-red-400"
          : "border-zinc-200 text-zinc-700 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
      }`}
    >
      {effectiveRelationship === "accepted" ? (
        <>
          <UserCheck className="h-4 w-4" aria-hidden="true" />
          Following
        </>
      ) : effectiveRelationship === "pending" ? (
        <>
          <UserCheck className="h-4 w-4" aria-hidden="true" />
          Requested
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Follow
        </>
      )}
    </button>
  ) : null;

  const statsNode = (
    <>
      <ProfileStat value={feedPosts.length} label="Posts" />
      {hasPublishingTabs ? <ProfileStat value={creatorArticles.length} label="Articles" /> : null}
      {followersEnabled ? <ProfileStat value={effectiveFollowerCount} label="Followers" /> : null}
      {followersEnabled ? <ProfileStat value={user.followingCount} label="Following" /> : null}
      {hasPublishingTabs ? <ProfileStat value={creatorProducts.length} label="Listings" /> : null}
    </>
  );

  const backLinkNode = (
    <Link
      to="/community"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 no-underline transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Community feed
    </Link>
  );

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Community", href: "/community" },
            ...(isCreator || isCollaborator ? [{ label: "Community authors", href: "/community-author" }] : []),
            { label: user.displayName },
          ]}
        />
      </div>

      <ProfileHeader
        layout={headerLayout}
        displayName={user.displayName}
        initials={initials}
        avatarColor={avatarColorFor(user.displayName)}
        avatarUrl={user.avatarUrl}
        coverUrl={user.coverUrl}
        subtitle={<>@{user.handle}</>}
        bio={user.bio}
        badges={badgesNode}
        actions={actionButtonNode}
        stats={statsNode}
        backLink={backLinkNode}
      />

      {canViewFeed && (hasPublishingTabs || followersEnabled) ? (
        <div role="tablist" aria-label={t("community.profile.sections")} className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          <ProfileTabButton label={`Posts (${feedPosts.length})`} isActive={activeTab === "posts"} onClick={() => selectTab("posts")} />
          {hasPublishingTabs ? <ProfileTabButton label={`Shop (${creatorProducts.length})`} isActive={activeTab === "shop"} onClick={() => selectTab("shop")} /> : null}
          {hasPublishingTabs ? <ProfileTabButton label={`Articles (${creatorArticles.length})`} isActive={activeTab === "articles"} onClick={() => selectTab("articles")} /> : null}
          {followersEnabled ? <ProfileTabButton label={`Followers (${effectiveFollowerCount})`} isActive={activeTab === "followers"} onClick={() => selectTab("followers")} /> : null}
          {followersEnabled ? <ProfileTabButton label={`Following (${user.followingCount})`} isActive={activeTab === "following"} onClick={() => selectTab("following")} /> : null}
        </div>
      ) : null}

      {!canViewFeed ? (
        <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="m-0 font-semibold text-zinc-700 dark:text-zinc-200">This profile is private</p>
          <p className="m-0 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            {effectiveRelationship === "pending"
              ? `Your request to follow @${user.handle} is waiting for approval.`
              : `Request access to see @${user.handle}'s posts, shop, articles, followers, and following.`}
          </p>
        </div>
      ) : activeTab === "followers" ? (
        <CommunityProfileList
          title={`${user.displayName}'s followers`}
          connection={followersConnection}
          isLoading={isLoadingConnection}
          onLoadMore={() => loadMoreProfiles("followers")}
        />
      ) : activeTab === "following" ? (
        <div className="grid gap-8">
          <CommunityProfileList
            title={`${user.displayName} follows`}
            connection={followingConnection}
            isLoading={isLoadingConnection}
            onLoadMore={() => loadMoreProfiles("following")}
          />
          {currentProfileData?.followingFeed.length ? (
            <SocialFeedGrid
              title="Posts from followed profiles"
              posts={currentProfileData.followingFeed}
              pageSize={12}
              defaultLayout="grid-3"
              onToggleLike={(post) => toggleCommunityPostLike(Number(post.id))}
            />
          ) : <EmptyTabNotice text="No posts from followed profiles yet." />}
        </div>
      ) : hasPublishingTabs && activeTab === "shop" ? (
        <div className="grid gap-5">
          {isOwnProfile ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">Your shop</h2>
              <button
                type="button"
                onClick={() => setIsListProductOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                List a product
              </button>
            </div>
          ) : null}
          {isOwnProfile && ownProducts.length ? (
            <div className="grid gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Manage your listings</p>
              {ownProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-zinc-700 dark:text-zinc-200">{product.name}</span>
                  <button
                    type="button"
                    onClick={() => creatorContent.removeProduct(product.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {creatorProducts.length ? (
            <div className="grid gap-2">
              <PaginableProductGrid title={`${user.displayName}'s shop`} products={creatorProducts} pageSize={12} allowPurchaseActions={!isOwnProfile} />
              {isOwnProfile && liveMember && canPublishProducts ? (
                <div className="flex flex-wrap gap-2">
                  {creatorProducts.map((product) => product.databaseId ? (
                    <button
                      key={product.databaseId}
                      type="button"
                      disabled={isLoadingEditTarget}
                      onClick={() => openProductForEditing(product.databaseId as number)}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      <PenSquare className="h-3 w-3" aria-hidden="true" />
                      Edit "{product.name}"
                    </button>
                  ) : null)}
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyTabNotice text="No listings yet." />
          )}
        </div>
      ) : hasPublishingTabs && activeTab === "articles" ? (
        <div className="grid gap-5">
          {isOwnProfile ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">Your articles</h2>
              <button
                type="button"
                onClick={() => setIsWriteArticleOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
              >
                <PenSquare className="h-4 w-4" aria-hidden="true" />
                Write an article
              </button>
            </div>
          ) : null}
          {isOwnProfile && ownArticles.length ? (
            <div className="grid gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Manage your articles</p>
              {ownArticles.map((article) => (
                <div key={article.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-zinc-700 dark:text-zinc-200">{article.title}</span>
                  <button
                    type="button"
                    onClick={() => creatorContent.removeArticle(article.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {creatorArticles.length ? (
            <div className="grid gap-2">
              <PaginablePostGrid title={`${user.displayName}'s articles`} posts={creatorArticles} pageSize={6} />
              {isOwnProfile && liveMember && canPublishArticles ? (
                <div className="flex flex-wrap gap-2">
                  {creatorArticles.map((article) => article.databaseId ? (
                    <button
                      key={article.databaseId}
                      type="button"
                      disabled={isLoadingEditTarget}
                      onClick={() => openArticleForEditing(article.databaseId as number)}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      <PenSquare className="h-3 w-3" aria-hidden="true" />
                      Edit "{article.title}"
                    </button>
                  ) : null)}
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyTabNotice text="No articles yet." />
          )}
        </div>
      ) : feedPosts.length ? (
        <SocialFeedGrid
          title={`${user.displayName}'s posts`}
          posts={feedPosts}
          pageSize={12}
          defaultLayout="grid-3"
          onToggleLike={(post) => toggleCommunityPostLike(Number(post.id))}
        />
      ) : (
        <p className="m-0 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No posts yet.
        </p>
      )}

      {isUploadOpen ? (
        <UploadPostModal
          onClose={() => setIsUploadOpen(false)}
          defaultLanguageCode={languageCode}
          searchTranslationCandidates={(query, selectedLanguage) =>
            searchTranslationCandidateCommunityPosts(query, selectedLanguage)
          }
          onSubmit={async (draft) => {
            const media = draft.media.map(({ dataUrl }) => {
              if (!dataUrl) throw new Error("New community media is missing its upload data");
              return { dataUrl };
            });
            await createCommunityPost({
              title: draft.title,
              description: draft.description,
              tags: draft.tags,
              media,
              language: draft.languageCode || languageCode,
              translationOfId: draft.translationOfId,
            });
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
              price: convertSelectedToBase(resolveMarketplaceMutationPrice(
                draft.productType,
                draft.priceAmount,
                draft.variations.map((variation) => variation.priceAmount),
              )),
              regularPrice: draft.compareAtPriceAmount !== undefined ? convertSelectedToBase(draft.compareAtPriceAmount) : undefined,
              stockQuantity: draft.stockQuantity,
              imageDataUrls: draft.imageDataUrls,
              isVirtual: draft.isVirtual,
              isDownloadable: draft.isDownloadable,
              downloadableFiles: draft.downloadableFiles,
              downloadLimit: draft.downloadLimit,
              downloadExpiryDays: draft.downloadExpiryDays,
              externalUrl: draft.externalUrl,
              buttonText: draft.buttonText,
              attributes: draft.attributes,
              variations: draft.variations.map((variation) => ({
                variationId: variation.variationId,
                attributes: variation.attributes,
                sku: variation.sku,
                price: convertSelectedToBase(variation.priceAmount),
                regularPrice: variation.compareAtPriceAmount !== undefined ? convertSelectedToBase(variation.compareAtPriceAmount) : undefined,
                stockQuantity: variation.stockQuantity,
                imageIndex: variation.imageIndex,
                isVirtual: variation.isVirtual,
                isDownloadable: variation.isDownloadable,
                downloadableFiles: variation.downloadableFiles,
                downloadLimit: variation.downloadLimit,
                downloadExpiryDays: variation.downloadExpiryDays,
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
              imageDataUrl: draft.imageDataUrl,
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
          onDelete={async (postId) => {
            await deleteCollaboratorPost(postId);
            setEditingArticle(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}


function ProfileTabButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        isActive
          ? "bg-brand-gradient text-white shadow-glow"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyTabNotice({ text }: { text: string }) {
  return (
    <p className="m-0 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
      {text}
    </p>
  );
}

function CommunityProfileList({
  title,
  connection,
  isLoading,
  onLoadMore,
}: {
  title: string;
  connection: CommunityProfileConnection | null;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  if (!connection?.nodes.length) return <EmptyTabNotice text="No profiles to show yet." />;
  return (
    <section className="grid gap-4">
      <h2 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <div className="grid gap-2">
        {connection.nodes.map((member) => (
          <Link
            key={member.databaseId}
            to={`/community/${member.handle}`}
            className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 text-inherit no-underline transition hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {member.avatarUrl ? (
              <ResponsiveImage src={member.avatarUrl} alt="" sizes="3rem" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: avatarColorFor(member.displayName) }}>
                {member.displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="grid min-w-0 flex-1">
              <strong className="truncate text-sm text-zinc-900 dark:text-zinc-100">{member.displayName}</strong>
              <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{member.handle}</span>
            </span>
            {member.isLocked ? <Lock className="h-4 w-4 text-zinc-400" aria-label="Private profile" /> : null}
          </Link>
        ))}
      </div>
      {connection.hasNextPage ? (
        <button
          type="button"
          disabled={isLoading}
          onClick={onLoadMore}
          className="w-fit rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          {isLoading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </section>
  );
}
