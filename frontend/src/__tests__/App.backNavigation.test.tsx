import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { App } from '../App';
import { I18nProvider } from '../context/I18nContext';
import type { Navigate } from '../lib/routes';

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
vi.mock('../views/MySongsView', () => ({
  MySongsView: ({ navigate }: { navigate: Navigate }) => (
    <>
      <p>My Songs view</p>
      <button onClick={() => navigate('song-view', { id: '1' })}>open song</button>
      <button onClick={() => navigate('song-view', { id: '1' }, { leave: true })}>leave for song</button>
      <button onClick={() => navigate('browse')}>go browse</button>
    </>
  ),
}));
vi.mock('../views/SettingsView', () => ({ SettingsView: () => <p>Settings view</p> }));
vi.mock('../views/AdminView', () => ({ AdminView: () => <p>Admin view</p> }));
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
  expect(location.hash).toBe('#my-songs');
});

it('deleting a local setlist while signed out lands on Public Setlists', async () => {
  localStorage.setItem('cv_local_setlists', JSON.stringify([{ id: 'local_1', name: 'Sunday', entries: [] }]));
  history.replaceState(null, '', '#setlist/local_1');
  renderApp();
  await userEvent.click(await screen.findByRole('button', { name: /delete/i }));
  await screen.findByText('Public Setlists view');
  await new Promise(r => setTimeout(r, 50));
  expect(screen.queryByText('Browse view')).toBeNull();
  expect(location.hash).toBe('#public-setlists');
});

it('opens a page from its typed address and follows hash changes', async () => {
  auth.user = { id: 1 };
  history.replaceState(null, '', '#settings');
  renderApp();
  await screen.findByText('Settings view');
  await act(async () => { location.hash = '#my-songs'; });
  await screen.findByText('My Songs view');
});

it('leaving replaces the entry when the page before it is somewhere else', async () => {
  auth.user = { id: 1 };
  history.replaceState(null, '', '#my-songs');
  renderApp();
  const entries = history.length;
  await userEvent.click(await screen.findByRole('button', { name: 'leave for song' }));
  await waitFor(() => expect(location.hash).toBe('#song/1'));
  expect(history.length).toBe(entries);
});

it('Browse gets its own history entry, so Back returns to the page before it', async () => {
  auth.user = { id: 1 };
  history.replaceState(null, '', '#my-songs');
  renderApp();
  const entries = history.length;
  await userEvent.click(await screen.findByRole('button', { name: 'go browse' }));
  await screen.findByText('Browse view');
  expect(location.hash).toBe('');
  expect(history.length).toBe(entries + 1);
  await act(async () => { history.back(); await new Promise(r => setTimeout(r, 50)); });
  await screen.findByText('My Songs view');
});

it('a write-locked page reached by address while offline falls back to Browse', async () => {
  auth.user = { id: 1 };
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  history.replaceState(null, '', '#admin');
  renderApp();
  await screen.findByText('Browse view');
  expect(screen.queryByText('Admin view')).toBeNull();
  expect(location.hash).toBe('');
  await act(async () => { location.hash = '#song/1/edit'; await new Promise(r => setTimeout(r, 20)); });
  expect(location.hash).toBe('');
  expect(screen.getByText('Browse view')).toBeInTheDocument();
});

it('leaving steps back when the page before it is the destination, so one Back is enough', async () => {
  auth.user = { id: 1 };
  history.replaceState(null, '', '#my-songs');
  renderApp();
  await userEvent.click(await screen.findByRole('button', { name: 'open song' }));
  await waitFor(() => expect(location.hash).toBe('#song/1'));
  const back = vi.spyOn(history, 'back');
  await userEvent.click(await screen.findByRole('button', { name: /back/i }));
  await screen.findByText('My Songs view');
  expect(location.hash).toBe('#my-songs');
  expect(back).toHaveBeenCalledOnce();
});

it('a signed-out visitor who types an editor or settings address gets Browse', async () => {
  for (const hash of ['#song/new', '#song/1/edit', '#song/1/correct', '#settings']) {
    history.replaceState(null, '', hash);
    const { unmount } = renderApp();
    await screen.findByText('Browse view');
    unmount();
  }
});

it('a signed-in user who types the sign-in address gets Browse', async () => {
  auth.user = { id: 1 };
  history.replaceState(null, '', '#auth');
  renderApp();
  await screen.findByText('Browse view');
});
