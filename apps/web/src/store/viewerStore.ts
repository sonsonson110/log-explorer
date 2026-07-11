import { create } from 'zustand';

export type ViewerStatus = 'idle' | 'loading' | 'searching' | 'error';

interface ViewerState {
  status: ViewerStatus;
  query: string;
  cursor: string | null;
  hasMore: boolean;
  totalLines: number | null;
  errorMessage: string | null;
  
  // Actions
  setStatus: (status: ViewerStatus) => void;
  setQuery: (query: string) => void;
  setCursor: (cursor: string | null, hasMore: boolean) => void;
  setTotalLines: (totalLines: number) => void;
  setError: (message: string | null) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  status: 'idle',
  query: '',
  cursor: '1', // start at line 1
  hasMore: true,
  totalLines: null,
  errorMessage: null,

  setStatus: (status) => set({ status }),
  setQuery: (query) => set({ query }),
  setCursor: (cursor, hasMore) => set({ cursor, hasMore }),
  setTotalLines: (totalLines) => set({ totalLines }),
  setError: (errorMessage) => set({ errorMessage, status: errorMessage ? 'error' : 'idle' }),
}));
