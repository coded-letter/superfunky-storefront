import { useMemo } from "react";
import { sanitizeStorefrontHtml } from "./sanitizeStorefrontHtml";

export function SafeHtmlContent({
  html,
  className,
  preservePresentation = false,
}: {
  html: string | null | undefined;
  className?: string;
  preservePresentation?: boolean;
}) {
  const safeHtml = useMemo(() => sanitizeStorefrontHtml(html, preservePresentation), [html, preservePresentation]);
  if (!safeHtml) return null;

  return (
    <div
      className={["sf-html-content", className].filter(Boolean).join(" ")}
      data-storefront-html
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
