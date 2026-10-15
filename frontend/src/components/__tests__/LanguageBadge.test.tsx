import { render, screen } from '@testing-library/react';
import { LanguageBadge } from '../LanguageBadge';

it('shows the code in capitals and the language name as its title', () => {
  render(<LanguageBadge code="zh" />);
  expect(screen.getByTitle('Chinese')).toHaveTextContent('ZH');
});
