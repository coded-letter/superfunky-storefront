
import { useEffect } from "react";
import { graphqlRequest } from "@funky/sdk";
import "./ElevenLabsHeadlessReader.css";

type AssetsResponse = {
  elwrHeadlessAssets: {
    css: string | null;
    scriptUrl: string | null;
    styleUrl: string | null;
  } | null;
};

type ReaderResponse = {
  post: {
    elwrReaderHtml: string | null;
  } | null;
};

const ASSETS_QUERY = `
  query ElevenLabsAssets {
    elwrHeadlessAssets {
      css
      scriptUrl
      styleUrl
    }
  }
`;

const READER_QUERY = `
  query ElevenLabsReaderColor($id: ID!) {
    post(id: $id, idType: DATABASE_ID) {
      elwrReaderHtml
    }
  }
`;

type Props = {
  postId?: number;
};

function extractReaderColor(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const reader = doc.querySelector<HTMLElement>(".elwr-reader");
  if (!reader) return null;

  const color = reader.style
    .getPropertyValue("--elwr-color")
    .trim();

  // Accept only hex colors from the backend.
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : null;
}

function applyReaderColor(color: string) {
  document.querySelectorAll<HTMLElement>(".elwr-reader").forEach(
    (reader) => {
      reader.style.setProperty("--elwr-color", color);
    }
  );
}

export function ElevenLabsExistingMarkupAssets({
  postId,
}: Props) {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    async function loadAssets() {
      try {
        const { data, errors } =
          await graphqlRequest<AssetsResponse>(ASSETS_QUERY);

        if (errors?.length) {
          throw new Error(
            errors.map((error) => error.message).join("; ")
          );
        }

        if (cancelled || !data?.elwrHeadlessAssets) {
          return;
        }

        const { css, scriptUrl, styleUrl } =
          data.elwrHeadlessAssets;

        // 1. Load the plugin's original CSS.
        if (styleUrl) {
          let link = document.getElementById(
            "elevenlabs-reader-stylesheet"
          ) as HTMLLinkElement | null;

          if (!link) {
            link = document.createElement("link");
            link.id = "elevenlabs-reader-stylesheet";
            link.rel = "stylesheet";
            document.head.appendChild(link);
          }

          if (link.href !== styleUrl) {
            link.href = styleUrl;
          }
        }

        // 2. Inject WordPress dynamic CSS.
        if (css) {
          let style = document.getElementById(
            "elevenlabs-dynamic-css"
          ) as HTMLStyleElement | null;

          if (!style) {
            style = document.createElement("style");
            style.id = "elevenlabs-dynamic-css";
            document.head.appendChild(style);
          }

          style.textContent = css;
        }

        // 3. Restore the WordPress admin color if
        //    the frontend sanitizer removed it.
        if (Number.isInteger(postId) && (postId ?? 0) > 0) {
          try {
            const readerResult =
              await graphqlRequest<ReaderResponse>(
                READER_QUERY,
                { id: String(postId) }
              );

            if (readerResult.errors?.length) {
              throw new Error(
                readerResult.errors
                  .map((error) => error.message)
                  .join("; ")
              );
            }

            if (cancelled) return;

            const html =
              readerResult.data?.post?.elwrReaderHtml;

            const color = html
              ? extractReaderColor(html)
              : null;

            if (color) {
              applyReaderColor(color);

              // Also handle reader markup mounted later.
              observer = new MutationObserver(() => {
                applyReaderColor(color);
              });

              observer.observe(document.body, {
                childList: true,
                subtree: true,
              });

              console.info(
                "[ELWR] WordPress admin color:",
                color
              );
            } else {
              console.warn(
                "[ELWR] No admin color found in reader HTML"
              );
            }
          } catch (error) {
            console.warn(
              "[ELWR] Could not restore reader color:",
              error
            );
          }
        }

        if (cancelled) return;

        // 4. Load the plugin's JavaScript.
        if (scriptUrl) {
          let script = document.getElementById(
            "elevenlabs-reader-script"
          ) as HTMLScriptElement | null;

          if (!script) {
            script = document.createElement("script");
            script.id = "elevenlabs-reader-script";
            script.async = true;
            script.src = scriptUrl;
            document.body.appendChild(script);
          }
        }

        console.info("[ELWR] Assets loaded", {
          css: Boolean(css),
          styleUrl,
          scriptUrl,
          postId,
        });
      } catch (error) {
        console.error(
          "[ELWR] Failed to load assets:",
          error
        );
      }
    }

    loadAssets();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [postId]);

  return null;
}
