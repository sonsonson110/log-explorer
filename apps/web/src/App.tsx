import clsx from "clsx";
import LogView from "./components/LogView.tsx";

function App() {
  return (
    <div
      className={clsx(
        "app-container min-h-screen flex flex-col bg-black text-zinc-100 p-6 md:p-8 font-sans",
      )}
    >
      <header
        className={clsx(
          "app-header mb-6 pb-4 border-b border-zinc-800 flex items-center justify-between",
        )}
      >
        <h1 className="text-xl font-bold text-zinc-100">Log Explorer</h1>
        <div className="text-xs text-zinc-500 font-medium">
          v0.3.0 (M3 Worker Cache)
        </div>
      </header>
      <main className="flex-1 flex flex-col justify-stretch">
        <LogView />
      </main>
    </div>
  );
}

export default App;
