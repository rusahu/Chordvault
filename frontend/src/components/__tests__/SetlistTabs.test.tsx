import { fireEvent, render, screen } from '@testing-library/react';
import { SetlistTabs } from '../SetlistTabs';

it('switches between my and public setlists', () => {
  const navigate = vi.fn();
  const { rerender } = render(<SetlistTabs value="mine" navigate={navigate} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Public Setlists' }));
  expect(navigate).toHaveBeenLastCalledWith('public-setlists');
  rerender(<SetlistTabs value="public" navigate={navigate} />);
  fireEvent.click(screen.getByRole('tab', { name: 'My Setlists' }));
  expect(navigate).toHaveBeenLastCalledWith('setlists');
});
