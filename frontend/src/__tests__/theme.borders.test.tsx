import { render } from '@testing-library/react';
import { Divider, Paper, Tabs } from '@mantine/core';

it('draws Mantine borders in the app line colour', () => {
  const { container } = render(<><Paper withBorder data-testid="paper">x</Paper><Divider data-testid="divider" /><Divider color="red" data-testid="red" /></>);
  const style = (id: string) => (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).getAttribute('style') || '';
  expect(style('paper')).toContain('--paper-border-color: var(--border)');
  expect(style('divider')).toContain('--divider-color: var(--border)');
  expect(style('red')).not.toContain('var(--border)');
});

it('draws the tab underline in the app line colour', () => {
  const { container } = render(<Tabs data-testid="tabs"><Tabs.List><Tabs.Tab value="a">A</Tabs.Tab></Tabs.List></Tabs>);
  expect(container.querySelector('[data-testid="tabs"]')!.getAttribute('style')).toContain('--tab-border-color: var(--border)');
});
