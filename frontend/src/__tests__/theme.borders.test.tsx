import { render } from '@testing-library/react';
import { Divider, Paper } from '@mantine/core';

it('draws Mantine borders in the app line colour', () => {
  const { container } = render(<><Paper withBorder data-testid="paper">x</Paper><Divider data-testid="divider" /><Divider color="red" data-testid="red" /></>);
  const style = (id: string) => (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).getAttribute('style') || '';
  expect(style('paper')).toContain('--paper-border-color: var(--border)');
  expect(style('divider')).toContain('--divider-color: var(--border)');
  expect(style('red')).not.toContain('var(--border)');
});
