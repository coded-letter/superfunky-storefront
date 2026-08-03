import { renderWordPressContent } from "../components/WordPressSpecialPageContent";
import { WORDPRESS_SHORTCODE_RENDERERS } from "../components/wordpressShortcodes";

const COMMUNITY_DEFAULT_CONTENT = `
[community-hero layout="gradient" kicker="Community" title="See how the community styles it" description="Real fits, unboxings, and behind-the-seams posts from other shoppers." show-upload="true"]
[community-feed layout="masonry" load-mode="manual" page-size="12" show-filters="true" title="All posts"]
[community-marketplace layout="grid" card-variant="default" columns="4" limit="12" title="Shop the community"]
[reviews variant="cards" layout="grid-3" limit="6" title="What the community's saying"]
[community-tag-picks layout="grid-3" tag-limit="3" post-limit="3" min-likes="0" title="Hand-picked by tag"]
[grid type="community-article" columns="3" card-variant="default" page-size="6" title="Community blog" subtitle="Articles written by collaborator members."]
[community-members layout="grid" columns="6" limit="12" role="all" show-bio="false" title="Members to follow"]
`;

export function CommunityFeedMockupPage() {
  return (
    <div className="wp-site-blocks entry-content is-layout-flow grid gap-4">
      {renderWordPressContent(COMMUNITY_DEFAULT_CONTENT, WORDPRESS_SHORTCODE_RENDERERS, {})}
    </div>
  );
}
