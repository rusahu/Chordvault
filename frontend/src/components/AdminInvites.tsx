import { useCallback, useEffect, useState } from 'react';
import { Box, Button, CloseButton, Code, Divider, Group, Paper, Stack, Switch, Text } from '@mantine/core';
import { useApi } from '../hooks/useApi';
import { useBusyAction } from '../hooks/useBusyAction';
import { useCopyNotification } from '../hooks/useCopyNotification';
import { useDemo } from '../context/DemoContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { formatDbDate } from '../lib/format';
import type { AdminConfig, InviteCode } from '../types';

export function AdminInvites() {
  const apiCall = useApi();
  const { demoMode } = useDemo();
  const { t } = useI18n();
  const copyWithFeedback = useCopyNotification(t('admin.codeCopied'));
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const { busy, run } = useBusyAction();
  const disabled = demoMode || busy;
  const pending = invites.filter((i) => !i.used_at);

  const loadInvites = useCallback(() => apiCall<InviteCode[]>('GET', '/api/admin/invites').then(setInvites).catch(() => {}), [apiCall]);

  useEffect(() => {
    loadInvites();
    apiCall<AdminConfig>('GET', '/api/admin/config').then(setConfig).catch(() => {});
  }, [apiCall, loadInvites]);

  const toggleReg = (allowRegistration: boolean) => run(async () => {
    await apiCall('PUT', '/api/admin/config', { allowRegistration });
    setConfig({ allowRegistration });
    toast(allowRegistration ? 'Registration enabled' : 'Registration disabled', 'success');
  });

  const generateInvite = () => run(async () => {
    const data = await apiCall<{ code: string }>('POST', '/api/admin/invites');
    setInviteCode(data.code);
    await loadInvites();
  });

  const deleteInvite = (id: number) => run(async () => {
    await apiCall('DELETE', `/api/admin/invites/${id}`);
    await loadInvites();
  });

  return (
    <>
      <h3 className="admin-section-title">{t('admin.inviteUsers')}</h3>
      <Paper withBorder bg="var(--surface)" radius="var(--radius)" py={16} px={20} mb={20}>
        <Box mb={14}>
          {config && (
            <>
              <Switch mb="sm" label="Open Registration" checked={config.allowRegistration} onChange={(e) => toggleReg(e.target.checked)} disabled={disabled} />
              <Text fz={13} c="var(--muted)" mt={4}>
                {config.allowRegistration ? 'Anyone can create an account — no email verification, so open to spam. Use invite codes instead.' : 'Registration is closed. Use invite codes to add new users.'}
              </Text>
            </>
          )}
          {demoMode && <Text fz={12} c="var(--muted)" mt={4}>{t('common.demoDisabled')}</Text>}
        </Box>
        <Stack gap={14}><Divider />
          <Group gap={12}>
            <Button onClick={generateInvite} disabled={disabled} title={demoMode ? t('common.demoDisabled') : ''}>{t('admin.generateInvite')}</Button>
            {inviteCode && (
              <Group gap={8}>
                <Code fz={18} fw={600} py={6} px={14} bg="var(--accent-bg)" lts="0.08em" style={{ userSelect: 'all' }}>{inviteCode}</Code>
                <Button variant="default" size="xs" onClick={() => copyWithFeedback(inviteCode)}>{t('admin.copy')}</Button>
              </Group>
            )}
          </Group>
          <Text fz={13} c="var(--muted)" mt={8}>Generate a single-use code and share it. The person enters it on the sign-in page to create their account.</Text>
          {pending.length > 0 && (
            <Stack gap={6} mt={12}><Divider />
              <Text fz={12} c="var(--muted)" mb={6} tt="uppercase" lts="0.06em" fw={600}>{t('admin.pendingInvites')}</Text>
              {pending.map((inv) => (
                <Group key={inv.id} gap={8} mb={4}>
                  <Text span ff="monospace" fz={13}>{inv.code}</Text>
                  <Text span fz={12} c="var(--muted)">{formatDbDate(inv.created_at)}</Text>
                  <CloseButton aria-label={t('admin.delete')} onClick={() => deleteInvite(inv.id)} disabled={disabled} />
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    </>
  );
}
