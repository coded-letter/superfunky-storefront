
import "./ElevenLabsHeadlessReader.css";
import { fetchElevenLabsReader } from "../lib/elevenlabs";
import { useEffect, useState } from "react";

type Props = {
  postId: number;
};

export function ElevenLabsHeadlessReader({ postId }: Props) {
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setHtml("");
    setError(null);

    fetchElevenLabsReader(postId)
      .then((result) => {
        if (!active) return;

        setHtml(result.post?.elwrReaderHtml ?? "");
        setCss(result.elwrHeadlessAssets?.css ?? "");
        setScriptUrl(result.elwrHeadlessAssets?.scriptUrl ?? "");
        console.log('asdasd', result.post?.elwrReaderHtml ?? "")
        console.log('asdasd', result.elwrHeadlessAssets?.css ?? "")
        console.log(result.elwrHeadlessAssets?.scriptUrl ?? "")
      })
      .catch((reason: unknown) => {
        if (!active) return;

        setError(
          reason instanceof Error
            ? reason.message
            : "ElevenLabs reader could not be loaded"
        );
      });

    return () => {
      active = false;
    };
  }, [postId]);

  // Load WordPress plugin CSS
  useEffect(() => {
    if (!css) return;

    const id = "elevenlabs-dynamic-css";

    let style = document.getElementById(id) as HTMLStyleElement | null;

    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }

    style.textContent = css;
  }, [css]);

  // Load WordPress plugin JavaScript
  useEffect(() => {
    if (!scriptUrl) return;

    const id = "elevenlabs-reader-script";

    let script = document.getElementById(id) as HTMLScriptElement | null;

    if (script?.src === scriptUrl) return;

    if (script) {
      script.remove();
    }

    script = document.createElement("script");
    script.id = id;
    script.src = scriptUrl;
    script.async = true;

    script.onerror = () => {
      setError("ElevenLabs player JavaScript failed to load.");
    };

    document.body.appendChild(script);

    return () => {
      // Keep the shared script loaded; its click handler uses event delegation.
    };
  }, [scriptUrl]);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!html) return null;

  return (
    <div
      data-blog-root
      className="elwr-headless-root"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
