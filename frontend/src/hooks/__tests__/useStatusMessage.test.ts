import { act, renderHook } from '@testing-library/react';
import { useStatusMessage } from '../useStatusMessage';

it('holds the latest message and clears it', () => {
  const { result } = renderHook(() => useStatusMessage());
  act(() => result.current.succeed('Saved'));
  expect(result.current.status).toEqual({ text: 'Saved', error: false });
  act(() => result.current.fail('Denied'));
  expect(result.current.status).toEqual({ text: 'Denied', error: true });
  act(() => result.current.clear());
  expect(result.current.status).toBeNull();
});
