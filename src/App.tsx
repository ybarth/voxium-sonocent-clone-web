import { AppLayout } from './components/layout/AppLayout';
import { useCommandKeybindings } from './hooks/useCommandKeybindings';
import { usePlaybackSync } from './hooks/usePlayback';
import { useSyntheticLayerSync } from './hooks/useSyntheticLayerSync';
import { useLayoutStore } from './stores/layoutStore';
import { SettingsModal } from './components/settings/SettingsModal';
import { ClipboardPopup } from './components/sidebar/ClipboardPopup';

function App() {
  usePlaybackSync();
  useSyntheticLayerSync();
  useCommandKeybindings();

  const settingsOpen = useLayoutStore((s) => s.settingsOpen);
  const setSettingsOpen = useLayoutStore((s) => s.setSettingsOpen);

  return (
    <>
      <AppLayout />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      <ClipboardPopup />
    </>
  );
}

export default App;
