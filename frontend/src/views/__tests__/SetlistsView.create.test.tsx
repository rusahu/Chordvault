import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SetlistsView } from '../SetlistsView';

const { api, toast, auth } = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn(), auth: { user: null as { id: number } | null } }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => api }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: toast }));

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); auth.user = null;
  api.mockImplementation((method: string) => Promise.resolve(method === 'POST' ? { id: 7 } : { setlists: [], page: 1, totalPages: 1 }));
});

const create = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'setlist.newSetlist' }));
  fireEvent.change(screen.getByLabelText('setlist.namePlaceholder'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'setlist.create' }));
};

it('creates a cloud setlist and opens it', async () => {
  auth.user = { id: 1 };
  const navigate = vi.fn();
  render(<SetlistsView navigate={navigate} />);
  create('  Easter  ');
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('setlist-edit', { id: '7' }));
  expect(api).toHaveBeenCalledWith('POST', '/api/setlists', { name: 'Easter' });
  expect(toast).toHaveBeenCalledWith('setlist.created', 'success');
});

it('creates a local setlist when signed out', async () => {
  const navigate = vi.fn();
  render(<SetlistsView navigate={navigate} />);
  create('Mine');
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('setlist-edit', { id: expect.stringMatching(/^local_\d+$/) }));
  expect(JSON.parse(localStorage.getItem('cv_local_setlists')!)[0]).toMatchObject({ name: 'Mine', entries: [] });
  expect(api).not.toHaveBeenCalled();
});

it('refuses a 51st local setlist', async () => {
  localStorage.setItem('cv_local_setlists', JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ id: `local_${i}`, name: `S${i}`, entries: [] }))));
  const navigate = vi.fn();
  render(<SetlistsView navigate={navigate} />);
  create('One more');
  await waitFor(() => expect(toast).toHaveBeenCalledWith('Max 50 setlists', 'error'));
  expect(navigate).not.toHaveBeenCalled();
});
