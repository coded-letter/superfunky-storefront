const DEFAULT_CMS_ICON_SIZE = 24;

export function addDefaultCmsIconDimensions(html) {
  if (!html) return "";

  return html.replace(
    /(<(?:div|span|figure)\b[^>]*\bclass=(["'])[^"']*\bwp-block-icon\b[^"']*\2[^>]*>\s*<svg\b)([^>]*)(>)/gi,
    (markup, opening, _quote, attributes, close) => {
      if (/\bwidth\s*=/i.test(attributes) || /\bheight\s*=/i.test(attributes)) return markup;
      const viewBox = attributes.match(/\bviewbox\s*=\s*(["'])\s*([^"']+)\1/i)?.[2];
      const dimensions = defaultDimensionsFromViewBox(viewBox);
      return `${opening}${attributes} width="${dimensions.width}" height="${dimensions.height}"${close}`;
    },
  );
}

function defaultDimensionsFromViewBox(viewBox) {
  const values = viewBox?.trim().split(/[\s,]+/).map(Number);
  if (
    !values
    || values.length !== 4
    || !values.every(Number.isFinite)
    || values[2] <= 0
    || values[3] <= 0
  ) {
    return { width: DEFAULT_CMS_ICON_SIZE, height: DEFAULT_CMS_ICON_SIZE };
  }

  const scale = DEFAULT_CMS_ICON_SIZE / Math.max(values[2], values[3]);
  return {
    width: formatDimension(values[2] * scale),
    height: formatDimension(values[3] * scale),
  };
}

function formatDimension(value) {
  return String(Math.max(1, Math.round(value * 100) / 100));
}
