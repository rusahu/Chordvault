import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider, useI18n } from '../I18nContext';

afterEach(() => vi.unstubAllGlobals());

it('fills placeholders with the literal value, since React already escapes text', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ 'x.remove': "Remove '{name}'?" }) })));
  const { result } = renderHook(() => useI18n(), { wrapper: ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider> });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.tReplace('x.remove', { name: 'praise & worship $&' })).toBe("Remove 'praise & worship $&'?");
});
