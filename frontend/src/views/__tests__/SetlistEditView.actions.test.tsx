import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SetlistEditView } from '../SetlistEditView';

// Stable mock references: load() is a useCallback over them.
const { api, toast, auth, t } = vi.hoisted(() => ({
  api: vi.fn(), toast: vi.fn(), auth: { user: null as { id: number } | null }, t: (key: string) => key,
}));
vi.mock('../../hooks/useApi', () => ({ useApi: () => api }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: toast }));
vi.mock('../../components/SongPicker', () => ({
  SongPicker: ({ opened, onPick }: { opened: boolean; onPick: (song: { id: number; title: string; artist: string }) => void }) =>
    opened ? <button onClick={() => onPick({ id: 9, title: 'Picked', artist: 'Band' })}>pick song</button> : null,
}));

const grace = { song_id: 3, title: 'Grace', artist: '', target_key: null, nashville: 0 };
const cloudSetlist = () => ({
  id: 1, user_id: 1, name: 'Sunday', visibility: 'private', event_date: null,
  entries: [{ ...grace, entry_id: 11, content: '{key: C}\n[C]a', content_override: null }],
});
const stored = () => JSON.parse(localStorage.getItem('cv_local_setlists')!);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth.user = null;
  api.mockImplementation((method: string) => Promise.resolve(method === 'GET' ? cloudSetlist() : {}));
  localStorage.setItem('cv_local_setlists', JSON.stringify([{ id: 'local_1', name: 'Mine', entries: [grace] }]));
});

const open = async (setlistId: number | string, name: string) => {
  const navigate = vi.fn();
  render(<SetlistEditView setlistId={setlistId} navigate={navigate} />);
  await screen.findByDisplayValue(name);
  return navigate;
};
const pickSong = () => {
  fireEvent.click(screen.getByRole('button', { name: 'setlist.addSongs' }));
  fireEvent.click(screen.getByRole('button', { name: 'pick song' }));
};
const rename = (from: string, to: string) => {
  const input = screen.getByDisplayValue(from);
  fireEvent.change(input, { target: { value: to } });
  fireEvent.blur(input);
};
const confirmDelete = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'admin.delete' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
};

describe('cloud setlist', () => {
  beforeEach(() => { auth.user = { id: 1 }; });

  it('adds a picked song with only its id', async () => {
    await open(1, 'Sunday');
    pickSong();
    await waitFor(() => expect(api).toHaveBeenCalledWith('POST', '/api/setlists/1/songs', { song_id: 9 }));
    expect(toast).toHaveBeenCalledWith('setlist.songAdded', 'success');
  });

  it('removes an entry by its id', async () => {
    await open(1, 'Sunday');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('DELETE', '/api/setlists/1/entries/11'));
    await waitFor(() => expect(screen.queryByText('Grace')).toBeNull());
  });

  it('saves the name, visibility and date together', async () => {
    await open(1, 'Sunday');
    rename('Sunday', 'Easter');
    await waitFor(() => expect(api).toHaveBeenCalledWith('PUT', '/api/setlists/1', { name: 'Easter', visibility: 'private', event_date: '' }));
  });

  it('deletes after confirming and returns to My Setlists', async () => {
    const navigate = await open(1, 'Sunday');
    await confirmDelete();
    await waitFor(() => expect(api).toHaveBeenCalledWith('DELETE', '/api/setlists/1'));
    await waitFor(() => expect(navigate).toHaveBeenLastCalledWith('setlists', {}, { replace: true }));
  });

  it('reports a failed write with the server message', async () => {
    api.mockImplementation((method: string) => method === 'GET' ? Promise.resolve(cloudSetlist()) : Promise.reject(new Error('Setlist not found')));
    await open(1, 'Sunday');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Setlist not found', 'error'));
    expect(screen.getByText('Grace')).toBeInTheDocument();
  });
});

describe('local setlist', () => {
  it('adds a picked song as a stored entry', async () => {
    await open('local_1', 'Mine');
    pickSong();
    await waitFor(() => expect(stored()[0].entries[1]).toEqual({ song_id: 9, title: 'Picked', artist: 'Band', target_key: null, nashville: 0 }));
    expect(api).not.toHaveBeenCalled();
  });

  it('removes an entry by position', async () => {
    await open('local_1', 'Mine');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(stored()[0].entries).toEqual([]));
  });

  it('renames in storage', async () => {
    await open('local_1', 'Mine');
    rename('Mine', 'Renamed');
    await waitFor(() => expect(stored()[0].name).toBe('Renamed'));
  });

  it('reports a full setlist as Failed to add song', async () => {
    localStorage.setItem('cv_local_setlists', JSON.stringify([{ id: 'local_1', name: 'Mine', entries: Array(100).fill(grace) }]));
    await open('local_1', 'Mine');
    pickSong();
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Failed to add song', 'error'));
  });

  it.each<[{ id: number } | null, string]>([[null, 'public-setlists'], [{ id: 1 }, 'setlists']])(
    'deletes and, with user %o, returns to %s (owner decision 4)', async (user, view) => {
      auth.user = user;
      const navigate = await open('local_1', 'Mine');
      await confirmDelete();
      await waitFor(() => expect(navigate).toHaveBeenLastCalledWith(view, {}, { replace: true }));
      expect(stored()).toEqual([]);
    });
});
