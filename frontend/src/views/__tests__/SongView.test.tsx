import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { SongView } from '../SongView';
import { TestWrapper } from '../../test/wrappers';
import { ApiError } from '../../lib/api';
import type { Song } from '../../types';

const { reads, offline, apiCall } = vi.hoisted(() => ({
  apiCall: vi.fn(),
  reads: { getSong: vi.fn(), getVersions: vi.fn(async () => []) },
  offline: { readOnly: false, state: { revision: '"r1"' } as { revision: string } | undefined },
}));
vi.mock('../../hooks/useLibraryRead', () => ({ useLibraryRead: () => reads }));
vi.mock('../../context/OfflineContext', () => ({ useOffline: () => offline }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => apiCall }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key, tReplace: (key: string) => key }) }));

const song = (title: string): Song => ({ id: 3, title, artist: '', content: `{title: ${title}}\n[G]Grace`, visibility: 'public', username: 'someone', language: 'en' } as Song);
const show = () => render(<TestWrapper><SongView songId={3} navigate={vi.fn()} /></TestWrapper>);
const newDownload = (view: ReturnType<typeof show>, revision: string) => {
  offline.state = { revision };
  view.rerender(<TestWrapper><SongView songId={3} navigate={vi.fn()} /></TestWrapper>);
};

beforeEach(() => { vi.clearAllMocks(); reads.getSong.mockReset(); offline.state = { revision: '"r1"' }; });

it('updates the open song when the download changes without blanking it', async () => {
  let finish!: (value: Song) => void;
  reads.getSong.mockResolvedValueOnce(song('First Title')).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = show();
  expect(await screen.findAllByText('First Title')).not.toHaveLength(0);
  newDownload(view, '"r2"');
  expect(reads.getSong).toHaveBeenCalledTimes(2);
  expect(screen.queryByLabelText('common.loading')).toBeNull();
  expect(screen.getAllByText('First Title')).not.toHaveLength(0);
  await act(async () => finish(song('Second Title')));
  expect(screen.getAllByText('Second Title')).not.toHaveLength(0);
});

it('keeps the shown song when a refresh cannot reach the server', async () => {
  reads.getSong.mockResolvedValueOnce(song('First Title')).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const view = show();
  await screen.findAllByText('First Title');
  await act(async () => newDownload(view, '"r2"'));
  expect(screen.getAllByText('First Title')).not.toHaveLength(0);
});

it('shows the error when a refreshed song is gone', async () => {
  reads.getSong.mockResolvedValueOnce(song('First Title')).mockRejectedValueOnce(new ApiError('Song not found', 404));
  const view = show();
  await screen.findAllByText('First Title');
  await act(async () => newDownload(view, '"r2"'));
  expect(await screen.findByText('Song not found')).toBeInTheDocument();
  expect(screen.queryByText('First Title')).toBeNull();
});
