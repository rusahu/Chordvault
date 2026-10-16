import userEvent from '@testing-library/user-event';
import { act, render, screen, within } from '@testing-library/react';
import { EditorPreview } from '../EditorPreview';

const SONG = '{key: C}\n[C]Amazing [G]grace';
const chords = (container: HTMLElement) => [...container.querySelectorAll('.chord')].map(c => c.textContent).filter(Boolean);
afterEach(() => vi.useRealTimers());

it('flushes on a preview trigger including zero, then keeps subsequent edits debounced', () => {
  vi.useFakeTimers();
  const { rerender } = render(<EditorPreview content="First" forceRender={0} />);
  expect(screen.getByText('First')).toBeInTheDocument();
  rerender(<EditorPreview content="Latest" forceRender={0} />);
  expect(screen.queryByText('Latest')).not.toBeInTheDocument();
  rerender(<EditorPreview content="Latest" forceRender={1} />);
  expect(screen.getByText('Latest')).toBeInTheDocument();
  rerender(<EditorPreview content="Afterwards" forceRender={1} />);
  expect(screen.queryByText('Afterwards')).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByText('Afterwards')).toBeInTheDocument();
  expect(screen.queryByText('Latest')).not.toBeInTheDocument();
});

it('transposes with the song page key picker and shows the key it plays in', async () => {
  const { container } = render(<EditorPreview content={SONG} />);
  expect(screen.getByTestId('key-display')).toHaveTextContent('Key C');
  await userEvent.click(screen.getByTestId('key-display'));
  await userEvent.click(within(screen.getByRole('group', { name: 'Transpose key' })).getByRole('button', { name: 'D' }));
  expect(chords(container)).toEqual(['D', 'A']);
  expect(screen.getByTestId('key-display')).toHaveTextContent('Key D');
  await userEvent.click(screen.getByRole('button', { name: 'Reset transpose' }));
  expect(chords(container)).toEqual(['C', 'G']);
  expect(screen.queryByRole('button', { name: 'Reset transpose' })).not.toBeInTheDocument();
});

it('offers numbers only for a song that declares its key', async () => {
  const { container, rerender } = render(<EditorPreview content="[G]Amazing grace" />);
  expect(screen.getByRole('button', { name: 'Number notation' })).toBeDisabled();
  expect(screen.getByTestId('key-display')).toHaveTextContent('Key G');
  rerender(<EditorPreview content={SONG} forceRender={1} />);
  await userEvent.click(screen.getByRole('button', { name: 'Number notation' }));
  expect(chords(container)).toEqual(['1', '5']);
});
