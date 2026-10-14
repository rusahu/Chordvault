import { render, screen } from '@testing-library/react';
import { SongCard } from '../SongCard';
import type { SongListItem } from '../../types';

vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => ({ 'tag.worship': '敬拜' } as Record<string, string>)[key] ?? key }),
}));

describe('SongCard', () => {
  it('announces private songs as text, not only as a lock icon', () => {
    const song = { id: 1, title: 'Song', artist: 'Artist', visibility: 'private', language: 'en' } as SongListItem;
    render(<SongCard song={song} onClick={vi.fn()} />);
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('labels tags from the language file and keeps unknown tags as stored', () => {
    const song = { id: 2, title: 'Song', tags: 'worship,advent' } as SongListItem;
    render(<SongCard song={song} onClick={vi.fn()} />);
    expect(screen.getByText('敬拜')).toBeInTheDocument();
    expect(screen.getByText('advent')).toBeInTheDocument();
  });
});
