import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { App } from '../App';
import { I18nProvider } from '../context/I18nContext';

const auth = vi.hoisted(() => ({ user: null as { id: number } | null }));
vi.mock('../hooks/useApi', () => ({ useApi: () => () => Promise.resolve([]) }));
vi.mock('../lib/api', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/api')>(),
  api: vi.fn().mockResolvedValue({ demoMode: false }),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, isAdmin: false }) }));
const library = vi.hoisted(() => ({
  getSong: () => Promise.resolve({ id: 1, title: 'Grace', artist: '', content: '[C]Grace', visibility: 'public', user_id: 1 }),
  getVersions: () => Promise.resolve([]),
}));
vi.mock('../hooks/useLibraryRead', () => ({ useLibraryRead: () => library }));
vi.mock('@mantine/modals', async importOriginal => ({
  ...await importOriginal<typeof import('@mantine/modals')>(),
  modals: { openConfirmModal: ({ onConfirm }: { onConfirm: () => void }) => onConfirm() },
}));
vi.mock('../views/BrowseView', () => ({ BrowseView: () => <p>Browse view</p> }));
vi.mock('../views/MySongsView', () => ({ MySongsView: () => <p>My Songs view</p> }));
vi.mock('../views/PublicSetlistsView', () => ({ PublicSetlistsView: () => <p>Public Setlists view</p> }));

const renderApp = () => render(<App />, { wrapper: ({ children }: { children: ReactNode }) => <MantineProvider><I18nProvider>{children}</I18nProvider></MantineProvider> });

// Browsers run navigate's rAF route update before the hashchange task; jsdom's timer-based rAF runs it after.
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });
});
afterEach(() => { history.replaceState(null, '', '/'); localStorage.clear(); auth.user = null; vi.restoreAllMocks(); });

it('song page Back from My Songs lands on My Songs', async () => {
  auth.user = { id: 1 };
  history.replaceState(null, '', '#song/1');
  renderApp();
  await userEvent.click(await screen.findByRole('button', { name: /back/i }));
  await screen.findByText('My Songs view');
  await new Promise(r => setTimeout(r, 50));
  expect(screen.queryByText('Browse view')).toBeNull();
  expect(location.hash).toBe('');
});

it('deleting a local setlist while signed out lands on Public Setlists', async () => {
  localStorage.setItem('cv_local_setlists', JSON.stringify([{ id: 'local_1', name: 'Sunday', entries: [] }]));
  history.replaceState(null, '', '#setlist/local_1');
  renderApp();
  await userEvent.click(await screen.findByRole('button', { name: /delete/i }));
  await screen.findByText('Public Setlists view');
  await new Promise(r => setTimeout(r, 50));
  expect(screen.queryByText('Browse view')).toBeNull();
  expect(location.hash).toBe('');
});
