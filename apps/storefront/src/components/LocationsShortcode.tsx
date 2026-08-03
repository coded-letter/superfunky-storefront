import { LocateFixed, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { distanceKm, fetchLocations, type LocationsPayload, type StoreLocation } from "../lib/locations";
import type { WordPressShortcodeAttributes } from "./wordpressShortcodes";

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
        Marker: new (options: Record<string, unknown>) => GoogleMarker;
        InfoWindow: new (options?: Record<string, unknown>) => GoogleInfoWindow;
      };
    };
  }
}

type GoogleMap = { panTo(position: { lat: number; lng: number }): void; setZoom(zoom: number): void };
type GoogleMarker = { addListener(event: string, callback: () => void): void; setMap(map: GoogleMap | null): void };
type GoogleInfoWindow = { open(options: { map: GoogleMap; anchor: GoogleMarker }): void };
type Coordinates = { latitude: number; longitude: number };

let mapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const callback = `fcMapsReady${Date.now()}`;
    (window as unknown as Record<string, unknown>)[callback] = () => {
      delete (window as unknown as Record<string, unknown>)[callback];
      resolve();
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callback}&v=weekly`;
    script.async = true;
    script.onerror = () => {
      mapsLoader = null;
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return mapsLoader;
}

export function LocationsShortcode({ attributes }: { attributes: WordPressShortcodeAttributes }) {
  const [payload, setPayload] = useState<LocationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [radius, setRadius] = useState(Number(attributes.radius) || 0);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapState = useRef<{ map: GoogleMap; markers: Map<number, GoogleMarker> } | null>(null);
  const visibleIds = useRef<Set<number>>(new Set());
  const layout = ["map", "list", "map-list"].includes(attributes.layout) ? attributes.layout : "map-list";
  const height = Math.min(1000, Math.max(240, Number(attributes.height) || 500));

  useEffect(() => {
    let active = true;
    void fetchLocations()
      .then((result) => {
        if (!active) return;
        setPayload(result);
        if (!radius) setRadius(result.display.defaultRadiusKm);
      })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Store locations could not be loaded."));
    return () => { active = false; };
  }, []);

  const locations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (payload?.locations || []).filter((location) => {
      const textMatches = !normalizedQuery || [
        location.name,
        location.description,
        location.address,
        location.city,
        location.region,
        location.country,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return textMatches && (!origin || !radius || distanceKm(origin, location) <= radius);
    });
  }, [origin, payload, query, radius]);
  visibleIds.current = new Set(locations.map(({ id }) => id));

  useEffect(() => {
    if (!payload?.map.apiKey || !mapElement.current || layout === "list") return;
    let active = true;
    void loadGoogleMaps(payload.map.apiKey).then(() => {
      if (!active || !mapElement.current || !window.google?.maps) return;
      const map = new window.google.maps.Map(mapElement.current, {
        center: { lat: payload.map.defaultLatitude, lng: payload.map.defaultLongitude },
        zoom: payload.map.defaultZoom,
        mapId: payload.map.mapId || undefined,
      });
      const markers = new Map<number, GoogleMarker>();
      const defaultMarker = markerIcon(payload.map.markerColor, payload.map.markerBorderColor);
      for (const location of payload.locations) {
        const info = new window.google.maps.InfoWindow({
          content: `<strong>${escapeHtml(location.name)}</strong><br>${escapeHtml(location.address)}<br>${escapeHtml(location.city)}`,
        });
        const marker = new window.google.maps.Marker({
          map: visibleIds.current.has(location.id) ? map : null,
          position: { lat: location.latitude, lng: location.longitude },
          title: location.name,
          icon: location.markerImage || payload.map.markerImageUrl || defaultMarker,
        });
        marker.addListener("click", () => info.open({ map, anchor: marker }));
        markers.set(location.id, marker);
      }
      mapState.current = { map, markers };
    }).catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Google Maps could not be loaded."));
    return () => {
      active = false;
      const state = mapState.current;
      if (state) {
        for (const marker of state.markers.values()) marker.setMap(null);
        mapState.current = null;
      }
    };
  }, [layout, payload]);

  useEffect(() => {
    if (!mapState.current) return;
    const visible = new Set(locations.map(({ id }) => id));
    for (const [id, marker] of mapState.current.markers) marker.setMap(visible.has(id) ? mapState.current.map : null);
  }, [locations]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("This browser does not support location access.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setOrigin({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setError("Your location could not be accessed."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  function focus(location: StoreLocation) {
    const state = mapState.current;
    if (!state) return;
    state.map.panTo({ lat: location.latitude, lng: location.longitude });
    state.map.setZoom(14);
    mapElement.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (error && !payload) return <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!payload) return <p className="text-sm text-zinc-500">Loading store locations…</p>;
  const gridClass = payload.display.listColumns >= 4
    ? "sm:grid-cols-2 lg:grid-cols-4"
    : payload.display.listColumns === 2
      ? "sm:grid-cols-2"
      : payload.display.listColumns === 1
        ? "grid-cols-1"
        : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search locations</span>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input className="w-full rounded-full border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm dark:border-zinc-800 dark:bg-zinc-900" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search city, country, or location" />
        </label>
        <button type="button" onClick={useCurrentLocation} className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
          <LocateFixed className="h-4 w-4" aria-hidden="true" /> Near me
        </button>
        {origin ? (
          <label className="flex items-center gap-2 text-sm">
            Radius
            <select value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="rounded-full border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              {[10, 25, 50, 100, 250, 0].map((value) => <option key={value} value={value}>{value ? `${value} km` : "Any"}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {error ? <p className="m-0 text-sm text-red-600">{error}</p> : null}
      {layout !== "list" ? (
        payload.map.apiKey
          ? <div ref={mapElement} className="w-full overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" style={{ height }} aria-label="Store locations map" />
          : <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Configure a Google Maps browser API key to display the map. The location list remains available.</p>
      ) : null}
      {layout !== "map" ? (
        locations.length ? (
          <div className={`grid gap-3 ${gridClass}`}>
            {locations.map((location) => (
              <article key={location.id} className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                  <div><h3 className="m-0 text-base font-semibold">{location.name}</h3><p className="m-0 text-sm text-zinc-500">{[location.address, location.city, location.country].filter(Boolean).join(", ")}</p></div>
                </div>
                {location.hours ? <p className="m-0 text-xs text-zinc-500">{location.hours}</p> : null}
                <div className="flex flex-wrap gap-3 text-sm">
                  {layout !== "list" ? <button type="button" className="font-semibold text-brand-700" onClick={() => focus(location)}>Show on map</button> : null}
                  {location.url ? <a href={location.url} target="_blank" rel="noreferrer" className="font-semibold text-brand-700">Website</a> : null}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="rounded-2xl border border-zinc-200 p-5 text-sm text-zinc-500 dark:border-zinc-800">No locations match these filters.</p>
      ) : null}
    </section>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function markerIcon(fill: string, stroke: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path fill="${fill}" stroke="${stroke}" stroke-width="2" d="M17 1C8.2 1 1 8.2 1 17c0 12 16 26 16 26s16-14 16-26C33 8.2 25.8 1 17 1Z"/><circle cx="17" cy="17" r="5" fill="white"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
