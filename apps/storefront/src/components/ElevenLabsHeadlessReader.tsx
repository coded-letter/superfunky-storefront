import { useEffect, useState } from "react";
import { BACKEND_ORIGIN } from "@funky/sdk";
import "./ElevenLabsHeadlessReader.css";

type ReaderData = {
  post?: { elwrReaderHtml?: string | null } | null;
  elwrHeadlessAssets?: { styleUrl?: string | null; scriptUrl?: string | null } | null;
};

const loadedStyles = new Set<string>();
const loadedScripts = new Set<string>();

/** Uses the existing WP shortcode renderer, not a second React-only player. */
export function ElevenLabsHeadlessReader({ postId }: { postId: number }) {
  const [data, setData] = useState<ReaderData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!BACKEND_ORIGIN || !Number.isSafeInteger(postId) || postId <= 0) {
      setError("A valid WordPress database post ID and backend are required.");
      return;
    }
    const controller = new AbortController();
    setData(null);
    setError("");
    fetch(`${BACKEND_ORIGIN.replace(/\/$/, "")}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query Reader($id: ID!) { post(id: $id, idType: DATABASE_ID) { elwrReaderHtml } elwrHeadlessAssets { styleUrl scriptUrl } }`,
        variables: { id: String(postId) },
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`);
        const payload = await response.json();
        if (payload.errors?.length) throw new Error(payload.errors[0].message);
        return payload.data as ReaderData;
      })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(String(reason?.message || reason));
      });
    return () => controller.abort();
  }, [postId]);

  useEffect(() => {
    const styleUrl = data?.elwrHeadlessAssets?.styleUrl;
    const scriptUrl = data?.elwrHeadlessAssets?.scriptUrl;
    const origin = BACKEND_ORIGIN?.replace(/\/$/, "");
    const allowed = (value: string) => {
      try { return new URL(value).origin === new URL(origin!).origin; }
      catch { return false; }
    };
    if (styleUrl && allowed(styleUrl) && !loadedStyles.has(styleUrl)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = styleUrl;
      link.dataset.elwrAsset = "style";
      document.head.appendChild(link);
      loadedStyles.add(styleUrl);
    }
    if (scriptUrl && allowed(scriptUrl) && !loadedScripts.has(scriptUrl)) {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.dataset.elwrAsset = "script";
      document.body.appendChild(script);
      loadedScripts.add(scriptUrl);
    }
  }, [data]);

  if (error) return <p role="alert" className="elwr-headless-error">Audio reader: {error}</p>;
  if (!data) return <p className="elwr-headless-loading">Loading audio player…</p>;
  if (!data.post?.elwrReaderHtml) return <p role="status">Audio player is not available for this article. Check the shortcode and generated audio in WordPress.</p>;
  // Only inject shortcode HTML returned by the trusted, configured WordPress backend.
  return <div data-blog-root className="elwr-headless-root" dangerouslySetInnerHTML={{ __html: data.post.elwrReaderHtml }} />;
}
