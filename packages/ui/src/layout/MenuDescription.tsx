export function MenuDescription({
  html,
  className,
}: {
  html: string | undefined;
  className: string;
}) {
  return html ? (
    <div
      className={`sf-menu-description ${className} [&_p]:m-0`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : null;
}
