import { useCallback, useState } from 'react';

export interface StatusMessage { text: string; error: boolean }

export function useStatusMessage() {
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const succeed = useCallback((text: string) => setStatus({ text, error: false }), []);
  const fail = useCallback((text: string) => setStatus({ text, error: true }), []);
  const clear = useCallback(() => setStatus(null), []);
  return { status, succeed, fail, clear };
}
