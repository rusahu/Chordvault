import { describe, it, expect } from 'vitest';
import { LANGUAGES, languageOptions } from '../languages';

describe('languageOptions', () => {
  it('labels each kept language with its name and code', () => {
    const options = languageOptions(code => code === 'en' || code === 'zh');
    expect(options).toEqual(LANGUAGES.filter(l => l.code === 'en' || l.code === 'zh').map(l => ({ value: l.code, label: `${l.name} (${l.code})` })));
    expect(options.map(o => o.value)).toEqual(expect.arrayContaining(['en', 'zh']));
  });
});
