import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MAX_SETLIST_NAME_LENGTH } from '../../lib/constants';
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

const create = async (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'setlist.newSetlist' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Setlist name'), { target: { value: name } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create setlist' }));
};

it('asks for the name in a dialog that refuses a blank or overlong name', async () => {
  render(<SetlistsView navigate={vi.fn()} />);
  expect(screen.queryByLabelText('Setlist name')).toBeNull();
  expect(screen.queryByPlaceholderText('setlist.namePlaceholder')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'setlist.newSetlist' }));
  const dialog = await screen.findByRole('dialog');
  const input = within(dialog).getByLabelText('Setlist name');
  await waitFor(() => expect(input).toHaveFocus());
  expect(input).toHaveAttribute('maxlength', String(MAX_SETLIST_NAME_LENGTH));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create setlist' }));
  expect(await within(dialog).findByText('Enter a setlist name')).toBeInTheDocument();
  expect(localStorage.getItem('cv_local_setlists')).toBeNull();
});

it('creates a cloud setlist and opens it', async () => {
  auth.user = { id: 1 };
  const navigate = vi.fn();
  render(<SetlistsView navigate={navigate} />);
  await create('  Easter  ');
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('setlist-edit', { id: '7' }));
  expect(api).toHaveBeenCalledWith('POST', '/api/setlists', { name: 'Easter' });
  expect(toast).toHaveBeenCalledWith('setlist.created', 'success');
});

it('creates a local setlist when signed out', async () => {
  const navigate = vi.fn();
  render(<SetlistsView navigate={navigate} />);
  await create('Mine');
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('setlist-edit', { id: expect.stringMatching(/^local_\d+$/) }));
  expect(JSON.parse(localStorage.getItem('cv_local_setlists')!)[0]).toMatchObject({ name: 'Mine', entries: [] });
  expect(api).not.toHaveBeenCalled();
});

it('refuses a 51st local setlist', async () => {
  localStorage.setItem('cv_local_setlists', JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ id: `local_${i}`, name: `S${i}`, entries: [] }))));
  const navigate = vi.fn();
  render(<SetlistsView navigate={navigate} />);
  await create('One more');
  await waitFor(() => expect(toast).toHaveBeenCalledWith('Max 50 setlists', 'error'));
  expect(navigate).not.toHaveBeenCalled();
});
