import { useViewerStore } from '../store/viewerStore.ts';

export default function LogView() {
  const { status, query } = useViewerStore();

  return (
    <div className="placeholder-view">
      <div className="placeholder-content">
        <p className="placeholder-text">log view placeholder</p>
        <small style={{ color: '#64748b' }}>
          Status: {status} | Active Query: {query || 'none'}
        </small>
      </div>
    </div>
  );
}
