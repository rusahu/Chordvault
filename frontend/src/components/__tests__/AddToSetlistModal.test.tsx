import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToSetlistModal } from '../AddToSetlistModal';

const { api, toast, auth } = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn(), auth: { user: null as { id: number } | null } }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => api }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: toast }));

const props = { isOpen: true, onClose: vi.fn(), songId: 7, songTitle: 'Song', songArtist: 'Artist', targetKey: 'D', nashville: true };

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); auth.user = null; });
afterEach(() => vi.restoreAllMocks());

const createNamed = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name: 'setlist.newSetlist' }));
  await userEvent.type(await screen.findByLabelText('Setlist name'), name);
  await userEvent.click(screen.getByRole('button', { name: 'Create setlist' }));
};

it('sends the picked key and number setting to a cloud setlist', async () => {
  auth.user = { id: 1 };
  api.mockImplementation((method: string) => Promise.resolve(method === 'GET' ? [{ id: 3, name: 'Sunday', song_count: 0, visibility: 'private' }] : {}));
  render(<AddToSetlistModal {...props} />);
  await userEvent.click(await screen.findByText('Sunday'));
  await waitFor(() => expect(api).toHaveBeenCalledWith('POST', '/api/setlists/3/songs', { song_id: 7, target_key: 'D', nashville: true }));
  expect(props.onClose).toHaveBeenCalledOnce();
});

it('creates a cloud setlist, then adds the song to it', async () => {
  auth.user = { id: 1 };
  api.mockImplementation((method: string, path: string) => Promise.resolve(method === 'GET' ? [] : path === '/api/setlists' ? { id: 4 } : {}));
  render(<AddToSetlistModal {...props} />);
  await createNamed('Easter');
  await waitFor(() => expect(api).toHaveBeenCalledWith('POST', '/api/setlists/4/songs', { song_id: 7, target_key: 'D', nashville: true }));
  expect(api).toHaveBeenCalledWith('POST', '/api/setlists', { name: 'Easter' });
});

it('stores the pick on a new local setlist', async () => {
  render(<AddToSetlistModal {...props} />);
  await createNamed('Mine');
  await waitFor(() => expect(JSON.parse(localStorage.getItem('cv_local_setlists')!)[0]).toMatchObject({
    name: 'Mine', entries: [{ song_id: 7, title: 'Song', artist: 'Artist', target_key: 'D', nashville: 1 }],
  }));
  expect(toast).toHaveBeenCalledWith('setlist.songAdded', 'success');
});

it('says Max 50 setlists when a local create is refused offline (owner decision 3)', async () => {
  render(<AddToSetlistModal {...props} />);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await createNamed('Mine');
  await waitFor(() => expect(toast).toHaveBeenCalledWith('Max 50 setlists', 'error'));
  expect(localStorage.getItem('cv_local_setlists')).toBeNull();
});
