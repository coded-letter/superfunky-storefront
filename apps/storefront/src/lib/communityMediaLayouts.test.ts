import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const card = readFileSync(
  new URL("../../../../packages/ui/src/social/SocialPostCard.tsx", import.meta.url),
  "utf8",
);
const gallery = readFileSync(
  new URL("../../../../packages/ui/src/social/CommunityMediaGallery.tsx", import.meta.url),
  "utf8",
);
const feed = readFileSync(
  new URL("../../../../packages/ui/src/social/SocialFeedGrid.tsx", import.meta.url),
  "utf8",
);
const lightbox = readFileSync(
  new URL("../../../../packages/ui/src/social/CommunityMediaLightbox.tsx", import.meta.url),
  "utf8",
);
const postTemplate = readFileSync(
  new URL("../pages/CommunityPostMockupPage.tsx", import.meta.url),
  "utf8",
);

test("community grid cards cover their locked aspect while compact thumbnails remain contained", () => {
  assert.match(card, /fit="contain-right"[\s\S]*lockAspect/);
  assert.match(card, /fit="cover"[\s\S]*lockAspect=\{layout !== "masonry"\}/);
  assert.match(gallery, /object-contain object-right/);
  assert.match(gallery, /object-cover/);
  assert.match(gallery, /block !h-full !w-full max-w-none object-cover/);
  assert.match(gallery, /block !h-full !w-full max-w-none bg-black object-center/);
  assert.match(gallery, /style=\{lockAspect \? undefined : \{ aspectRatio: activeAspect \}\}/);
  assert.match(gallery, /relative h-full w-full min-h-0 min-w-0/);
});

test("community grid videos expose playable overlay controls", () => {
  assert.match(gallery, /aria-label=\{isPlaying \? "Pause video" : "Play video"\}/);
  assert.match(gallery, /aria-label=\{isMuted \? "Unmute video" : "Mute video"\}/);
  assert.match(gallery, /controls/);
  assert.match(gallery, /playsInline/);
});

test("grouped community cards switch media without activating card navigation", () => {
  assert.match(gallery, /aria-label="Previous media"/);
  assert.match(gallery, /aria-label="Next media"/);
  assert.match(gallery, /event\.stopPropagation\(\)/);
  assert.match(gallery, /aria-pressed=\{index === activeIndex\}/);
  assert.match(card, /closest\("a, button, input, textarea, select"\)/);
  assert.match(gallery, /media\[\(activeIndex \+ 1\) % media\.length\]/);
  assert.match(gallery, /image\.srcset = item\.srcSet/);
});

test("community post detail gallery opens an accessible image and video lightbox", () => {
  assert.match(postTemplate, /<CommunityMediaGallery[\s\S]*variant="detail"/);
  assert.match(gallery, /<CommunityMediaLightbox/);
  assert.match(lightbox, /role="dialog"/);
  assert.match(lightbox, /aria-modal="true"/);
  assert.match(lightbox, /current\.mediaType === "video"[\s\S]*<video/);
  assert.match(lightbox, /<ResponsiveImage/);
  assert.match(lightbox, /media\.length > 1/);
});

test("community media lightbox supports keyboard, swipe, and focus restoration", () => {
  assert.match(lightbox, /event\.key === "Escape"/);
  assert.match(lightbox, /event\.key === "ArrowRight"/);
  assert.match(lightbox, /event\.key === "ArrowLeft"/);
  assert.match(lightbox, /onTouchStart=\{handleTouchStart\}/);
  assert.match(lightbox, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(lightbox, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(lightbox, /returnFocusRef\.current\?\.focus\(\)/);
  assert.match(lightbox, /document\.documentElement\.style\.overflow = "hidden"/);
  assert.match(lightbox, /event\.target\.closest\("video, input, textarea, select, \[contenteditable\]"\)/);
  assert.match(lightbox, /event\.stopPropagation\(\);[\s\S]*onClose\(\)/);
  assert.match(gallery, /activeMedia\?\.mediaType !== "video" \|\| isLightboxOpen/);
  assert.match(gallery, /onIndexChange=\{setCurrentMedia\}/);
});

test("community list cards stack cleanly before the desktop media rail", () => {
  assert.match(card, /sm:grid-cols-\[10rem_minmax\(0,1fr\)\]/);
  assert.match(card, /aspect="16\/10"/);
  assert.match(feed, /grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3/);
});
