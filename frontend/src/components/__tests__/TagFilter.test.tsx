import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagFilter } from '../TagFilter';

vi.mock('../../hooks/useTagList', () => ({ useTagList: () => ['worship', 'kids'] }));
vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => ({ 'tag.worship': '敬拜' } as Record<string, string>)[key] ?? key }),
}));

const input = () => screen.getByRole('combobox', { name: 'songs.tags' });

it('offers the admin tags in your language, searchable by label, and sends stored names', async () => {
  const onChange = vi.fn();
  render(<TagFilter value={[]} onChange={onChange} />);
  await userEvent.type(input(), '敬');
  expect(screen.queryByRole('option', { name: 'kids' })).not.toBeInTheDocument();
  await userEvent.click(await screen.findByRole('option', { name: '敬拜' }));
  expect(onChange).toHaveBeenLastCalledWith(['worship']);
});

it('keeps a picked tag that is no longer on the admin list, and it can be removed', async () => {
  const onChange = vi.fn();
  render(<TagFilter value={['advent', 'kids']} onChange={onChange} />);
  expect(input().parentElement).toHaveTextContent('adventkids');
  // Pill remove buttons are aria-hidden with tabindex -1, so role queries cannot reach them; the first belongs to 'advent'.
  await userEvent.click(input().parentElement!.querySelector('button')!);
  expect(onChange).toHaveBeenLastCalledWith(['kids']);
});
