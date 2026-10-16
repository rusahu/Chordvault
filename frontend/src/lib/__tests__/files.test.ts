import { describe, it, expect } from 'vitest';
import { readFile } from '../files';

describe('readFile', () => {
  it('reads text honouring a UTF-16 byte order mark', async () => {
    const utf16 = new Uint8Array([0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]);
    expect(await readFile(new File([utf16], 'song.cho'), 'text')).toBe('Hi');
  });
  it('reads a data URL', async () => {
    expect(await readFile(new File(['abc'], 'a.png', { type: 'image/png' }), 'dataURL')).toBe('data:image/png;base64,YWJj');
  });
});
