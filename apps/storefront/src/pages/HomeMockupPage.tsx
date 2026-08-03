import { WordPressSpecialPageContent } from "../components/WordPressSpecialPageContent";

/**
 * Home composition is owned by the translated WordPress Page. Each validated
 * shortcode marker is replaced in editor order by the shared live React renderer.
 */
export function HomeMockupPage() {
  return (
    <div className="grid gap-14">
      <WordPressSpecialPageContent pageKey="home" className="-mt-8" />
    </div>
  );
}
