import { render, screen } from '@testing-library/react';
import { SetlistCard } from '../SetlistCard';

const t = (key: string) => ({ 'admin.song': 'song', 'admin.songPlural': 'songs', 'setlist.play': 'Play' }[key] ?? key);
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t }) }));

it('shows owner, song count and event date', () => {
  render(<SetlistCard setlist={{ id: 1, name: 'Sunday', visibility: 'public', event_date: '2026-10-18', song_count: 1, username: 'amy' }} onClick={vi.fn()} showUsername />);
  expect(screen.getByText('@amy · 1 song · 2026-10-18')).toBeInTheDocument();
});

it('pluralizes and offers Play only for a non-empty setlist', () => {
  const { rerender } = render(<SetlistCard setlist={{ id: 1, name: 'A', visibility: 'private', event_date: null, song_count: 2 }} onClick={vi.fn()} onPlay={vi.fn()} />);
  expect(screen.getByText('2 songs')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  rerender(<SetlistCard setlist={{ id: 1, name: 'A', visibility: 'private', event_date: null, song_count: 0 }} onClick={vi.fn()} onPlay={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
});
