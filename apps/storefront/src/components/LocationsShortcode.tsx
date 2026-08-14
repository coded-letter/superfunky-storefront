import { ChevronRight, ExternalLink, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLocations, type LocationsPayload, type StoreLocation } from "../lib/locations";
import type { WordPressShortcodeAttributes } from "./wordpressShortcodes";

declare global {
  interface Window {
    google?: {
      maps: {
        importLibrary?: (library: string) => Promise<unknown>;
        Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
        InfoWindow: new (options?: Record<string, unknown>) => GoogleInfoWindow;
        marker?: {
          AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleMarker;
        };
      };
    };
  }
}

type GoogleMap = {
  addListener(event: string, callback: () => void): void;
  getZoom(): number | undefined;
  panTo(position: Position): void;
  setZoom(zoom: number): void;
};
type GoogleMarker = {
  addListener(event: string, callback: () => void): void;
  map: GoogleMap | null;
};
type GoogleInfoWindow = {
  close(): void;
  open(options: { map: GoogleMap; anchor: GoogleMarker }): void;
  setContent(content: string | Node): void;
};
type Position = { lat: number; lng: number };
type MappableLocation = StoreLocation & { latitude: number; longitude: number };
type MarkerState = { marker: GoogleMarker };
type MapState = {
  clear(): void;
  map: GoogleMap;
  markers: Map<number, MarkerState>;
  open(id: number): void;
  setVisible(ids: Set<number>): void;
};
type LocationFilterDetail = { ids: number[]; query: string };

const FILTER_EVENT = "funkycommerce:locations-filter";
const FOCUS_EVENT = "funkycommerce:location-focus";
const FALLBACK_MAP_ID = "DEMO_MAP_ID";
const CARD_COLORS = [
  "#CEDFB6", "#5683C3", "#FCFAF6", "#FCCDB7", "#E8764E", "#FFD36D",
  "#D25F9F", "#4C365C", "#8F86BD", "#F7ADB6", "#E8D3D0", "#D1DFE4",
  "#AEE79F", "#99BED7", "#80C38C", "#6F1740", "#E4DAD1", "#FFFFFF",
];

let mapsLoader: Promise<void> | null = null;
let locationsLoader: Promise<LocationsPayload> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps.marker?.AdvancedMarkerElement) return Promise.resolve();
  if (mapsLoader) return mapsLoader;
  if (window.google?.maps.importLibrary) {
    mapsLoader = window.google.maps.importLibrary("marker").then(() => undefined).catch((reason: unknown) => {
      mapsLoader = null;
      throw reason;
    });
    return mapsLoader;
  }
  mapsLoader = new Promise((resolve, reject) => {
    const callback = `fcMapsReady${Date.now()}`;
    (window as unknown as Record<string, unknown>)[callback] = () => {
      delete (window as unknown as Record<string, unknown>)[callback];
      if (window.google?.maps.marker?.AdvancedMarkerElement) {
        resolve();
      } else {
        mapsLoader = null;
        reject(new Error("Google Maps marker library could not be loaded."));
      }
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callback}&v=weekly&loading=async&libraries=marker`;
    script.async = true;
    script.onerror = () => {
      delete (window as unknown as Record<string, unknown>)[callback];
      mapsLoader = null;
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return mapsLoader;
}

function useLocationsPayload() {
  const [payload, setPayload] = useState<LocationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    locationsLoader ||= fetchLocations().catch((reason: unknown) => {
      locationsLoader = null;
      throw reason;
    });
    void locationsLoader
      .then((result) => active && setPayload(result))
      .catch((reason: unknown) => active && setError(
        reason instanceof Error ? reason.message : "Store locations could not be loaded.",
      ));
    return () => { active = false; };
  }, []);

  return { error, payload };
}

export function MapShortcode({ attributes }: { attributes: WordPressShortcodeAttributes }) {
  const { error: payloadError, payload } = useLocationsPayload();
  const [mapError, setMapError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const mapElement = useRef<HTMLDivElement>(null);
  const mapState = useRef<MapState | null>(null);
  const height = Math.min(1000, Math.max(240, Number(attributes.height) || 500));

  const matches = useMemo(
    () => payload?.locations.filter((location) => locationMatches(location, query)) || [],
    [payload, query],
  );
  const mapLocations = useMemo(
    () => payload?.locations.filter(isMappableLocation) || [],
    [payload],
  );

  useEffect(() => {
    if (!payload?.map.apiKey || !mapElement.current) return;
    let active = true;
    void loadGoogleMaps(payload.map.apiKey).then(() => {
      const AdvancedMarkerElement = window.google?.maps.marker?.AdvancedMarkerElement;
      if (!active || !mapElement.current || !window.google?.maps || !AdvancedMarkerElement) return;
      const map = new window.google.maps.Map(mapElement.current, {
        center: { lat: payload.map.defaultLatitude, lng: payload.map.defaultLongitude },
        zoom: payload.map.defaultZoom,
        mapId: payload.map.mapId || FALLBACK_MAP_ID,
      });
      const markers = new Map<number, MarkerState>();
      const infoWindow = new window.google.maps.InfoWindow();
      const defaultMarker = markerIcon(payload.map.markerColor, payload.map.markerBorderColor);
      for (const location of mapLocations) {
        const marker = new AdvancedMarkerElement({
          position: position(location),
          title: location.name,
          content: markerContent(location.markerImage || payload.map.markerImageUrl || defaultMarker),
        });
        markers.set(location.id, { marker });
      }
      mapState.current = createMarkerController(map, markers, infoWindow, mapLocations, payload.map.clusterColor);
    }).catch((reason: unknown) => {
      if (active) setMapError(reason instanceof Error ? reason.message : "Google Maps could not be loaded.");
    });
    return () => {
      active = false;
      mapState.current?.clear();
      mapState.current = null;
    };
  }, [mapLocations, payload]);

  useEffect(() => {
    const visible = new Set(matches.map(({ id }) => id));
    mapState.current?.setVisible(visible);
    window.dispatchEvent(new CustomEvent<LocationFilterDetail>(FILTER_EVENT, {
      detail: { ids: [...visible], query },
    }));
  }, [matches, query]);

  useEffect(() => {
    const focusFromList = (event: Event) => focusLocation((event as CustomEvent<number>).detail);
    window.addEventListener(FOCUS_EVENT, focusFromList);
    return () => window.removeEventListener(FOCUS_EVENT, focusFromList);
  }, [mapLocations]);

  function focusLocation(id: number) {
    const state = mapState.current;
    const target = mapLocations.find((location) => location.id === id);
    const marker = state?.markers.get(id);
    if (!state || !target || !marker) return;
    state.map.panTo(position(target));
    state.map.setZoom(14);
    state.open(id);
    mapElement.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (payloadError && !payload) return <StatusMessage tone="error">{payloadError}</StatusMessage>;
  if (!payload) return <p role="status" className="sf-map text-sm text-zinc-500">Loading store locations…</p>;

  return (
    <section className="sf-map grid gap-4" aria-label="Store locator map">
      <label className="relative">
        <span className="sr-only">Find a location</span>
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          className="w-full rounded-full border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            const firstMappable = matches.find(isMappableLocation);
            if (event.key === "Enter" && firstMappable) {
              event.preventDefault();
              focusLocation(firstMappable.id);
            }
          }}
          placeholder="Type city or name…"
        />
      </label>
      {mapError ? <StatusMessage tone="error">{mapError}</StatusMessage> : null}
      {payload.map.apiKey && mapLocations.length ? (
        <div
          ref={mapElement}
          className="w-full overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          style={{ height }}
          role="region"
          aria-label="Store locations map"
        />
      ) : !payload.map.apiKey ? (
        <StatusMessage tone="warning">Configure a Google Maps browser API key to display the map.</StatusMessage>
      ) : (
        <StatusMessage tone="warning">Add latitude and longitude to at least one visible location to display the map.</StatusMessage>
      )}
      {query && !matches.length ? <p className="m-0 text-sm text-zinc-500">No locations match your search.</p> : null}
    </section>
  );
}

export function LocationsShortcode() {
  const { error, payload } = useLocationsPayload();
  const [filter, setFilter] = useState<LocationFilterDetail | null>(null);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const filterLocations = (event: Event) => setFilter((event as CustomEvent<LocationFilterDetail>).detail);
    window.addEventListener(FILTER_EVENT, filterLocations);
    return () => window.removeEventListener(FILTER_EVENT, filterLocations);
  }, []);

  const visibleLocations = useMemo(() => {
    if (!payload || !filter) return payload?.locations || [];
    const visible = new Set(filter.ids);
    return payload.locations.filter(({ id }) => visible.has(id));
  }, [filter, payload]);
  const groups = useMemo(() => groupLocations(visibleLocations), [visibleLocations]);

  if (error && !payload) return <StatusMessage tone="error">{error}</StatusMessage>;
  if (!payload) return <p role="status" className="sf-locations text-sm text-zinc-500">Loading store locations…</p>;
  if (!groups.length) return <StatusMessage>No locations match your search.</StatusMessage>;

  let colorIndex = 0;
  return (
    <section className="sf-locations grid gap-6" aria-label="Store locations">
      {groups.map(([city, locations]) => {
        const closed = closedGroups.has(city) && !filter?.query;
        return (
          <section key={city} className="grid gap-3">
            <h2 className="m-0">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left font-display text-xl font-semibold"
                aria-expanded={!closed}
                onClick={() => setClosedGroups((current) => {
                  const next = new Set(current);
                  if (next.has(city)) next.delete(city);
                  else next.add(city);
                  return next;
                })}
              >
                {city}
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  <ChevronRight className={`h-4 w-4 transition-transform ${closed ? "" : "rotate-90"}`} aria-hidden="true" />
                </span>
              </button>
            </h2>
            {!closed ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {locations.map((location) => {
                  const background = CARD_COLORS[colorIndex++ % CARD_COLORS.length];
                  return (
                    <article
                      key={location.id}
                      className={`relative grid min-h-36 content-center gap-2 rounded-2xl p-4 text-center shadow-soft ${isMappableLocation(location) ? "cursor-pointer" : ""}`}
                      style={{ background, color: textColor(background) }}
                      onClick={isMappableLocation(location)
                        ? () => window.dispatchEvent(new CustomEvent<number>(FOCUS_EVENT, { detail: location.id }))
                        : undefined}
                    >
                      <h3 className="m-0 text-base font-semibold">{location.name}</h3>
                      {location.description ? <p className="m-0 text-sm">{location.description}</p> : null}
                      {formatAddress(location) ? <p className="m-0 text-sm">{formatAddress(location)}</p> : null}
                      <LocationDetails location={location} />
                      {location.url ? (
                        <a
                          href={location.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute bottom-3 right-3"
                          aria-label={`Visit ${location.name} website`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </section>
  );
}

function StatusMessage({ children, tone = "neutral" }: { children: string; tone?: "error" | "neutral" | "warning" }) {
  const color = tone === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-zinc-200 text-zinc-500 dark:border-zinc-800";
  return <p role={tone === "error" ? "alert" : "status"} className={`m-0 rounded-2xl border p-4 text-sm ${color}`}>{children}</p>;
}

function groupLocations(locations: StoreLocation[]): [string, StoreLocation[]][] {
  const groups = new Map<string, StoreLocation[]>();
  for (const location of locations) {
    const city = location.city || location.region || location.country || "Locations";
    groups.set(city, [...(groups.get(city) || []), location]);
  }
  return [...groups.entries()];
}

function locationMatches(location: StoreLocation, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  return !normalized || [
    location.name,
    location.description,
    location.address,
    location.city,
    location.region,
    location.postalCode,
    location.country,
    location.phone,
    location.email,
    location.url,
    location.hours,
  ].some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function formatAddress(location: StoreLocation): string {
  return [location.address, location.postalCode, location.city, location.region, location.country].filter(Boolean).join(", ");
}

function isMappableLocation(location: StoreLocation): location is MappableLocation {
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
}

function position(location: MappableLocation): Position {
  return { lat: location.latitude, lng: location.longitude };
}

function infoWindowContent(location: StoreLocation): string {
  const description = location.description ? `<p>${escapeHtml(location.description)}</p>` : "";
  const formattedAddress = formatAddress(location);
  const address = formattedAddress ? `<p>${escapeHtml(formattedAddress)}</p>` : "";
  const phone = location.phone
    ? `<br><a href="tel:${escapeHtml(location.phone.replace(/[^0-9+]/g, ""))}">${escapeHtml(location.phone)}</a>`
    : "";
  const email = location.email
    ? `<br><a href="mailto:${escapeHtml(location.email)}">${escapeHtml(location.email)}</a>`
    : "";
  const hours = location.hours ? `<p>${escapeHtml(location.hours)}</p>` : "";
  const website = location.url
    ? `<br><a href="${escapeHtml(location.url)}" target="_blank" rel="noopener noreferrer">Visit website</a>`
    : "";
  return `<strong>${escapeHtml(location.name)}</strong>${description}${address}${phone}${email}${hours}${website}`;
}

function LocationDetails({ location }: { location: StoreLocation }) {
  if (!location.phone && !location.email && !location.hours) return null;
  return (
    <div className="grid gap-1 text-xs">
      {location.phone ? (
        <a href={`tel:${location.phone.replace(/[^0-9+]/g, "")}`} onClick={(event) => event.stopPropagation()}>
          {location.phone}
        </a>
      ) : null}
      {location.email ? (
        <a href={`mailto:${location.email}`} onClick={(event) => event.stopPropagation()}>
          {location.email}
        </a>
      ) : null}
      {location.hours ? <span>{location.hours}</span> : null}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character
  ));
}

function textColor(hex: string): string {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 < 0.5 ? "#FFFFFF" : "#000000";
}

function markerIcon(fill: string, stroke: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path fill="${fill}" stroke="${stroke}" stroke-width="2" d="M17 1C8.2 1 1 8.2 1 17c0 12 16 26 16 26s16-14 16-26C33 8.2 25.8 1 17 1Z"/><circle cx="17" cy="17" r="5" fill="white"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function markerContent(url: string): HTMLImageElement {
  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  image.draggable = false;
  return image;
}

function createMarkerController(
  map: GoogleMap,
  markers: Map<number, MarkerState>,
  infoWindow: GoogleInfoWindow,
  locations: MappableLocation[],
  clusterColor: string,
): MapState {
  let clusters: GoogleMarker[] = [];
  let visibleIds = new Set(locations.map(({ id }) => id));
  let openId: number | null = null;
  let renderSignature = "";
  const locationsById = new Map(locations.map((location) => [location.id, location]));

  const clearClusters = () => {
    for (const marker of clusters) marker.map = null;
    clusters = [];
  };
  const open = (id: number) => {
    const location = locationsById.get(id);
    const marker = markers.get(id)?.marker;
    if (!location || !marker) return;
    marker.map = map;
    infoWindow.setContent(infoWindowContent(location));
    infoWindow.open({ map, anchor: marker });
    openId = id;
  };
  for (const [id, { marker }] of markers) {
    marker.addListener("click", () => open(id));
  }
  const setVisible = (ids: Set<number>) => {
    visibleIds = ids;
    const zoom = map.getZoom() || 0;
    const signature = `${zoom}:${[...ids].sort((left, right) => left - right).join(",")}`;
    if (signature === renderSignature) return;
    renderSignature = signature;
    clearClusters();
    for (const { marker } of markers.values()) marker.map = null;

    const visible = locations.filter(({ id }) => ids.has(id));
    const directlyVisible = new Set<number>();
    if (zoom >= 14) {
      for (const location of visible) {
        const marker = markers.get(location.id)?.marker;
        if (marker) marker.map = map;
        directlyVisible.add(location.id);
      }
    } else {
      for (const group of clusterGroups(visible, zoom)) {
        if (group.length === 1) {
          const marker = markers.get(group[0].id)?.marker;
          if (marker) marker.map = map;
          directlyVisible.add(group[0].id);
          continue;
        }
        const center = group.reduce(
          (sum, location) => ({
            lat: sum.lat + location.latitude / group.length,
            lng: sum.lng + location.longitude / group.length,
          }),
          { lat: 0, lng: 0 },
        );
        const AdvancedMarkerElement = window.google!.maps.marker!.AdvancedMarkerElement;
        const cluster = new AdvancedMarkerElement({
          map,
          position: center,
          title: `${group.length} locations`,
          content: markerContent(clusterIcon(clusterColor, group.length)),
        });
        cluster.addListener("click", () => {
          map.panTo(center);
          map.setZoom(Math.min(18, zoom + 2));
        });
        clusters.push(cluster);
      }
    }
    if (openId !== null && !directlyVisible.has(openId)) {
      infoWindow.close();
      openId = null;
    }
  };

  map.addListener("idle", () => setVisible(visibleIds));
  setVisible(visibleIds);
  return {
    clear() {
      clearClusters();
      infoWindow.close();
      for (const { marker } of markers.values()) marker.map = null;
    },
    map,
    markers,
    open,
    setVisible,
  };
}

function clusterGroups(locations: MappableLocation[], zoom: number): MappableLocation[][] {
  const cellSize = 360 / (2 ** Math.max(1, zoom)) * 0.35;
  const groups = new Map<string, MappableLocation[]>();
  for (const location of locations) {
    const key = `${Math.floor(location.latitude / cellSize)}:${Math.floor(location.longitude / cellSize)}`;
    groups.set(key, [...(groups.get(key) || []), location]);
  }
  return [...groups.values()];
}

function clusterIcon(color: string, count: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="22" fill="${color}" fill-opacity=".9" stroke="white" stroke-width="3"/><text x="24" y="29" fill="white" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="middle">${count}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
