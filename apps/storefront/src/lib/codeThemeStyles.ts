import type { CodeTheme } from "./codeThemes.ts";

type CodeThemePalette = {
  background: string;
  foreground: string;
  comment: string;
  punctuation: string;
  property: string;
  selector: string;
  operator: string;
  keyword: string;
  function: string;
  variable: string;
};

const CODE_THEME_PALETTES: Record<CodeTheme, CodeThemePalette> = {
  "one-light": {
    background: "#f6f8fa", foreground: "#24292f", comment: "#6e7781", punctuation: "#57606a",
    property: "#cf222e", selector: "#116329", operator: "#8250df", keyword: "#cf222e",
    function: "#8250df", variable: "#953800",
  },
  "one-dark": {
    background: "#282c34", foreground: "#abb2bf", comment: "#7f848e", punctuation: "#abb2bf",
    property: "#e06c75", selector: "#98c379", operator: "#56b6c2", keyword: "#c678dd",
    function: "#61afef", variable: "#d19a66",
  },
  dracula: {
    background: "#282a36", foreground: "#f8f8f2", comment: "#6272a4", punctuation: "#f8f8f2",
    property: "#ff79c6", selector: "#50fa7b", operator: "#ff79c6", keyword: "#ff79c6",
    function: "#50fa7b", variable: "#f1fa8c",
  },
  "duotone-light": {
    background: "#faf8f5", foreground: "#2d2006", comment: "#b6ad9a", punctuation: "#5f4b32",
    property: "#b29762", selector: "#063289", operator: "#728fcb", keyword: "#728fcb",
    function: "#063289", variable: "#896724",
  },
  "duotone-dark": {
    background: "#2a2734", foreground: "#eeebff", comment: "#6c6783", punctuation: "#e09142",
    property: "#ffcc99", selector: "#eeebff", operator: "#ffcc99", keyword: "#ffcc99",
    function: "#eeebff", variable: "#ffcc99",
  },
  prism: {
    background: "#f5f2f0", foreground: "#000000", comment: "#708090", punctuation: "#999999",
    property: "#990055", selector: "#669900", operator: "#9a6e3a", keyword: "#0077aa",
    function: "#dd4a68", variable: "#ee9900",
  },
  coy: {
    background: "#fdfdfd", foreground: "#000000", comment: "#7d8b99", punctuation: "#5f6364",
    property: "#c92c2c", selector: "#2f9c0a", operator: "#a67f59", keyword: "#1990b8",
    function: "#1990b8", variable: "#a67f59",
  },
  dark: {
    background: "hsl(30 20% 25%)", foreground: "#ffffff", comment: "hsl(30 20% 50%)", punctuation: "#ffffff",
    property: "hsl(350 40% 70%)", selector: "hsl(75 70% 60%)", operator: "hsl(40 90% 60%)",
    keyword: "hsl(350 40% 70%)", function: "hsl(75 70% 60%)", variable: "hsl(40 90% 60%)",
  },
  funky: {
    background: "#000000", foreground: "#ffffff", comment: "#aaaaaa", punctuation: "#999999",
    property: "#00ccff", selector: "#adff2f", operator: "#ffa500", keyword: "#ff1493",
    function: "#ffff00", variable: "#00ccff",
  },
  okaidia: {
    background: "#272822", foreground: "#f8f8f2", comment: "#8292a2", punctuation: "#f8f8f2",
    property: "#f92672", selector: "#a6e22e", operator: "#f8f8f2", keyword: "#66d9ef",
    function: "#a6e22e", variable: "#f8f8f2",
  },
  "solarized-light": {
    background: "#fdf6e3", foreground: "#657b83", comment: "#93a1a1", punctuation: "#586e75",
    property: "#268bd2", selector: "#2aa198", operator: "#657b83", keyword: "#859900",
    function: "#b58900", variable: "#cb4b16",
  },
  tomorrow: {
    background: "#2d2d2d", foreground: "#cccccc", comment: "#999999", punctuation: "#cccccc",
    property: "#e2777a", selector: "#7ec699", operator: "#67cdcc", keyword: "#cc99cd",
    function: "#f08d49", variable: "#7ec699",
  },
  twilight: {
    background: "#141414", foreground: "#ffffff", comment: "#777777", punctuation: "#ffffff",
    property: "#cf6a4c", selector: "#8f9d6a", operator: "#f9ee98", keyword: "#cda869",
    function: "#9b703f", variable: "#7587a6",
  },
};

function paletteDeclarations(theme: CodeTheme, palette: CodeThemePalette): string {
  return `pre[data-code-theme="${theme}"],code[data-code-theme="${theme}"][data-code-standalone="true"]{`
    + `--cms-code-bg:${palette.background};--cms-code-fg:${palette.foreground};`
    + `--cms-token-comment:${palette.comment};--cms-token-punctuation:${palette.punctuation};`
    + `--cms-token-property:${palette.property};--cms-token-selector:${palette.selector};`
    + `--cms-token-operator:${palette.operator};--cms-token-keyword:${palette.keyword};`
    + `--cms-token-function:${palette.function};--cms-token-variable:${palette.variable}}`;
}

const TOKEN_STYLES = `
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.comment,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.prolog,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.doctype{color:var(--cms-token-comment)}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.punctuation{color:var(--cms-token-punctuation)}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.property,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.tag,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.boolean,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.number,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.constant,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.symbol{color:var(--cms-token-property)}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.selector,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.attr-name,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.string,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.char,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.builtin,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.inserted{color:var(--cms-token-selector)}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.operator,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.entity,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.url{color:var(--cms-token-operator)}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.keyword,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.atrule{color:var(--cms-token-keyword)}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.function,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.class-name{color:var(--cms-token-function)}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.variable,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.regex,:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.important{color:var(--cms-token-variable)}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.deleted{color:#d73a49}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.bold{font-weight:700}
:is(pre[data-code-theme] code,code[data-code-theme][data-code-standalone="true"]) .token.italic{font-style:italic}
`;

export function mountCodeThemeStyles(): void {
  if (document.head.querySelector("style[data-cms-code-theme-styles]")) return;
  const style = document.createElement("style");
  style.dataset.cmsCodeThemeStyles = "true";
  style.textContent = Object.entries(CODE_THEME_PALETTES)
    .map(([theme, palette]) => paletteDeclarations(theme as CodeTheme, palette))
    .join("") + TOKEN_STYLES;
  document.head.append(style);
}
