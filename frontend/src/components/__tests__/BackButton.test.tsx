import { fireEvent, render, screen } from '@testing-library/react';
import { BackButton } from '../BackButton';

it('is a labelled button with an arrow icon', () => {
  const onClick = vi.fn();
  render(<BackButton onClick={onClick}>Back</BackButton>);
  const button = screen.getByRole('button', { name: 'Back' });
  expect(button.querySelector('svg')).not.toBeNull();
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalled();
});
