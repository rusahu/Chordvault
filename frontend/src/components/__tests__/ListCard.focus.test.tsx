import { render, screen } from '@testing-library/react';
import { ListCard } from '../ListCard';

it('always shows the Mantine focus ring', () => {
  render(<ListCard title="Row" onClick={vi.fn()} />);
  expect(screen.getByRole('button', { name: /Row/ })).toHaveClass('song-card', 'mantine-focus-auto');
});
