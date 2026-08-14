import { useMemo } from "react";
import { sanitizeStorefrontHtml } from "./sanitizeStorefrontHtml";

export function SafeHtmlContent({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const safeHtml = useMemo(() => sanitizeStorefrontHtml(html), [html]);
  if (!safeHtml) return null;

  return (
    <div
      className={["sf-html-content", className].filter(Boolean).join(" ")}
      data-storefront-html
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
