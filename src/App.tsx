import { AppLayout } from './components/layout/AppLayout';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePlaybackSync } from './hooks/usePlayback';

function App() {
  usePlaybackSync();
  useKeyboardShortcuts();

  return <AppLayout />;
}

export default App;
