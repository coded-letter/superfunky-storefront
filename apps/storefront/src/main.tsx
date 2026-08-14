import "./styles.css";

let hasMounted = false;
const root = document.getElementById("root")!;
const bootstrapOverlay = document.getElementById("storefront-bootstrap");
const bootstrapStartedAt = performance.now();
const MIN_BOOTSTRAP_MS = 320;
let bootstrapFinished = false;
let failOpenTimer = 0;

const finishBootstrap = () => {
  if (bootstrapFinished) return;
  bootstrapFinished = true;
  window.clearTimeout(failOpenTimer);
  const delay = Math.max(0, MIN_BOOTSTRAP_MS - (performance.now() - bootstrapStartedAt));
  window.setTimeout(() => {
    root.removeAttribute("aria-busy");
    root.removeAttribute("inert");
    bootstrapOverlay?.classList.add("is-ready");
    bootstrapOverlay?.setAttribute("aria-hidden", "true");
    window.setTimeout(() => bootstrapOverlay?.remove(), 220);
  }, delay);
};

window.addEventListener("funky:storefront-ready", finishBootstrap, { once: true });
window.addEventListener("pageshow", (event) => {
  if (event.persisted) finishBootstrap();
});

const mountApplication = async () => {
  if (hasMounted) return;
  hasMounted = true;
  root.setAttribute("aria-busy", "true");
  root.setAttribute("inert", "");
  failOpenTimer = window.setTimeout(finishBootstrap, 2_800);
  try {
    const [{ default: React }, ReactDOM, { App }, incrementalData] = await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("./App"),
      import("@funky/sdk/react"),
    ]);
    const artifactPayload = document.getElementById("storefront-route-payload")?.textContent;
    if (artifactPayload) {
      try {
        incrementalData.seedStorefrontHydration(JSON.parse(artifactPayload));
      } catch (error) {
        console.error("Storefront artifact payload could not be parsed.", error);
      }
    }
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    void import("./lib/push").then(({ registerServiceWorker }) => registerServiceWorker());
  } catch (error) {
    finishBootstrap();
    console.error("Storefront bootstrap failed; preserving prerendered content.", error);
  }
};

void mountApplication();
