import { useState, useCallback } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import { extractDirective, updateDirective, detectFormat } from '../lib/chords';
import { splitTags } from '../lib/tagName';
import { SONG_ERRORS } from '../../../shared/song-errors.mjs';

export function useSongEditor(initialContent: string = '') {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [bpm, setBpm] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState('');
  const [formatBadge, setFormatBadge] = useState<{ text: string; ok: boolean } | null>(null);

  const updateBadge = useCallback((text: string) => {
    const fmt = detectFormat(text);
    if (fmt) setFormatBadge({ text: fmt, ok: true });
    else if (text?.trim()) setFormatBadge({ text: SONG_ERRORS.noChords, ok: false });
    else setFormatBadge(null);
  }, []);

  const syncContentToFields = useCallback((text: string) => {
    setTitle(extractDirective(text, 'title') || '');
    setArtist(extractDirective(text, 'artist') || '');
    const tempo = extractDirective(text, 'tempo');
    setBpm(tempo && /^\d+$/.test(tempo) ? tempo : '');
    setYoutubeUrl(extractDirective(text, 'x_youtube') || '');
    const tagStr = extractDirective(text, 'x_tags');
    setTags(splitTags(tagStr));
    setLanguage(extractDirective(text, 'x_language') || '');
    updateBadge(text);
  }, [updateBadge]);

  const scheduleSync = useDebouncedCallback(syncContentToFields, 150);

  const setInitialContent = useCallback((text: string) => {
    scheduleSync.cancel();
    setContent(text);
    syncContentToFields(text);
  }, [syncContentToFields, scheduleSync]);

  const handleContentChange = useCallback((text: string) => {
    setContent(text);
    updateBadge(text);
    scheduleSync(text);
  }, [scheduleSync, updateBadge]);

  const writeDirective = useCallback((directive: string, value: string | null) => {
    scheduleSync.cancel();
    setContent(prev => updateDirective(prev, directive, value));
  }, [scheduleSync]);

  const handleFieldChange = useCallback((directive: string, value: string, setter: (v: string) => void) => {
    setter(value);
    writeDirective(directive, value || null);
  }, [writeDirective]);

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
    writeDirective('x_tags', newTags.length > 0 ? newTags.join(',') : null);
  }, [writeDirective]);

  const handleLanguageChange = useCallback((lang: string) => handleFieldChange('x_language', lang, setLanguage), [handleFieldChange]);

  return {
    state: { title, artist, content, youtubeUrl, bpm, tags, language, formatBadge },
    setInitialContent,
    handleContentChange,
    handleFieldChange,
    handleTagsChange,
    handleLanguageChange,
    setTitle,
    setArtist,
    setYoutubeUrl,
    setBpm,
    setTags,
    setLanguage
  };
}
