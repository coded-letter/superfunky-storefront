import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Lock, MessageCircle, Pencil, Sparkles, Store, Trash2 } from "lucide-react";
import { CommunityMediaGallery, ResponsiveImage, UploadPostModal, avatarColorFor, useLanguage, useLayoutPreferences, type SocialPostMedia } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { GuestStarRating } from "../components/GuestStarRating";
import { ShareButtonsRow } from "./ShareButtons";
import { NotFoundMockupPage } from "./NotFoundMockupPage";
import { CommentsSection } from "./CommentThread";
import { useCreatorContent } from "../state/creatorContent";
import { createReview } from "../lib/comments";
import {
  deleteCommunityPost,
  getCommunityPostByDatabaseId,
  getCommunityPostByUri,
  searchTranslationCandidateCommunityPosts,
  toggleCommunityPostLike,
  updateCommunityPost,
} from "../lib/community";
import { useIncrementalData } from "@funky/sdk/react";
import { mountCmsBehaviors, sanitizeCmsHtml } from "../lib/cmsBehaviors";
import { useCommunityData } from "../state/communityData";
import {
  getPostComments,
  getSocialPostById,
  getSocialUserByHandle,
  isCreatorHandle,
} from "./socialShared";

/**
 * A single community post's own page — the template every `SocialPostCard` links to
 * (clicking anywhere on a card's body outside its author/tag pills routes here, see
 * `SocialPostCard`'s `openPost` handler). Gives each upload a permanent, shareable URL
 * with room for a full-size image, the full caption, tag pills, and a proper threaded
 * discussion — reusing `CommentThread.tsx`'s `CommentsSection` exactly as the blog post
 * and product templates do, since a community post's comments are the same underlying
 * WordPress comment entity. Also links back to the author's profile and — for
 * `role: "creator"` accounts — their shop listings, per the marketplace mockup.
 */
export function CommunityPostMockupPage() {
  const { postId = "" } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { hasLanguagePreference, languageCode, syncLanguageCode } = useLanguage();
  const creatorContent = useCreatorContent();
  const { data: liveCommunity, viewer, refresh } = useCommunityData();
  const { discussionLayout } = useLayoutPreferences();
  const [postRevision, setPostRevision] = useState(0);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    data: directPost,
    isLoading: isDirectPostLoading,
    error: directPostError,
  } = useIncrementalData(
    `community-post:v5:${postId || pathname}:${postRevision}`,
    () => postId ? getCommunityPostByDatabaseId(postId) : getCommunityPostByUri(pathname),
  );
  const livePost = liveCommunity?.posts.find((candidate) => candidate.id === postId || String(candidate.databaseId) === postId);
  const wordpressPost = directPost?.post || livePost;
  const fallbackPost = getSocialPostById(postId, creatorContent.posts);
  const post = wordpressPost || fallbackPost;
  const liveAuthor = livePost
    ? liveCommunity?.members.find((member) => member.handle === livePost.author.handle)
      || (viewer?.handle === livePost.author.handle ? viewer : undefined)
      || directPost?.author
    : directPost?.author;
  const author = liveAuthor
    ? { ...liveAuthor, followers: 0, following: 0 }
    : post
      ? getSocialUserByHandle("authorHandle" in post ? post.authorHandle : post.author.handle)
      : undefined;

  const comments = useMemo(() => wordpressPost?.reviews || (post ? getPostComments(post.id) : []), [post, wordpressPost]);
  const [likesCount, setLikesCount] = useState(wordpressPost?.likes ?? fallbackPost?.likes ?? 0);
  const [liked, setLiked] = useState(wordpressPost?.likedByViewer ?? false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLikesCount(wordpressPost?.likes ?? fallbackPost?.likes ?? 0);
    setLiked(wordpressPost?.likedByViewer ?? false);
  }, [fallbackPost?.likes, wordpressPost?.likedByViewer, wordpressPost?.likes]);

  useEffect(() => {
    if (!directPost) return;
    const sourceLanguageCode = directPost.languageCode || "en";
    if (!hasLanguagePreference) {
      syncLanguageCode(sourceLanguageCode);
      return;
    }
    if (sourceLanguageCode.toLowerCase() === languageCode.toLowerCase()) return;
    const translation = (directPost.translations || []).find(({ languageCode: translatedLanguage }) => translatedLanguage.toLowerCase() === languageCode.toLowerCase());
    if (translation) navigate(translation.uri || `/community/post/${translation.databaseId}`, { replace: true });
  }, [directPost, hasLanguagePreference, languageCode, navigate, syncLanguageCode]);

  useEffect(() => {
    if (!contentRef.current || !wordpressPost?.contentHtml) return;
    return mountCmsBehaviors(contentRef.current);
  }, [wordpressPost?.contentHtml]);

  if (!post && isDirectPostLoading) {
    return <ContentLoadingState label="Loading community post" />;
  }
  if (!post && directPostError) {
    return <CommunityPostStatus title="Community post unavailable" message={directPostError.message} />;
  }
  if (!post || !author) return <NotFoundMockupPage />;

  const isOwnPost = Boolean(viewer && author.handle === viewer.handle);
  const canView = author.isPublic || isOwnPost;
  const isSeller = author.role === "collaborator" || isCreatorHandle(author.handle);
  const title = post.title?.trim() || post.caption;
  const media: SocialPostMedia[] = post.media?.length
    ? post.media
    : post.image
      ? [{
          databaseId: 0,
          url: post.image,
          mimeType: "image/jpeg",
          mediaType: "image",
          altText: title,
        }]
      : [];

  const initials = author.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={contentRef} className="grid gap-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Community", href: "/community" },
          { label: author.displayName, href: `/community/${author.handle}` },
          { label: "Post" },
        ]}
      />

      <Link
        to={`/community/${author.handle}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 no-underline transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to @{author.handle}
      </Link>

      {!canView ? (
        <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="m-0 font-semibold text-zinc-700 dark:text-zinc-200">This post is private</p>
          <p className="m-0 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">Follow @{author.handle} to see their posts once they approve you.</p>
        </div>
      ) : (
        <article className={`grid gap-8 lg:items-start ${media.length ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]" : "mx-auto w-full max-w-3xl"}`}>
          {media.length ? (
            <CommunityMediaGallery media={media} title={title} variant="detail" imageLoading="eager" aspect={post.aspect} />
          ) : null}

          <div className="grid gap-6 self-start">
            <div className="flex items-center justify-between gap-3">
              <Link to={`/community/${author.handle}`} className="inline-flex min-w-0 items-center gap-3 no-underline">
                {author.avatarUrl ? (
                  <ResponsiveImage src={author.avatarUrl} alt="" sizes="2.75rem" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: avatarColorFor(author.displayName) }}
                    aria-hidden="true"
                  >
                    {initials}
                  </span>
                )}
                <span className="grid min-w-0">
                  <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{author.displayName}</span>
                  <span className="flex items-center gap-2 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    @{author.handle}
                    {directPost ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold uppercase dark:bg-zinc-800">{directPost.languageCode}</span> : null}
                  </span>
                </span>
              </Link>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {directPost?.post.canEdit ? (
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>
                ) : null}
                {wordpressPost?.canDelete ? (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={async () => {
                      if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
                      setIsDeleting(true);
                      setDeleteError(null);
                      try {
                        await deleteCommunityPost(wordpressPost.databaseId);
                        refresh();
                        navigate(`/community/${author.handle}`, { replace: true });
                      } catch (error) {
                        setDeleteError(error instanceof Error ? error.message : "The community post could not be deleted.");
                        setIsDeleting(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                ) : null}
                {isSeller ? (
                  <Link
                    to={`/community/${author.handle}?tab=shop`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 no-underline transition hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900"
                  >
                    <Store className="h-3.5 w-3.5" aria-hidden="true" />
                    Shop @{author.handle}
                  </Link>
                ) : null}
              </span>
            </div>

            <h1 className="m-0 font-display text-3xl font-bold text-zinc-950 dark:text-zinc-50">{title}</h1>

            {wordpressPost ? (
              <GuestStarRating
                targetType="community_post"
                targetId={wordpressPost.databaseId}
                initialSummary={wordpressPost.engagementRating}
              />
            ) : null}

            {wordpressPost ? (
              wordpressPost.contentHtml ? (
                <div
                  className="wp-site-blocks entry-content is-layout-flow text-base leading-relaxed text-zinc-700 dark:text-zinc-200"
                  dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(wordpressPost.contentHtml) }}
                />
              ) : null
            ) : (
              post.description || post.caption ? (
                <p className="m-0 whitespace-pre-line text-base leading-relaxed text-zinc-700 dark:text-zinc-200">{post.description || post.caption}</p>
              ) : null
            )}

            {post.tags.length ? (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag, index) => (
                  <Link
                    key={tag}
                    to={communityTagPath(wordpressPost?.tagSlugs?.[index], tag)}
                    className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 no-underline transition hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-5 border-y border-zinc-200 py-4 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
              <button
                type="button"
                disabled={!wordpressPost}
                onClick={async () => {
                  if (!wordpressPost) return;
                  setLikeError(null);
                  try {
                    const result = await toggleCommunityPostLike(wordpressPost.databaseId);
                    setLiked(result.liked);
                    setLikesCount(result.likesCount);
                  } catch (error) {
                    setLikeError(error instanceof Error ? error.message : "The like could not be updated.");
                  }
                }}
                className={`inline-flex items-center gap-1.5 ${liked ? "text-red-500" : ""}`}
              >
                <Heart className="h-4 w-4" aria-hidden="true" />
                {likesCount.toLocaleString()} likes
              </button>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {comments.length || post.comments} comments
              </span>
              {isSeller ? (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Creator
                </span>
              ) : null}
            </div>
            {likeError ? <p role="alert" className="m-0 text-xs font-medium text-red-600 dark:text-red-400">{likeError}</p> : null}
            {deleteError ? <p role="alert" className="m-0 text-xs font-medium text-red-600 dark:text-red-400">{deleteError}</p> : null}

            <ShareButtonsRow title={title} />
          </div>
        </article>
      )}

      {canView ? (
        <CommentsSection
          anchorId="discussion"
          contentKey={`community-post:${postId || pathname}`}
          heading="Discussion"
          initialReviews={comments}
          formTitle="Join the discussion"
          formNote="Comments are held for moderation and only appear once approved."
          showRatingField={false}
          discussionLayout={discussionLayout}
          onSubmitReview={wordpressPost ? (review) => createReview({
            commentOn: wordpressPost.databaseId,
            author: review.author,
            authorEmail: review.email,
            content: review.content,
          }) : undefined}
          onSubmitReply={wordpressPost ? (parent, reply) => {
            if (!parent.databaseId) throw new Error("This discussion reply target is unavailable");
            return createReview({
              commentOn: wordpressPost.databaseId,
              author: reply.author,
              authorEmail: reply.email,
              content: reply.content,
              parent: parent.databaseId,
            });
          } : undefined}
        />
      ) : null}

      {isEditOpen && directPost ? (
        <UploadPostModal
          initialValues={{
            title: directPost.post.title,
            description: directPost.post.description,
            tags: directPost.post.tags,
            media: directPost.post.media.map((item) => ({
              attachmentId: item.databaseId,
              url: item.url,
              mimeType: item.mimeType,
              mediaType: item.mediaType,
            })),
            languageCode: directPost.languageCode || "en",
            translationOfId: directPost.translations?.[0]?.databaseId,
          }}
          searchTranslationCandidates={(query, selectedLanguage) =>
            searchTranslationCandidateCommunityPosts(query, selectedLanguage, directPost.post.databaseId)
          }
          onClose={() => setIsEditOpen(false)}
          onSubmit={async (draft) => {
            const updatedMedia = draft.media.map((item) => {
              if (item.attachmentId) return { attachmentId: item.attachmentId };
              if (item.dataUrl) return { dataUrl: item.dataUrl };
              throw new Error("A community media item is missing its upload data");
            });
            await updateCommunityPost(directPost.post.databaseId, {
              title: draft.title,
              description: draft.description,
              tags: draft.tags,
              media: updatedMedia,
              translationOfId: draft.translationOfId,
            });
            refresh();
            setPostRevision((revision) => revision + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function CommunityPostStatus({ title, message }: { title: string; message: string }) {
  return (
    <section className="grid min-h-[40vh] place-items-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="grid max-w-lg gap-2">
        <h1 className="m-0 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
        <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      </div>
    </section>
  );
}

function communityTagPath(slug: string | undefined, name: string): string {
  const fallbackSlug = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return `/community-tag/${encodeURIComponent(slug || fallbackSlug)}`;
}
