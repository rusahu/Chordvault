import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CorrectionView } from '../CorrectionView';

const { api, toast } = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn() }));
vi.mock('../../hooks/useApi', () => ({ useApi: () => api }));
vi.mock('../../lib/notifications', () => ({ showStatusNotification: toast }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../components/CodeMirrorEditor', () => ({
  CodeMirrorEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <textarea aria-label="editor" value={value} onChange={(e) => onChange(e.target.value)} />,
}));

beforeEach(() => vi.clearAllMocks());

it('reports a load failure and leaves', async () => {
  api.mockRejectedValue(new Error('Song not found'));
  const navigate = vi.fn();
  render(<CorrectionView songId={3} navigate={navigate} />);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('browse', {}, { leave: true }));
  expect(toast).toHaveBeenCalledWith('Song not found', 'error');
});

it('reports a rejected submission with the server message', async () => {
  const content = '{title: T}\n{key: C}\n[C]a';
  api.mockImplementation((method: string) => method === 'GET' ? Promise.resolve({ content }) : Promise.reject(new Error('Too many corrections')));
  render(<CorrectionView songId={3} navigate={vi.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('editor')).toHaveValue(content));
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith('Too many corrections', 'error'));
});
