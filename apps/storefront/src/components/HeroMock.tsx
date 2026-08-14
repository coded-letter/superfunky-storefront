import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ResponsiveImage, useLayoutPreferences } from "@funky/ui";
import { SliderMock } from "./SliderMock";
import type { HeadingLevel } from "../lib/headingLevels";

export type HeroCta = {
  label: string;
  href: string;
  target?: "_blank" | "_self";
  rel?: string;
};

export type HeroVariant = "glow" | "fullbleed" | "split" | "minimal" | "strip";

export type HeroSlide = {
  id: string;
  kicker?: string;
  title: string;
  description?: string;
  image?: string;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
};

export type HeroMockProps = {
  variant: HeroVariant;
  kicker?: string;
  title: string;
  description?: string;
  /** Background/side image for the image-bearing hero variants. */
  image?: string;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  /** Defaults to `h2` so re-using this component for shortcode-library examples doesn't
   * produce multiple page-level `<h1>`s — pass `h1` only for the single real hero on a
   * page (e.g. the home page's top section). */
  headingLevel?: HeadingLevel;
  remainingSlideHeadingLevel?: HeadingLevel;
  /** Breaks the hero out to full browser width (edge-to-edge, no rounded corners) —
   * matches the `[hero fullwidth]` shortcode attribute. Only makes sense when the hero
   * is used as its own standalone section (e.g. a page's top hero), not nested inside a
   * card/grid where breaking out would overlap sibling content. Off by default. */
  fullWidth?: boolean;
  /** Custom min-height (e.g. `"70vh"`, `"640px"`) — matches the `[hero height]`
   * shortcode attribute, overriding the variant's own default padding/min-height. */
  height?: string;
  /** Turns the classic `glow` hero into a slider when more than one item is supplied. */
  slides?: HeroSlide[];
  sliderAutoplayMs?: number;
};

/**
 * Shared hero-section block — the `[hero]` shortcode's implementation. Five layout
 * variants cover the common patterns a storefront needs (dark atmospheric banner,
 * full-bleed photography, split image/copy, text-only editorial, compact promo strip);
 * see `ShortcodeLibraryMockupPage` for a documented, side-by-side comparison of all five.
 * `minimal` is the long-copy-friendly variant used by the taxonomy archive templates —
 * it stays centered/text-first (so long descriptions read natively) but will show a
 * small rounded image accent above the kicker when an `image` is supplied, rather than
 * ignoring it outright.
 */
export function HeroMock({
  variant,
  kicker,
  title,
  description,
  image,
  primaryCta,
  secondaryCta,
  headingLevel = "h2",
  remainingSlideHeadingLevel = "h2",
  fullWidth = false,
  height,
  slides,
  sliderAutoplayMs = 6000,
}: HeroMockProps) {
  const Heading = headingLevel;
  const heightStyle = height ? { minHeight: height } : undefined;
  const { themeMaxWidthPx } = useLayoutPreferences();
  // Shared edge-to-edge breakout, applied on top of each variant's own layout classes —
  // same viewport-relative trick used elsewhere in the theme, intentionally opted into
  // here (rather than being a bug to fix) since a standalone hero is exactly the kind of
  // section meant to ignore `<main>`'s usual `max-w-7xl` column.
  const breakoutClassName = fullWidth ? "relative left-1/2 right-1/2 -mx-[50vw] w-screen" : "";
  const classicSliderHeight = height ?? "clamp(28rem, 52vw, 36rem)";

  if (variant === "glow" && slides && slides.length > 1) {
    return (
      <SliderMock
        title="Classic hero"
        subtitle=""
        width="full"
        items={slides}
        pageSize={1}
        gridClassName="grid-cols-1"
        showHeader={false}
        navigation="dots"
        autoplayMs={sliderAutoplayMs}
        height={classicSliderHeight}
        getImageUrls={(slide) => [slide.image]}
        renderItem={(slide, index) => (
          <HeroMock
            variant="glow"
            kicker={slide.kicker}
            title={slide.title}
            description={slide.description}
            image={slide.image}
            primaryCta={slide.primaryCta}
            secondaryCta={slide.secondaryCta}
            headingLevel={index === 0 ? headingLevel : remainingSlideHeadingLevel}
            height="100%"
          />
        )}
      />
    );
  }

  if (variant === "glow") {
    return (
      <section
        className={`sf-hero sf-hero-glow funky-hero funky-hero--glow relative overflow-hidden bg-zinc-900 px-6 py-14 sm:px-12 sm:py-20 dark:bg-zinc-900 ${
          fullWidth ? breakoutClassName : "rounded-3xl"
        } ${height ? "flex h-full items-center justify-center" : ""}`}
        style={heightStyle}
      >
        {image ? (
          <ResponsiveImage
            src={image}
            alt=""
            aria-hidden="true"
            priority
            sizes="100vw"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-35"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-zinc-950/60" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 44%, rgb(var(--brand-gradient-from) / 0.34) 0%, rgb(var(--brand-gradient-to) / 0.18) 38%, transparent 72%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto grid w-full max-w-2xl gap-5 px-2 text-center sm:px-6">
          {kicker ? (
            <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80 backdrop-blur">
              {kicker}
            </span>
          ) : null}
          <Heading className="m-0 font-display text-4xl font-extrabold leading-tight text-white drop-shadow-lg sm:text-5xl">{title}</Heading>
          {description ? <p className="mx-auto m-0 line-clamp-3 max-w-lg text-base leading-relaxed text-white/80">{description}</p> : null}
          {primaryCta || secondaryCta ? (
            <div className="mx-auto flex flex-wrap justify-center gap-3 pt-2">
              {primaryCta ? (
                <HeroCtaLink cta={primaryCta} className="rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5" />
              ) : null}
              {secondaryCta ? (
                <HeroCtaLink cta={secondaryCta} className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-white/10" />
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (variant === "fullbleed") {
    return (
      <section
        className={`sf-hero sf-hero-fullbleed funky-hero funky-hero--fullbleed relative flex items-center overflow-hidden rounded-none shadow-soft-lg ${
          fullWidth ? breakoutClassName : ""
        } ${height ? "" : "min-h-[22rem] sm:min-h-[28rem]"}`}
        style={heightStyle}
      >
        {image ? (
          <ResponsiveImage
            src={image}
            alt=""
            priority
            sizes="100vw"
            draggable={false}
            aria-hidden="true"
            className="absolute inset-0 !h-full !w-full max-w-none !rounded-none object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" aria-hidden="true" />
        <div className="absolute inset-0 bg-brand-600/[0.16] mix-blend-multiply" aria-hidden="true" />
        <div
          className={fullWidth ? "mx-auto w-full px-4 sm:px-6 lg:px-8" : ""}
          style={fullWidth ? { maxWidth: `${themeMaxWidthPx}px` } : undefined}
        >
          <div className="relative grid max-w-xl gap-4 py-8 sm:py-12">
            {kicker ? (
              <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-white backdrop-blur">
                {kicker}
              </span>
            ) : null}
            <Heading className="m-0 font-display text-3xl font-bold leading-tight text-white drop-shadow-sm sm:text-5xl">{title}</Heading>
            {description ? <p className="m-0 max-w-lg text-sm text-white/80 sm:text-base">{description}</p> : null}
            {primaryCta || secondaryCta ? (
              <div className="flex flex-wrap gap-3 pt-2">
                {primaryCta ? (
                  <HeroCtaLink cta={primaryCta} className="rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5" />
                ) : null}
                {secondaryCta ? (
                  <HeroCtaLink cta={secondaryCta} className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-white/10" />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "split") {
    return (
      <section
        className={`sf-hero sf-hero-split funky-hero funky-hero--split grid gap-0 overflow-hidden border border-zinc-200/80 bg-white shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 ${
          fullWidth ? breakoutClassName : "rounded-3xl"
        }`}
        style={heightStyle}
      >
        <div className="grid content-center gap-4 p-8 sm:p-12">
          {kicker ? (
            <span className="w-fit rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
              {kicker}
            </span>
          ) : null}
          <Heading className="m-0 font-display text-3xl font-bold leading-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">{title}</Heading>
          {description ? <p className="m-0 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p> : null}
          {primaryCta || secondaryCta ? (
            <div className="flex flex-wrap gap-3 pt-2">
              {primaryCta ? (
                <HeroCtaLink cta={primaryCta} className="rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5" />
              ) : null}
              {secondaryCta ? (
                <HeroCtaLink
                  cta={secondaryCta}
                  className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 no-underline transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="aspect-[4/3] w-full overflow-hidden sm:aspect-auto sm:h-full">
          {image ? (
            <ResponsiveImage
              src={image}
              alt=""
              sizes="(min-width: 640px) 50vw, 100vw"
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
      </section>
    );
  }

  if (variant === "minimal") {
    return (
      <section
        className={`sf-hero sf-hero-minimal funky-hero funky-hero--minimal relative grid gap-5 overflow-hidden border border-zinc-200/80 bg-gradient-to-b from-zinc-50 to-white px-6 py-14 text-center shadow-soft dark:border-zinc-800 dark:from-zinc-900/60 dark:to-zinc-950 sm:px-12 sm:py-20 ${
          fullWidth ? breakoutClassName : "rounded-3xl"
        } ${height ? "content-center" : ""}`}
        style={heightStyle}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" aria-hidden="true" />
        <div className="mx-auto grid max-w-2xl justify-items-center gap-4">
          {image ? (
            <ResponsiveImage
              src={image}
              alt=""
              aria-hidden="true"
              sizes="5rem"
              draggable={false}
              className="h-16 w-16 rounded-2xl object-cover shadow-soft ring-4 ring-white dark:ring-zinc-900 sm:h-20 sm:w-20"
            />
          ) : null}
          {kicker ? <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-brand-400">{kicker}</span> : null}
          <Heading className="m-0 font-display text-4xl font-bold leading-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">{title}</Heading>
          {description ? <p className="mx-auto m-0 max-w-lg text-base leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p> : null}
          {primaryCta || secondaryCta ? (
            <div className="mx-auto flex flex-wrap justify-center gap-3 pt-2">
              {primaryCta ? (
                <HeroCtaLink cta={primaryCta} className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5 hover:shadow-soft dark:bg-zinc-100 dark:text-zinc-900" />
              ) : null}
              {secondaryCta ? (
                <HeroCtaLink
                  cta={secondaryCta}
                  className="inline-flex items-center gap-1.5 rounded-full px-6 py-3 text-sm font-semibold text-zinc-600 no-underline transition hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400"
                  suffix={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  // variant === "strip"
  return (
    <section
      className={`sf-hero sf-hero-strip funky-hero funky-hero--strip relative flex flex-col items-center justify-between gap-4 overflow-hidden px-6 py-5 shadow-glow sm:flex-row sm:px-8 ${
        image ? "bg-zinc-950" : "bg-brand-gradient"
      } ${fullWidth ? `${breakoutClassName} rounded-none` : "rounded-2xl"}`}
      style={heightStyle}
    >
      {image ? (
        <>
          <ResponsiveImage
            src={image}
            alt=""
            sizes="100vw"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-zinc-950/65" aria-hidden="true" />
        </>
      ) : null}
      <div className="relative z-10 grid gap-0.5 text-center sm:text-left">
        {kicker ? <span className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-white/80">{kicker}</span> : null}
        <Heading className="m-0 font-display text-lg font-bold text-white sm:text-xl">{title}</Heading>
        {description ? <p className="m-0 text-sm text-white/85">{description}</p> : null}
      </div>
      {primaryCta || secondaryCta ? (
        <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-2">
          {primaryCta ? (
            <HeroCtaLink
              cta={primaryCta}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 no-underline transition hover:-translate-y-0.5 hover:shadow-soft"
              suffix={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            />
          ) : null}
          {secondaryCta ? (
            <HeroCtaLink
              cta={secondaryCta}
              className="inline-flex items-center rounded-full border border-white/60 px-5 py-2.5 text-sm font-semibold text-white no-underline transition hover:bg-white/10"
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function HeroCtaLink({
  cta,
  className,
  suffix,
}: {
  cta: HeroCta;
  className: string;
  suffix?: ReactNode;
}) {
  return (
    <Link
      to={cta.href}
      target={cta.target}
      rel={cta.rel}
      className={className}
    >
      {cta.label}{suffix ? <> {suffix}</> : null}
    </Link>
  );
}
