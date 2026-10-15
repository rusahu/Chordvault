import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { modals } from '@mantine/modals';
import { AddToSetlistModal } from '../AddToSetlistModal';
import { SongPicker } from '../SongPicker';

const { api, localSetlists, auth, toast } = vi.hoisted(() => ({
  api: vi.fn(),
  toast: vi.fn(),
  auth: { user: null as { id: number; token: string } | null },
  localSetlists: { setlists: [] as { id: string; name: string; entries: unknown[] }[], addEntry: vi.fn(), create: vi.fn() },
}));
vi.mock('../../hooks/useApi', () => ({ useApi: () => api }));
vi.mock('../../hooks/useLocalSetlists', () => ({ useLocalSetlists: () => localSetlists }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key, tReplace: (key: string) => key }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: toast }));

beforeEach(() => { api.mockReset(); api.mockResolvedValue([]); auth.user = null; toast.mockReset(); localSetlists.setlists = []; localSetlists.addEntry.mockReset(); });

it.each(['picker', 'add'] as const)('%s retains its shell and restores opener focus on Escape', async (kind) => {
  function Harness() {
    const [opened, setOpened] = useState(false);
    const close = () => setOpened(false);
    return <><button onClick={() => setOpened(true)}>Open songs</button>{kind === 'picker'
      ? <SongPicker opened={opened} onPick={vi.fn()} onClose={close} />
      : <AddToSetlistModal isOpen={opened} onClose={close} songId={1} songTitle="Song" songArtist="Artist" targetKey={null} nashville={false} />}</>;
  }
  render(<Harness />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const opener = screen.getByRole('button', { name: 'Open songs' });
  await userEvent.click(opener);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  if (kind === 'picker') await userEvent.type(screen.getByRole('searchbox'), 'old query');
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(opener).toHaveFocus());
  await userEvent.click(opener);
  if (kind === 'picker') expect(screen.getByRole('searchbox')).toHaveValue('');
});

it.each([
  ['setlistName', 'Setlist name'],
  ['resetPassword', 'New password'],
])('%s context modal focuses its input and restores its opener', async (modal, label) => {
  render(<button onClick={() => modals.openContextModal({ modal, innerProps: { onSubmit: vi.fn() } })}>Open prompt</button>);
  const opener = screen.getByRole('button', { name: 'Open prompt' });
  await userEvent.click(opener);
  await waitFor(() => expect(screen.getByLabelText(label)).toHaveFocus());
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(opener).toHaveFocus());
});

it('an earlier add request cannot dismiss or notify over a reopened dialog', async () => {
  auth.user = { id: 1, token: 'test-token' };
  let finishAdd!: () => void;
  api.mockImplementation((method: string) => method === 'GET'
    ? Promise.resolve([{ id: 1, name: 'Target setlist', song_count: 0, visibility: 'private' }])
    : new Promise<void>((resolve) => { finishAdd = resolve; }));
  function Harness() {
    const [opened, setOpened] = useState(false);
    return <><button onClick={() => setOpened(true)}>Open songs</button><AddToSetlistModal isOpen={opened} onClose={() => setOpened(false)} songId={1} songTitle="Song" songArtist="Artist" targetKey={null} nashville={false} /></>;
  }
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Open songs' });
  await userEvent.click(opener);
  await userEvent.click(await screen.findByText('Target setlist'));
  await waitFor(() => expect(api).toHaveBeenCalledWith('POST', '/api/setlists/1/songs', expect.any(Object)));
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(opener).toHaveFocus());
  await userEvent.click(opener);
  await act(async () => { finishAdd(); });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(toast).not.toHaveBeenCalled();
});

it.each(['{Enter}', ' '])('selects a song with %s exactly once', async (key) => {
  const song = { id: 7, title: 'Keyboard song', artist: '', version_count: 1 };
  api.mockResolvedValue([song]);
  const pick = vi.fn();
  render(<SongPicker opened onPick={pick} onClose={vi.fn()} />);
  const card = await screen.findByRole('button', { name: 'Keyboard song' });
  card.focus();
  await userEvent.keyboard(key);
  expect(pick).toHaveBeenCalledExactlyOnceWith(song);
});

it.each(['{Enter}', ' '])('adds to an existing local setlist with %s exactly once', async (key) => {
  localSetlists.setlists = [{ id: 'local-1', name: 'Keyboard setlist', entries: [] }];
  localSetlists.addEntry.mockReturnValue(true);
  const close = vi.fn();
  render(<AddToSetlistModal isOpen onClose={close} songId={7} songTitle="Song" songArtist="Artist" targetKey={null} nashville={false} />);
  const card = await screen.findByRole('button', { name: /Keyboard setlist/ });
  card.focus();
  await userEvent.keyboard(key);
  expect(localSetlists.addEntry).toHaveBeenCalledOnce();
  expect(localSetlists.addEntry).toHaveBeenCalledWith('local-1', expect.objectContaining({ song_id: 7 }));
  expect(close).toHaveBeenCalledOnce();
});

it('opens the new-setlist prompt from its keyboard card', async () => {
  render(<AddToSetlistModal isOpen onClose={vi.fn()} songId={7} songTitle="Song" songArtist="Artist" targetKey={null} nashville={false} />);
  await waitFor(() => expect(screen.getByRole('dialog').querySelector('.mantine-Modal-close')).toHaveFocus());
  screen.getByRole('button', { name: 'setlist.newSetlist' }).focus();
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByLabelText('Setlist name')).toBeInTheDocument();
});

it('labels the expanded version selector and picks the chosen arrangement', async () => {
  const song = { id: 7, title: 'Amazing Grace', artist: 'John Newton', version_count: 2 };
  api.mockImplementation((_method: string, path: string) => Promise.resolve(path.endsWith('/versions')
    ? [{ id: 7, username: 'original' }, { id: 8, username: 'arranger' }] : [song]));
  const pick = vi.fn();
  render(<SongPicker opened onPick={pick} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: /Amazing Grace/ }));
  await userEvent.selectOptions(await screen.findByLabelText('Version'), '8');
  expect(pick).toHaveBeenCalledExactlyOnceWith({ ...song, id: 8, username: 'arranger' });
});
