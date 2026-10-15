import { modals } from '@mantine/modals';
import { confirmAction, errorMessage, notifyError } from '../errors';
import { showStatusNotification } from '../notifications';

vi.mock('../notifications', () => ({ showStatusNotification: vi.fn() }));
vi.mock('@mantine/modals', () => ({ modals: { openConfirmModal: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it('reads the message of anything that carries one', () => {
  expect(errorMessage(new Error('Boom'))).toBe('Boom');
  expect(errorMessage({ message: 'Plain object' })).toBe('Plain object');
});

it('falls back when there is no usable message', () => {
  expect(errorMessage(new Error(''), 'PDF export failed')).toBe('PDF export failed');
  expect(errorMessage('thrown text', 'Fallback')).toBe('Fallback');
  expect(errorMessage(null)).toBe('');
  expect(errorMessage(undefined, 'x')).toBe('x');
});

it('notifies the message as an error', () => {
  notifyError(new Error('Denied'));
  expect(showStatusNotification).toHaveBeenCalledWith('Denied', 'error');
});

const confirmWith = () => (modals.openConfirmModal as unknown as ReturnType<typeof vi.fn>).mock.lastCall![0];

it('asks first and runs only on confirm', async () => {
  const run = vi.fn().mockResolvedValue(undefined);
  confirmAction('Delete it?', run);
  expect(confirmWith().children).toBe('Delete it?');
  expect(run).not.toHaveBeenCalled();
  await confirmWith().onConfirm();
  expect(run).toHaveBeenCalledOnce();
  expect(showStatusNotification).not.toHaveBeenCalled();
});

it('shows a failed run as an error', async () => {
  confirmAction('Delete it?', () => Promise.reject(new Error('Nope')));
  await confirmWith().onConfirm();
  expect(showStatusNotification).toHaveBeenCalledWith('Nope', 'error');
});
