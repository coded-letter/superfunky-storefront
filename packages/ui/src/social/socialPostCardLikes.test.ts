import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const socialPostCardSource = readFileSync(
  fileURLToPath(new URL("./SocialPostCard.tsx", import.meta.url)),
  "utf8",
);
const socialFeedGridSource = readFileSync(
  fileURLToPath(new URL("./SocialFeedGrid.tsx", import.meta.url)),
  "utf8",
);

test("SocialPostCard's heart/likes control is an interactive toggle, not a decorative count", () => {
  // The feed/grid/list/compact cards previously rendered a bare <span> for likes,
  // so clicking the heart never called the community like mutation anywhere
  // except the single-post detail page. Every layout branch must now render an
  // actual <button> wired to the optimistic-free like handler.
  assert.match(socialPostCardSource, /onToggleLike\?: \(post: SocialPostCardData\) => Promise<\{ liked: boolean; likesCount: number \}>/);
  assert.match(socialPostCardSource, /likedByViewer\?: boolean;/);
  assert.match(socialPostCardSource, /const handleLikeClick = async \(event: MouseEvent<HTMLButtonElement>\) => \{/);
  assert.match(socialPostCardSource, /const result = await onToggleLike\(post\);/);
  assert.match(socialPostCardSource, /setLiked\(result\.liked\);/);
  assert.match(socialPostCardSource, /setLikes\(result\.likesCount\);/);

  const buttonHeartMatches = socialPostCardSource.match(/<button\s*\n\s*\{\.\.\.likeButtonProps\}/g) || [];
  assert.equal(
    buttonHeartMatches.length,
    3,
    "expected the list, compact, and masonry/grid layouts to each render an interactive like <button>",
  );
  assert.doesNotMatch(
    socialPostCardSource,
    /<span className="inline-flex items-center gap-1[^"]*">\s*\n\s*<Heart/,
    "no layout should still render a non-interactive <span> around the heart icon",
  );
});

test("SocialFeedGrid forwards an onToggleLike handler down to each SocialPostCard", () => {
  assert.match(
    socialFeedGridSource,
    /onToggleLike\?: \(post: SocialPostCardData\) => Promise<\{ liked: boolean; likesCount: number \}>;/,
  );
  assert.match(socialFeedGridSource, /<SocialPostCard[^>]*onToggleLike=\{onToggleLike\}/);
});
