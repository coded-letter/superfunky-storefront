export type SliderContentType = "campaign" | "product" | "post";

export type StaticSliderItem = {
  image: string;
  kicker: string;
  description: string;
  title: string;
};

type ShortcodeAttributes = Record<string, string>;

const STATIC_SLIDER_IMAGE_PRESETS: Record<string, string> = {
  "hero-1": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
  "hero-2": "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
  "hero-fullwidth-demo": "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1920&q=80",
};

export function resolveShortcodeImage(value: string): string {
  return STATIC_SLIDER_IMAGE_PRESETS[value] || value;
}

function slideValues(value?: string): string[] {
  if (!value) return [];
  const delimiter = value.includes("|") ? "|" : ",";
  return value.split(delimiter).map((item) => item.trim()).filter(Boolean);
}

function slideTextValues(value: string | undefined, expectedCount: number): string[] {
  if (!value || value.includes("|")) return slideValues(value);
  const sentenceBoundaries = value.split(/,\s+(?=[A-Z0-9])/).map((item) => item.trim()).filter(Boolean);
  if (sentenceBoundaries.length === expectedCount) return sentenceBoundaries;
  return slideValues(value);
}

export function resolveSliderContentType(value?: string): SliderContentType {
  if (value === "cinematic") return "campaign";
  return value === "campaign" || value === "post" ? value : "product";
}

export function resolveStaticSliderItems(attributes: ShortcodeAttributes): StaticSliderItem[] {
  const images = slideValues(attributes.bgimgs || attributes.images);
  const expectedCount = images.length || 1;
  const titles = slideTextValues(attributes.h1 || attributes.titles, expectedCount);
  const descriptions = slideTextValues(attributes.p || attributes.descriptions, expectedCount);
  const kickers = slideTextValues(attributes.pill || attributes.kickers, expectedCount);

  return (titles.length ? titles : [attributes.title || "New season, new silhouettes"]).map((title, index) => ({
    title,
    description: descriptions[index] || attributes.description || attributes.subtitle || "",
    image: resolveShortcodeImage(images[index] || attributes.bgimg || attributes.image || ""),
    kicker: kickers[index] || attributes.kicker || "",
  }));
}
