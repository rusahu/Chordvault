import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { chordVaultTheme, chordVaultVariables, colorSchemeManager } from './theme';
import { I18nProvider } from './context/I18nContext';
import { DemoProvider } from './context/DemoContext';
import { AppModalsProvider } from './components/AppModalsProvider';
import { OfflineProvider } from './context/OfflineContext';
import { OfflinePwa } from './components/OfflinePwa';
import { App } from './App';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/source-sans-3/wght-italic.css';
import '@fontsource-variable/noto-sans-tc';
import '@fontsource-variable/jetbrains-mono';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoProvider>
      <AuthProvider>
        <MantineProvider theme={chordVaultTheme} cssVariablesResolver={chordVaultVariables} colorSchemeManager={colorSchemeManager} defaultColorScheme="dark">
            <I18nProvider>
              <AppModalsProvider>
                <Notifications position="bottom-center" autoClose={3000} limit={1} />
                <OfflineProvider>
                  <OfflinePwa />
                  <App />
                </OfflineProvider>
              </AppModalsProvider>
            </I18nProvider>
        </MantineProvider>
      </AuthProvider>
    </DemoProvider>
  </StrictMode>
);
