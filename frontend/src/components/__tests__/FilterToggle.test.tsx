import { fireEvent, render, screen } from '@testing-library/react';
import { FilterToggle } from '../FilterToggle';

it('is a pressed toggle that fills when pressed or when filters are active', () => {
  const onToggle = vi.fn();
  const { rerender } = render(<FilterToggle label="Filter by date" icon={<span />} pressed={false} onToggle={onToggle} />);
  const button = screen.getByRole('button', { name: 'Filter by date' });
  expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(button).toHaveAttribute('data-variant', 'default');
  fireEvent.click(button);
  expect(onToggle).toHaveBeenCalledOnce();
  rerender(<FilterToggle label="Filter by date" icon={<span />} pressed={false} active onToggle={onToggle} />);
  expect(button).toHaveAttribute('data-variant', 'filled');
  rerender(<FilterToggle label="Filter by date" icon={<span />} pressed onToggle={onToggle} />);
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button).toHaveAttribute('data-variant', 'filled');
});
