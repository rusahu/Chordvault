import { Button, PasswordInput, Stack, Group, Badge, Alert } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useBusyAction } from '../hooks/useBusyAction';
import { useStatusMessage } from '../hooks/useStatusMessage';
import { errorMessage } from '../lib/errors';

export function GeminiKeySettings() {
  const apiCall = useApi();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const { status, succeed, fail, clear } = useStatusMessage();
  const { busy, run } = useBusyAction();
  const [which, setWhich] = useState<'save' | 'remove' | null>(null);
  const failWith = (e: unknown) => fail(errorMessage(e));

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiCall<{ hasKey: boolean }>('GET', '/api/settings/gemini-key');
      setHasKey(data.hasKey);
    } catch {
      setHasKey(null);
      fail('Could not check key status');
    }
  }, [apiCall, fail]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const saveKey = () => run(async () => {
    setWhich('save');
    clear();
    if (!geminiKey.trim()) { fail('Enter an API key'); return; }
    await apiCall('PUT', '/api/settings/gemini-key', { api_key: geminiKey.trim() });
    setHasKey(true);
    setGeminiKey('');
    succeed(hasKey ? 'Key replaced' : 'Key saved');
  }, failWith);

  const removeKey = () => run(async () => {
    setWhich('remove');
    await apiCall('DELETE', '/api/settings/gemini-key');
    setHasKey(false);
    setGeminiKey('');
    succeed('Key removed');
  }, failWith);

  const saving = busy && which === 'save';
  const removing = busy && which === 'remove';

  return (
    <Stack gap="sm">
      <div role="status" aria-live="polite">
        <Badge color={hasKey ? 'green' : 'gray'}>
        {hasKey === null ? 'Checking key status…' : hasKey ? '✓ Key configured' : 'No key configured'}
        </Badge>
      </div>
              <PasswordInput label={<>{hasKey ? 'Replace Gemini API Key' : 'Gemini API Key'}</>}
          id="gemini-api-key"
          type="password"
          value={geminiKey}
          onChange={(event) => setGeminiKey(event.target.value)}
          placeholder={hasKey ? '•••••••••••• (saved key)' : 'Paste your Gemini API key here'}
          autoComplete="off"
        />
      <Group gap={8}>
        <Button size="xs" className="btn btn-sm" onClick={saveKey} loading={saving} disabled={removing}>
          {hasKey ? 'Replace Key' : 'Save Key'}
        </Button>
        {hasKey && (
          <Button color="red" size="xs" className="btn btn-danger btn-sm" onClick={removeKey} loading={removing} disabled={saving}>
            Remove Key
          </Button>
        )}
      </Group>
      {status && (
        <Alert color={status.error ? 'red' : 'green'} role={status.error ? 'alert' : 'status'}>
          {status.text}
        </Alert>
      )}
    </Stack>
  );
}
