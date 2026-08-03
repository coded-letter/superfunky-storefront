import type { SpecialPageKey } from "../lib/pages";
import { APPLICATION_SHORTCODE_RENDERERS } from "./applicationShortcodeRenderers";
import { WordPressSpecialPageContent } from "./WordPressSpecialPageContent";
import type { WordPressShortcodeAttributes, WordPressShortcodeRenderer } from "./wordpressShortcodes";

type CustomerShortcodePageProps = {
  pageKey: SpecialPageKey;
  defaultShortcode: string;
  defaultAttributes?: WordPressShortcodeAttributes;
  shortcodeRenderers?: Record<string, WordPressShortcodeRenderer>;
  className?: string;
};

export function CustomerShortcodePage({
  pageKey,
  defaultShortcode,
  defaultAttributes = {},
  shortcodeRenderers = {},
  className,
}: CustomerShortcodePageProps) {
  return (
    <WordPressSpecialPageContent
      pageKey={pageKey}
      className={className}
      showLoadingState={false}
      shortcodeRenderers={{ ...APPLICATION_SHORTCODE_RENDERERS, ...shortcodeRenderers }}
      shortcodeFallbacks={{ [defaultShortcode]: defaultAttributes }}
      defaultShortcodes={[{ name: defaultShortcode, attributes: defaultAttributes }]}
    />
  );
}
