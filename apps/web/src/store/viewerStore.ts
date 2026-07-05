import { create } from 'zustand';

export type ViewerStatus = 'idle' | 'loading' | 'searching';

interface ViewerState {
  viewportStart: number;
  viewportEnd: number;
  query: string;
  status: ViewerStatus;
  
  // Actions stubs
  setViewport: (start: number, end: number) => void;
  setQuery: (query: string) => void;
  setStatus: (status: ViewerStatus) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  viewportStart: 0,
  viewportEnd: 100,
  query: '',
  status: 'idle',

  setViewport: (start, end) => {
    // TODO: Update state to track viewport index bounds
    set({ viewportStart: start, viewportEnd: end });
  },

  setQuery: (query) => {
    // TODO: Set filter search query for logs
    set({ query });
  },

  setStatus: (status) => {
    // TODO: Set loading or searching lifecycle status
    set({ status });
  }
}));
