import { useEffect, useState } from 'react';
import { useApi } from './useApi';
import { DEFAULT_TAGS } from '../lib/constants';

/** The admin's tag list for the editor; the defaults until it loads or if it cannot. */
export function useTagList() {
  const apiCall = useApi();
  const [tags, setTags] = useState(DEFAULT_TAGS);
  useEffect(() => {
    let active = true;
    apiCall<{ tags?: string[] }>('GET', '/api/tags')
      .then(data => { if (active && Array.isArray(data?.tags)) setTags(data.tags); })
      .catch(() => {});
    return () => { active = false; };
  }, [apiCall]);
  return tags;
}
