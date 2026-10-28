import { render } from '@testing-library/react';
import { useHeightVar } from '../useHeightVar';

vi.mock('@mantine/hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('@mantine/hooks')>(),
  useElementSize: () => ({ ref: vi.fn(), width: 300, height: 57 }),
}));

function Bar() {
  const ref = useHeightVar<HTMLDivElement>('--test-bar-h');
  return <div ref={ref} />;
}

it('publishes the element height as a CSS variable and removes it on unmount', () => {
  const { unmount } = render(<Bar />);
  expect(document.documentElement.style.getPropertyValue('--test-bar-h')).toBe('57px');
  unmount();
  expect(document.documentElement.style.getPropertyValue('--test-bar-h')).toBe('');
});
