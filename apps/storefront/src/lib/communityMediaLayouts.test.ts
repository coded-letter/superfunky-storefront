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

test("community grid cards cover their locked aspect while compact thumbnails remain contained", () => {
  assert.match(card, /fit="contain-right"[\s\S]*lockAspect/);
  assert.match(card, /fit="cover"[\s\S]*lockAspect=\{layout !== "masonry"\}/);
  assert.match(gallery, /object-contain object-right/);
  assert.match(gallery, /object-cover/);
});

test("community grid videos expose playable overlay controls", () => {
  assert.match(gallery, /aria-label=\{isPlaying \? "Pause video" : "Play video"\}/);
  assert.match(gallery, /aria-label=\{isMuted \? "Unmute video" : "Mute video"\}/);
  assert.match(gallery, /controls/);
  assert.match(gallery, /playsInline/);
});

test("community list cards stack cleanly before the desktop media rail", () => {
  assert.match(card, /sm:grid-cols-\[10rem_minmax\(0,1fr\)\]/);
  assert.match(card, /aspect="16\/10"/);
  assert.match(feed, /grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3/);
});
