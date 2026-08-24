export type StaticStyleSource = {
  fontFaceStyles: string;
  globalStyles: string;
  stylesheets: string[];
  customCss: string;
};

export function staticStyleSourceHash(styles: StaticStyleSource): string;
