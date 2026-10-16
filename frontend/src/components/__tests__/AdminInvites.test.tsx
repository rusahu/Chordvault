import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminInvites } from '../AdminInvites';

const { api, demo, toast } = vi.hoisted(() => ({ api: vi.fn(), demo: { demoMode: false }, toast: vi.fn() }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => api }));
vi.mock('../../context/DemoContext', () => ({ useDemo: () => demo }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (k: string) => k, tReplace: (k: string) => k }) }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: toast }));

const invite = (id: number, code: string, used_at: string | null = null) => ({ id, code, created_at: '2026-01-01', used_at });
let invites: ReturnType<typeof invite>[];
let config: Promise<{ allowRegistration: boolean }>;

beforeEach(() => {
  api.mockReset(); toast.mockReset(); demo.demoMode = false;
  invites = [invite(1, 'OLDCODE'), invite(2, 'USEDCODE', '2026-01-02')];
  config = Promise.resolve({ allowRegistration: true });
  api.mockImplementation((method: string, path: string) => {
    if (path === '/api/admin/config') return method === 'GET' ? config : Promise.resolve({});
    if (method === 'POST') { invites = [...invites, invite(3, 'NEWCODE')]; return Promise.resolve({ code: 'NEWCODE' }); }
    if (method === 'DELETE') { invites = invites.filter(i => !path.endsWith(`/${i.id}`)); return Promise.resolve({}); }
    return Promise.resolve(invites);
  });
});
const deleteButtons = () => screen.queryAllByRole('button', { name: 'admin.delete' });

it('lists only pending invites, generates a code and reloads the list', async () => {
  render(<AdminInvites />);
  expect(await screen.findByText('OLDCODE')).toBeInTheDocument();
  expect(screen.queryByText('USEDCODE')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'admin.generateInvite' }));
  await waitFor(() => expect(deleteButtons()).toHaveLength(2));
  expect(screen.getAllByText('NEWCODE')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'admin.copy' })).toBeInTheDocument();
});

it('deletes a pending invite', async () => {
  render(<AdminInvites />);
  await screen.findByText('OLDCODE');
  fireEvent.click(deleteButtons()[0]);
  await waitFor(() => expect(screen.queryByText('OLDCODE')).not.toBeInTheDocument());
  expect(api).toHaveBeenCalledWith('DELETE', '/api/admin/invites/1');
});

it('toggles registration through the config endpoint', async () => {
  render(<AdminInvites />);
  const toggle = await screen.findByRole('switch', { name: 'Open Registration' });
  expect(toggle).toBeChecked();
  fireEvent.click(toggle);
  await waitFor(() => expect(toast).toHaveBeenCalledWith('Registration disabled', 'success'));
  expect(api).toHaveBeenCalledWith('PUT', '/api/admin/config', { allowRegistration: false });
  expect(toggle).not.toBeChecked();
  expect(screen.getByText(/Registration is closed/)).toBeInTheDocument();
});

it('shows invites while the config request fails and hides the switch until config loads', async () => {
  config = Promise.reject(new Error('down'));
  render(<AdminInvites />);
  expect(await screen.findByText('OLDCODE')).toBeInTheDocument();
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  expect(screen.queryByText(/Registration is closed|Anyone can create/)).not.toBeInTheDocument();
});

it('disables the switch, generate and invite delete in demo mode', async () => {
  demo.demoMode = true;
  render(<AdminInvites />);
  expect(await screen.findByRole('switch', { name: 'Open Registration' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'admin.generateInvite' })).toBeDisabled();
  await waitFor(() => expect(deleteButtons()).toHaveLength(1));
  expect(deleteButtons()[0]).toBeDisabled();
  expect(screen.getByText('common.demoDisabled')).toBeInTheDocument();
});
