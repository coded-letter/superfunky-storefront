import { graphqlRequest } from "@funky/sdk";
import { THEME_STYLES_FIELDS, type CmsThemeStyles } from "./pages";

type ThemeStylesResult = {
  funkycommerceThemeStyles: CmsThemeStyles;
};

const THEME_STYLES_QUERY = /* GraphQL */ `
  query StorefrontThemeStyles {
    funkycommerceThemeStyles {
      ${THEME_STYLES_FIELDS}
    }
  }
`;

export async function getWordPressThemeStyles(): Promise<CmsThemeStyles> {
  const { data, errors } = await graphqlRequest<ThemeStylesResult>(THEME_STYLES_QUERY);
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data?.funkycommerceThemeStyles) throw new Error("The site theme styles query returned no data");
  return data.funkycommerceThemeStyles;
}
