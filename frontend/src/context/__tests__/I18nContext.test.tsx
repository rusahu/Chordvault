import { render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider, useI18n } from '../I18nContext';

afterEach(() => vi.unstubAllGlobals());

it('fills placeholders with the literal value, since React already escapes text', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ 'x.remove': "Remove '{name}'?" }) })));
  const { result } = renderHook(() => useI18n(), { wrapper: ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider> });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.tReplace('x.remove', { name: 'praise & worship $&' })).toBe("Remove 'praise & worship $&'?");
});

it('shows the app only once the strings have loaded, so keys never flash', async () => {
  let respond: (value: unknown) => void = () => {};
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { respond = resolve; })));
  const Label = () => <span>{useI18n().t('nav.browse')}</span>;
  render(<I18nProvider><Label /></I18nProvider>);
  expect(screen.queryByText('nav.browse')).toBeNull();
  respond({ ok: true, json: async () => ({ 'nav.browse': 'Songs' }) });
  expect(await screen.findByText('Songs')).toBeInTheDocument();
});
