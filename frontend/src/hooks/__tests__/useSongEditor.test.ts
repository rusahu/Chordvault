import { act, renderHook } from '@testing-library/react';
import { useSongEditor } from '../useSongEditor';

describe('useSongEditor pending source edits', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('does not overwrite a newer title with a pending source parse', () => {
    const { result } = renderHook(() => useSongEditor());
    act(() => result.current.handleContentChange('{title: Old}\n{key: G}\n[G]Music'));
    act(() => result.current.handleFieldChange('title', 'New', result.current.setTitle));
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.state.title).toBe('New');
    expect(result.current.state.content).toContain('{title: New}');
  });
  it('does not overwrite new tags or language with a pending source parse', () => {
    const { result } = renderHook(() => useSongEditor());
    act(() => result.current.handleContentChange('{x_tags: hymn}\n{x_language: en}\n[G]Music'));
    act(() => result.current.handleTagsChange(['worship']));
    act(() => result.current.handleLanguageChange('zh'));
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.state.tags).toEqual(['worship']);
    expect(result.current.state.language).toBe('zh');
  });
  it('cancels a pending parse when loading different content', () => {
    const { result } = renderHook(() => useSongEditor());
    act(() => result.current.handleContentChange('{title: Old}\n[G]Music'));
    act(() => result.current.setInitialContent('{title: Loaded}\n[C]Music'));
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.state.title).toBe('Loaded');
  });
  it('reads tags lowercased and without duplicates, as the server stores them', () => {
    const { result } = renderHook(() => useSongEditor());
    act(() => result.current.setInitialContent('{x_tags: Worship, worship ,Kids}\n[G]Music'));
    expect(result.current.state.tags).toEqual(['worship', 'kids']);
  });
});
