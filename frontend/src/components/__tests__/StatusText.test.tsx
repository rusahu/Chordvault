import { render, screen } from '@testing-library/react';
import { StatusText } from '../StatusText';

it('announces success as status and failure as alert', () => {
  const { rerender } = render(<StatusText status={{ text: 'Saved', error: false }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Saved');
  rerender(<StatusText status={{ text: 'Nope', error: true }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Nope');
  rerender(<StatusText status={null} />);
  expect(screen.queryByRole('alert')).toBeNull();
});
