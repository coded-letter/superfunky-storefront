export function staticStyleSourceHash(styles) {
  return hashStyleSource(JSON.stringify([
    styles.fontFaceStyles || "",
    styles.globalStyles || "",
    styles.stylesheets || [],
    styles.customCss || "",
  ]));
}

function hashStyleSource(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
