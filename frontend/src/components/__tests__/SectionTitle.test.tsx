import { render, screen } from '@testing-library/react';
import { SectionTitle } from '../SectionTitle';

it('is a level 3 heading', () => {
  render(<SectionTitle>Users</SectionTitle>);
  expect(screen.getByRole('heading', { level: 3, name: 'Users' })).toBeInTheDocument();
});
