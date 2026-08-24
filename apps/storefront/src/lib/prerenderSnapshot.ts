let initialCmsPageMarkup = "";

export function captureInitialCmsPageMarkup(markup: string): void {
  if (!initialCmsPageMarkup && markup) initialCmsPageMarkup = markup;
}

export function getInitialCmsPageMarkup(): string {
  return initialCmsPageMarkup;
}
