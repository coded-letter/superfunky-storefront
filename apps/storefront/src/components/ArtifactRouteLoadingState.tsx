import { useLocation } from "react-router-dom";
import { warmedStorefrontMain } from "../lib/storefrontDocumentWarmup";
import { ContentLoadingState } from "./ContentLoadingState";

export function ArtifactRouteLoadingState({ label }: { label?: string }) {
  const { pathname } = useLocation();
  const warmed = warmedStorefrontMain(pathname);
  if (!warmed) return <ContentLoadingState label={label} />;

  return (
    <div
      aria-busy="true"
      className={warmed.className}
      data-storefront-artifact-preview="true"
      dangerouslySetInnerHTML={{ __html: warmed.html }}
    />
  );
}
