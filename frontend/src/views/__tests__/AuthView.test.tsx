import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthView } from '../AuthView';
const { api, login } = vi.hoisted(() => ({ api: vi.fn(), login: vi.fn() }));
vi.mock('../../lib/api', () => ({ api }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ login }) }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
beforeEach(() => { vi.clearAllMocks(); api.mockImplementation((method: string) => method === 'GET' ? Promise.resolve({ allowRegistration: true }) : new Promise(() => {})); });
it('keeps one sign-in request pending and blocks repeated submits', async () => {
  render(<AuthView navigate={vi.fn()} />);
  await waitFor(() => expect(api).toHaveBeenCalledWith('GET', '/api/auth/config'));
  fireEvent.change(screen.getByLabelText('auth.username'), { target: { value: 'preview' } });
  fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'password' } });
  const button = document.querySelector('#auth-submit')!;
  fireEvent.click(button); fireEvent.click(button);
  expect(api.mock.calls.filter(call => call[0] === 'POST')).toHaveLength(1);
  expect(button).toBeDisabled();
});
it('shows backend failure and allows a subsequent attempt', async () => {
  api.mockImplementation((method: string) => method === 'GET' ? Promise.resolve({ allowRegistration: true }) : Promise.reject(new Error('Denied')));
  render(<AuthView navigate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('auth.username'), { target: { value: 'preview' } });
  fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'password' } });
  fireEvent.click(document.querySelector('#auth-submit')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('Denied');
  expect(document.querySelector('#auth-submit')).not.toBeDisabled();
});

it('keeps invite redemption distinct when registration is closed', async () => {
  api.mockImplementation((method: string) => method === 'GET'
    ? Promise.resolve({ allowRegistration: false, invitesEnabled: true })
    : Promise.resolve({ token: 'local-test-token' }));
  const navigate = vi.fn();
  render(<AuthView navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'auth.haveInvite' }));
  const invite = screen.getByLabelText('auth.inviteCode');
  expect(invite).toHaveFocus();
  fireEvent.change(invite, { target: { value: 'local-invite' } });
  fireEvent.change(screen.getByLabelText('auth.username'), { target: { value: 'preview' } });
  fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'password' } });
  fireEvent.click(document.querySelector('#auth-submit')!);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('browse'));
  expect(api).toHaveBeenCalledWith('POST', '/api/auth/redeem-invite', {
    code: 'local-invite', username: 'preview', password: 'password', turnstile_token: null,
  });
});

it('prefills the demo account in demo mode', async () => {
  api.mockImplementation((method: string) => method === 'GET' ? Promise.resolve({ allowRegistration: false, demoMode: true }) : new Promise(() => {}));
  render(<AuthView navigate={vi.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('auth.username')).toHaveValue('demo'));
  expect(screen.getByLabelText('auth.password')).toHaveValue('demopass123');
});

it('asks for the invite code under its field and sends nothing without it', async () => {
  api.mockImplementation((method: string) => method === 'GET' ? Promise.resolve({ allowRegistration: false, invitesEnabled: true }) : Promise.resolve({}));
  render(<AuthView navigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'auth.haveInvite' }));
  fireEvent.change(screen.getByLabelText('auth.username'), { target: { value: 'preview' } });
  fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'password' } });
  fireEvent.click(document.querySelector('#auth-submit')!);
  await waitFor(() => expect(screen.getByLabelText('auth.inviteCode')).toHaveAttribute('aria-invalid', 'true'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(api.mock.calls.filter(call => call[0] === 'POST')).toHaveLength(0);
});

it('signs in without an invite code', async () => {
  render(<AuthView navigate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('auth.username'), { target: { value: 'preview' } });
  fireEvent.change(screen.getByLabelText('auth.password'), { target: { value: 'password' } });
  fireEvent.click(document.querySelector('#auth-submit')!);
  await waitFor(() => expect(api).toHaveBeenCalledWith('POST', '/api/auth/login', { username: 'preview', password: 'password' }));
});
