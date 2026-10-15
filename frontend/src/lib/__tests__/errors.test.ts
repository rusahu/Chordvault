import { errorMessage, notifyError } from '../errors';
import { showStatusNotification } from '../notifications';

vi.mock('../notifications', () => ({ showStatusNotification: vi.fn() }));

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
