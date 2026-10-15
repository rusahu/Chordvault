import { act, renderHook } from '@testing-library/react';
import { modals } from '@mantine/modals';
import { useStackedModalProps } from '../useStackedModalProps';

afterEach(() => act(() => modals.closeAll()));

it('traps focus and closes normally when nothing is stacked', () => {
  const { result } = renderHook(() => useStackedModalProps());
  expect(result.current).toEqual({ trapFocus: true, closeOnEscape: true, closeOnClickOutside: true });
});

it('keeps a locked modal open but still traps focus', () => {
  const { result } = renderHook(() => useStackedModalProps({ locked: true }));
  expect(result.current).toEqual({ trapFocus: true, closeOnEscape: false, closeOnClickOutside: false });
});

it('hands focus and dismissal to a confirm stacked on top', () => {
  const { result } = renderHook(() => useStackedModalProps());
  act(() => { modals.openConfirmModal({ children: 'Sure?' }); });
  expect(result.current).toEqual({ trapFocus: false, closeOnEscape: false, closeOnClickOutside: false });
});
