import { useState, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useCommandKeybindings } from './hooks/useCommandKeybindings';
import { usePlaybackSync } from './hooks/usePlayback';
import { setSettingsCallback } from './commands/commandExecutor';
import { SettingsModal } from './components/settings/SettingsModal';

function App() {
  usePlaybackSync();
  useCommandKeybindings();

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettingsCallback(() => setSettingsOpen(true));
  }, []);

  return (
    <>
      <AppLayout />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

export default App;
