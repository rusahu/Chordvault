import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { OfflineProvider, useOffline, useOfflineActivity } from './OfflineContext';
import { offlineLibrary } from '../lib/offlineLibrary';
import { downloadOfflineLibrary } from '../lib/offlineDownload';

const { user, auth, logout } = vi.hoisted(() => {
  const user = { id: 7, username: 'fixture', role: 'user', token: 'test' };
  return { user, auth: { user }, logout: vi.fn() };
});
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: auth.user, logout }) }));
vi.mock('../lib/offlineDownload', () => ({ downloadOfflineLibrary: vi.fn(async () => true) }));
function View({ playing }: { playing: boolean }) {
  useOfflineActivity(playing);
  const offline = useOffline();
  return <><span>{offline.readOnly ? 'read only' : 'online'}</span><button onClick={() => void offline.refresh(true)}>Refresh</button>
    <button onClick={offline.markLibraryChanged}>Changed</button><span>{offline.saveWaiting() ? 'save waiting' : 'saved'}</span></>;
}
beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.setItem('cv_user', JSON.stringify(user));
  await offlineLibrary.db.open();
  await offlineLibrary.enable(user.id);
  vi.mocked(downloadOfflineLibrary).mockImplementation(async () => { await offlineLibrary.db.state.update('current', { checkedAt: Date.now() }); return true; });
});
afterEach(async () => { await offlineLibrary.db.delete(); localStorage.clear(); vi.restoreAllMocks(); auth.user = user; });
it('defers automatic downloads throughout playback, then checks after leaving', async () => {
  const view = render(<OfflineProvider><View playing /></OfflineProvider>);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(downloadOfflineLibrary).not.toHaveBeenCalled();
  view.rerender(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await waitFor(() => expect(downloadOfflineLibrary).toHaveBeenCalledOnce());
});
it('does not start a request from a tab whose stored account changed', async () => {
  localStorage.setItem('cv_user', JSON.stringify({ ...user, id: 8 }));
  render(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await act(async () => { screen.getByText('Refresh').click(); window.dispatchEvent(new Event('focus')); });
  expect(downloadOfflineLibrary).not.toHaveBeenCalled();
});
it('blocks duplicate pending refreshes', async () => {
  let finish!: (value: boolean) => void;
  vi.mocked(downloadOfflineLibrary).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await waitFor(() => expect(downloadOfflineLibrary).toHaveBeenCalledOnce());
  await act(async () => { screen.getByText('Refresh').click(); screen.getByText('Refresh').click(); });
  expect(downloadOfflineLibrary).toHaveBeenCalledOnce();
  await act(async () => finish(true));
});

async function installDownload() {
  const ticket = await offlineLibrary.beginRefresh(user.id);
  await offlineLibrary.replaceDownload(ticket!, { schemaVersion: 1, accountId: user.id, songs: [], catalog: [], setlists: [] }, '"r1"');
}
const freshCheck = async () => { await offlineLibrary.db.state.update('current', { checkedAt: Date.now() }); return true; };

it('checks the download on start even when it was checked moments ago', async () => {
  await offlineLibrary.db.state.update('current', { checkedAt: Date.now() });
  render(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await waitFor(() => expect(downloadOfflineLibrary).toHaveBeenCalledOnce());
});
it('syncs after a change once the editor lets go', async () => {
  const view = render(<OfflineProvider><View playing /></OfflineProvider>);
  await act(async () => { screen.getByText('Changed').click(); });
  view.rerender(<OfflineProvider><View playing /></OfflineProvider>);
  expect(downloadOfflineLibrary).not.toHaveBeenCalled();
  expect(screen.getByText('save waiting')).toBeInTheDocument();
  view.rerender(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await waitFor(() => expect(downloadOfflineLibrary).toHaveBeenCalledOnce());
  view.rerender(<OfflineProvider><View playing={false} /></OfflineProvider>);
  expect(screen.getByText('saved')).toBeInTheDocument();
});
it('syncs again when a change lands during a sync', async () => {
  let finish!: (value: boolean) => void;
  vi.mocked(downloadOfflineLibrary).mockImplementationOnce(async () => { await freshCheck(); return new Promise(resolve => { finish = resolve; }); });
  render(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await waitFor(() => expect(downloadOfflineLibrary).toHaveBeenCalledOnce());
  await act(async () => { screen.getByText('Changed').click(); });
  await act(async () => finish(true));
  await waitFor(() => expect(downloadOfflineLibrary).toHaveBeenCalledTimes(2));
  await act(async () => { screen.getByText('Refresh').click(); });
  expect(screen.getByText('saved')).toBeInTheDocument();
});
it('shows viewing only when a sync cannot reach the server', async () => {
  await installDownload();
  vi.mocked(downloadOfflineLibrary).mockRejectedValue(new TypeError('Failed to fetch'));
  render(<OfflineProvider><View playing={false} /></OfflineProvider>);
  expect(await screen.findByText('read only')).toBeInTheDocument();
});
it('stays editable when a sync fails without any download', async () => {
  vi.mocked(downloadOfflineLibrary).mockRejectedValue(new TypeError('Failed to fetch'));
  render(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await waitFor(() => expect(downloadOfflineLibrary).toHaveBeenCalled());
  expect(screen.getByText('online')).toBeInTheDocument();
});
it('forgets a waiting save and viewing only when the account changes', async () => {
  await installDownload();
  vi.mocked(downloadOfflineLibrary).mockRejectedValue(new TypeError('Failed to fetch'));
  const view = render(<OfflineProvider><View playing={false} /></OfflineProvider>);
  await screen.findByText('read only');
  await act(async () => { screen.getByText('Changed').click(); });
  auth.user = { ...user, id: 8 };
  localStorage.setItem('cv_user', JSON.stringify(auth.user));
  view.rerender(<OfflineProvider><View playing={false} /></OfflineProvider>);
  expect(await screen.findByText('online')).toBeInTheDocument();
  expect(screen.getByText('saved')).toBeInTheDocument();
});
