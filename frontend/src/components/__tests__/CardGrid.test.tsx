import { render } from '@testing-library/react';
import { CardGrid } from '../CardGrid';

it('renders the song grid and forwards extra props', () => {
  const { container } = render(<CardGrid mb={28}><span>card</span></CardGrid>);
  const grid = container.querySelector('.song-grid') as HTMLElement;
  expect(grid).toHaveTextContent('card');
  expect(grid.getAttribute('style')).toContain('margin-bottom');
});
