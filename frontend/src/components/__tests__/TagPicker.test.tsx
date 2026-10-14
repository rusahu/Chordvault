import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPicker } from '../TagPicker';

vi.mock('../../hooks/useTagList', () => ({ useTagList: () => ['worship', 'hymn'] }));
vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => ({ 'tag.worship': '敬拜' } as Record<string, string>)[key] ?? key }),
}));
const renderPicker = (selected: string[], onChange = vi.fn()) => {
  render(<TagPicker label="Tags" selected={selected} onChange={onChange} />);
  return onChange;
};

it('shows the admin list in order with translated labels, then selected off-list tags', () => {
  renderPicker(['advent', 'hymn']);
  const chips = within(screen.getByRole('group', { name: 'Tags' })).getAllByRole('checkbox');
  expect(chips.map(chip => (chip as HTMLInputElement).value)).toEqual(['worship', 'hymn', 'advent']);
  expect(screen.getByRole('checkbox', { name: '敬拜' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'advent' })).toBeChecked();
});

it('unticking an off-list tag removes it and ticking a translated one stores its name', async () => {
  const onChange = renderPicker(['advent', 'hymn']);
  await userEvent.click(screen.getByRole('checkbox', { name: 'advent' }));
  expect(onChange).toHaveBeenLastCalledWith(['hymn']);
  await userEvent.click(screen.getByRole('checkbox', { name: '敬拜' }));
  expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining(['worship']));
});
