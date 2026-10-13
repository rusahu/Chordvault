type SetlistView = 'setlist-edit' | 'setlist-play';

export interface Destination {
  view: string;
  params: Record<string, string>;
}

export function songEditFromSetlist(songId: number, back: SetlistView, setlistId: number | string, index?: number): Record<string, string> {
  return { id: String(songId), back, setlist: String(setlistId), ...(index ? { index: String(index) } : {}) };
}

export function songEditReturn(params: Record<string, string>): Destination | undefined {
  if ((params.back !== 'setlist-edit' && params.back !== 'setlist-play') || !params.setlist) return undefined;
  return { view: params.back, params: { id: params.setlist, ...(params.index ? { index: params.index } : {}) } };
}
