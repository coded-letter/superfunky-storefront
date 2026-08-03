/** Maps a string to a stable HSL colour — mirrors the storefront app's own
 * `stringToHSL` helper (used for comment/review avatars) so avatar-less social
 * profiles get the same kind of distinct, consistent placeholder colour instead of a
 * generic gray circle. Kept local to the `ui` package so this component tree doesn't
 * need to reach back into the app for it. */
export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}
