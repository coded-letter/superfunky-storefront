import { restUrl } from "@funky/sdk";

export type StoreLocation = {
  id: number;
  slug: string;
  name: string;
  description: string;
  address: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  hours: string | null;
  markerImage: string | null;
};

export type LocationsPayload = {
  version: string;
  map: {
    apiKey: string;
    mapId: string;
    defaultLatitude: number;
    defaultLongitude: number;
    defaultZoom: number;
    markerColor: string;
    markerBorderColor: string;
    markerImageUrl: string;
    clusterColor: string;
  };
  display: {
    listColumns: number;
    defaultRadiusKm: number;
  };
  locations: StoreLocation[];
};

export async function fetchLocations(): Promise<LocationsPayload> {
  const endpoint = restUrl("funkycommerce/v1/locations");
  if (!endpoint) throw new Error("Store locations are not connected to a backend.");
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(response.status === 404 ? "Store locations are unavailable." : "Store locations could not be loaded.");
  return response.json() as Promise<LocationsPayload>;
}

export function distanceKm(
  from: { latitude: number; longitude: number },
  location: StoreLocation & { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(location.latitude - from.latitude);
  const longitudeDelta = radians(location.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(location.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
