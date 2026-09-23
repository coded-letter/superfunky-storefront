import type { ReactNode } from "react";
import { ArchivePaginationProvider, DEFAULT_ARCHIVE_PAGE_SIZES } from "@funky/ui";
import { useIncrementalData } from "@funky/sdk/react";
import { ARCHIVE_SETTINGS_CACHE_KEY, getArchiveSettings } from "../lib/archiveSettings";

export function ArchiveSettingsProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const state = useIncrementalData(ARCHIVE_SETTINGS_CACHE_KEY, getArchiveSettings, enabled);
  return (
    <ArchivePaginationProvider value={{
      ...(state.data || DEFAULT_ARCHIVE_PAGE_SIZES),
      isLoading: enabled && state.isLoading,
      error: state.error,
    }}>
      {children}
    </ArchivePaginationProvider>
  );
}
