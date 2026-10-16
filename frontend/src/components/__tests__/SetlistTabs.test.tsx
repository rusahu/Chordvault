import { fireEvent, render, screen } from '@testing-library/react';
import { SetlistTabs } from '../SetlistTabs';

it('switches between my and public setlists', () => {
  const navigate = vi.fn();
  const { rerender } = render(<SetlistTabs value="mine" navigate={navigate} />);
  expect(screen.getByRole('radiogroup')).toHaveAccessibleName();
  expect(screen.getByRole('radio', { name: 'My Setlists' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Public Setlists' }));
  expect(navigate).toHaveBeenLastCalledWith('public-setlists');
  rerender(<SetlistTabs value="public" navigate={navigate} />);
  fireEvent.click(screen.getByRole('radio', { name: 'My Setlists' }));
  expect(navigate).toHaveBeenLastCalledWith('setlists');
});
