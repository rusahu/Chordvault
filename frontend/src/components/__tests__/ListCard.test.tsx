import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@mantine/core';
import { ListCard } from '../ListCard';

const renderCard = (props: Partial<React.ComponentProps<typeof ListCard>> = {}) => {
  const onClick = vi.fn();
  const utils = render(<ListCard title="Amazing Grace" meta="John Newton" onClick={onClick} {...props} />);
  return { onClick, ...utils };
};

describe('ListCard', () => {
  it('leaves the meta colour to CSS so a hovered card can brighten it', () => {
    renderCard();
    expect(screen.getByText('John Newton').style.color).toBe('');
  });

  it('shows the title and meta', () => {
    renderCard();
    expect(screen.getByText('Amazing Grace')).toBeInTheDocument();
    expect(screen.getByText('John Newton')).toBeInTheDocument();
  });

  it('opens on Enter and Space', () => {
    const { onClick } = renderCard();
    const card = screen.getByRole('button', { name: /Amazing Grace/ });
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('ignores keys pressed on a button inside the card', () => {
    const { onClick } = renderCard({ actions: [<Button key="edit">Edit</Button>] });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Edit' }), { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders no actions row when every action is hidden', () => {
    const { container } = renderCard({ actions: [false, null, undefined] });
    expect(container.querySelector('.song-card-actions')).toBeNull();
  });

  it('renders the actions row when an action is present', () => {
    const { container } = renderCard({ actions: [false, <Button key="play">Play</Button>] });
    expect(container.querySelector('.song-card-actions')).toHaveTextContent('Play');
  });
});
