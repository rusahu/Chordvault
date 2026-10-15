import { render, fireEvent } from '@testing-library/react';
import { SetlistEntryCard } from '../SetlistEntryCard';
import type { SetlistEntry } from '../../types';

vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const ENTRY: SetlistEntry = {
  entry_id: 1,
  song_id: 9,
  title: 'Song',
  artist: 'Artist',
  content: '{key: C}\n[C]a [G]b',
  content_override: null,
  target_key: null,
  nashville: 0,
  bpm: null,
  youtube_url: null,
  language: 'en',
};

const meta = (entry: SetlistEntry) => {
  const { container } = render(
    <SetlistEntryCard
      entry={entry}
      idx={0}
      isEditable
      isLocal={false}
      onRemove={vi.fn()}
      onStepKey={vi.fn()}
      onClick={vi.fn()}
    />
  );
  return container.querySelector('.song-card-meta')!.textContent;
};

describe('SetlistEntryCard key display', () => {
  it('shows the stored target key, not the song written key', () => {
    expect(meta({ ...ENTRY, target_key: 'B' })).toBe('Artist · B');
  });

  it('shows the written key when the entry is as-written', () => {
    expect(meta(ENTRY)).toBe('Artist · C');
  });

  it('derives the shift from a content override when there is one', () => {
    // Override is written in E, so pinning to G is a different shift than the
    // song's own key would give.
    expect(meta({ ...ENTRY, content_override: '{key: E}\n[E]a', target_key: 'G' })).toBe('Artist · G');
  });
});

describe('SetlistEntryCard private badge', () => {
  it('announces private entries as text', () => {
    const { getByText } = render(
      <SetlistEntryCard entry={{ ...ENTRY, visibility: 'private' } as SetlistEntry} idx={0} isEditable isLocal={false}
        onRemove={vi.fn()} onStepKey={vi.fn()} onClick={vi.fn()} />
    );
    expect(getByText('Private')).toBeInTheDocument();
  });
});

describe('SetlistEntryCard edit song', () => {
  it('opens the editor without starting playback, even on a read-only setlist', () => {
    const onEdit = vi.fn();
    const onClick = vi.fn();
    const { getByRole, queryByText } = render(
      <SetlistEntryCard entry={ENTRY} idx={3} isEditable={false} isLocal={false}
        onRemove={vi.fn()} onStepKey={vi.fn()} onClick={onClick} onEdit={onEdit} />
    );
    expect(queryByText('♭')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'songView.edit' }));
    expect(onEdit).toHaveBeenCalledWith(3);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has no Edit button without onEdit', () => {
    const { queryByRole } = render(
      <SetlistEntryCard entry={ENTRY} idx={0} isEditable isLocal={false}
        onRemove={vi.fn()} onStepKey={vi.fn()} onClick={vi.fn()} />
    );
    expect(queryByRole('button', { name: 'songView.edit' })).toBeNull();
  });
});
