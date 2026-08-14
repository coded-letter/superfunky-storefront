import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCommunityData, getCommunityViewer, type CommunityData, type CommunityViewer } from "../lib/community";
import { useIncrementalData, type IncrementalDataState } from "@funky/sdk/react";
import { authStore } from "../lib/auth";
import { useLanguage } from "@funky/ui";

type CommunityDataContextValue = IncrementalDataState<CommunityData> & {
  viewer: CommunityViewer | null;
  isViewerLoading: boolean;
  viewerError: Error | null;
  refresh: () => void;
};

const CommunityDataContext = createContext<CommunityDataContextValue | null>(null);

export function CommunityDataProvider({ children, enabled = true }: { children?: ReactNode; enabled?: boolean }) {
  const { languageCode, languageBackendCode } = useLanguage();
  const [userId, setUserId] = useState(() => authStore.load()?.user?.databaseId || 0);
  const [revision, setRevision] = useState(0);
  useEffect(
    () => authStore.subscribe(() => setUserId(authStore.load()?.user?.databaseId || 0)),
    [],
  );
  const rawDataState = useIncrementalData(
    `community:v8:${languageCode}:${languageBackendCode}:${userId}:${revision}`,
    () => getCommunityData(languageCode, languageBackendCode),
    enabled,
  );
  const rawViewerState = useIncrementalData(
    `community-viewer:v3:${userId}:${revision}`,
    getCommunityViewer,
    enabled,
  );
  const dataState = useMemo<IncrementalDataState<CommunityData>>(() => ({
    ...rawDataState,
    data: rawDataState.data
      ? {
          posts: Array.isArray(rawDataState.data.posts) ? rawDataState.data.posts : [],
          members: Array.isArray(rawDataState.data.members) ? rawDataState.data.members : [],
          marketplaceItems: Array.isArray(rawDataState.data.marketplaceItems) ? rawDataState.data.marketplaceItems : [],
          profilesPublicEnabled: rawDataState.data.profilesPublicEnabled !== false,
          followersEnabled: rawDataState.data.followersEnabled !== false,
        }
      : null,
  }), [rawDataState]);
  const viewer = useMemo<CommunityViewer | null>(() => rawViewerState.data
    ? {
        ...rawViewerState.data,
        capabilities: Array.isArray(rawViewerState.data.capabilities) ? rawViewerState.data.capabilities : [],
      }
    : null, [rawViewerState.data]);
  return (
    <CommunityDataContext.Provider
      value={{
        ...dataState,
        viewer,
        isViewerLoading: rawViewerState.isLoading,
        viewerError: rawViewerState.error,
        refresh: () => setRevision((value) => value + 1),
      }}
    >
      {children}
    </CommunityDataContext.Provider>
  );
}

export function useCommunityData(): CommunityDataContextValue {
  const context = useContext(CommunityDataContext);
  if (!context) throw new Error("useCommunityData must be used within CommunityDataProvider");
  return context;
}
