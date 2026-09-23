import { createContext, useContext, type ReactNode } from "react";

export type ArchivePageSizes = {
  postsPerPage: number;
  productsPerPage: number;
};

export const DEFAULT_ARCHIVE_PAGE_SIZES: ArchivePageSizes = {
  postsPerPage: 10,
  productsPerPage: 12,
};

type ArchivePaginationState = ArchivePageSizes & {
  isLoading?: boolean;
  error?: Error | null;
};

const ArchivePaginationContext = createContext<ArchivePaginationState>(DEFAULT_ARCHIVE_PAGE_SIZES);

export function ArchivePaginationProvider({ children, value }: { children: ReactNode; value: ArchivePaginationState }) {
  return <ArchivePaginationContext.Provider value={value}>{children}</ArchivePaginationContext.Provider>;
}

export function useArchivePagination(): ArchivePaginationState {
  return useContext(ArchivePaginationContext);
}
