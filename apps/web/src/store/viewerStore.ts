import { create } from "zustand";

export type ViewerStatus = "idle" | "loading" | "searching" | "error";

interface ViewerState {
  status: ViewerStatus;
  query: string;
  cursor: string | null;
  hasMore: boolean;
  indexedEntries: number | null;
  errorMessage: string | null;

  // Actions
  setStatus: (status: ViewerStatus) => void;
  setQuery: (query: string) => void;
  setCursor: (cursor: string | null, hasMore: boolean) => void;
  setIndexedEntries: (indexedEntries: number) => void;
  setError: (message: string | null) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  status: "idle",
  query: "",
  cursor: null,
  hasMore: true,
  indexedEntries: null,
  errorMessage: null,

  setStatus: (status) => set({ status }),
  setQuery: (query) => set({ query }),
  setCursor: (cursor, hasMore) => set({ cursor, hasMore }),
  setIndexedEntries: (indexedEntries) => set({ indexedEntries }),
  setError: (errorMessage) =>
    set({ errorMessage, status: errorMessage ? "error" : "idle" }),
}));
