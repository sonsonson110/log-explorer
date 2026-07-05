import LogView from './components/LogView.tsx';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Log Explorer</h1>
      </header>
      <main>
        <LogView />
      </main>
    </div>
  );
}

export default App;
