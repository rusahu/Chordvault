import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminView } from '../AdminView';
import { showStatusNotification } from '../../lib/notifications';

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => api }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, role: 'owner' }, isAdmin: true }) }));
vi.mock('../../context/DemoContext', () => ({ useDemo: () => ({ demoMode: false }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key, tReplace: (key: string) => key }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: vi.fn() }));

beforeEach(() => {
  vi.mocked(showStatusNotification).mockClear();
  api.mockReset();
  api.mockImplementation((method: string, path: string) => {
    if (method !== 'GET') return new Promise(() => {});
    if (path.endsWith('/admin/tags')) return Promise.resolve({ tags: [], isDefault: true });
    if (path.endsWith('/stats')) return Promise.resolve({ userCount: 2, songCount: 0, pendingCount: 0, noFormatCount: 0, recentSongs: [] });
    if (path.endsWith('/users')) return Promise.resolve([{ id: 2, username: 'member', role: 'user', song_count: 0, created_at: '2026-01-01', disabled: false }]);
    if (path.endsWith('/config')) return Promise.resolve({ allowRegistration: true });
    return Promise.resolve([]);
  });
});

it('cancel does not write and a confirmed pending role change cannot submit twice', async () => {
  render(<AdminView navigate={vi.fn()} />);
  const promote = await screen.findByRole('button', { name: 'admin.promote' });
  fireEvent.click(promote);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  expect(api.mock.calls.filter(call => call[0] !== 'GET')).toHaveLength(0);
  fireEvent.click(promote);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('PUT', '/api/admin/users/2/role', { role: 'admin' }));
  expect(promote).toBeDisabled();
  fireEvent.click(promote);
  expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  expect(api.mock.calls.filter(call => call[0] !== 'GET')).toHaveLength(1);
});

it.each(['{Enter}', ' '])('navigates cards with %s and keeps nested Delete activation separate', async (key) => {
  api.mockImplementation((_method: string, path: string) => {
    if (path.endsWith('/stats')) return Promise.resolve({ userCount: 1, songCount: 1, pendingCount: 1, noFormatCount: 0, recentSongs: [{ id: 7, title: 'Recent song', username: 'owner', created_at: '2026-01-01' }] });
    if (path.endsWith('/corrections')) return Promise.resolve([{ id: 8, parent_id: 9, title: 'Correction song', submitter: 'member', created_at: '2026-01-01' }]);
    if (path.endsWith('/config')) return Promise.resolve({ allowRegistration: true });
    return Promise.resolve([]);
  });
  const navigate = vi.fn();
  render(<AdminView navigate={navigate} />);
  const recent = await screen.findByRole('button', { name: /Recent song/ });
  recent.focus();
  await userEvent.keyboard(key);
  expect(navigate).toHaveBeenCalledExactlyOnceWith('song-view', { id: '7' });
  navigate.mockClear();
  const correction = screen.getByRole('button', { name: /Correction song/ });
  correction.focus();
  await userEvent.keyboard(key);
  expect(navigate).toHaveBeenCalledExactlyOnceWith('song-view', { id: '9' });
  navigate.mockClear();
  within(recent).getByRole('button', { name: 'admin.delete' }).focus();
  await userEvent.keyboard(key);
  expect(await screen.findByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  expect(navigate).not.toHaveBeenCalled();
  expect(api.mock.calls.filter(([method]) => method !== 'GET')).toHaveLength(0);
});

it('reports a failed write once and frees the action for a retry', async () => {
  const read = api.getMockImplementation()!;
  api.mockImplementation((method: string, path: string) => method === 'GET' ? read(method, path) : Promise.reject(new Error('Write failed')));
  render(<AdminView navigate={vi.fn()} />);
  const promote = await screen.findByRole('button', { name: 'admin.promote' });
  fireEvent.click(promote);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(showStatusNotification).toHaveBeenCalledWith('Write failed', 'error'));
  expect(showStatusNotification).toHaveBeenCalledOnce();
  await waitFor(() => expect(promote).toBeEnabled());
});
