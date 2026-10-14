import { useMediaQuery } from '@mantine/hooks';
import { Badge, Paper, Switch, Button, SimpleGrid, Group, Stack, Text, Box, Divider, Code } from '@mantine/core';
import { ListCard } from '../components/ListCard';
import { useCopyNotification } from '../hooks/useCopyNotification';
import { modals } from '@mantine/modals';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { showStatusNotification as toast } from '../lib/notifications';
import { Loading } from '../components/Loading';
import type { AdminStats, AdminUser, InviteCode, AdminConfig, Correction } from '../types';
import { useDemo } from '../context/DemoContext';
import { languageName } from '../lib/languages';
import { PageTitle } from '../components/PageTitle';
import { AdminTags } from '../components/AdminTags';

interface AdminViewProps {
  navigate: (view: string, params?: Record<string, string>) => void;
}

export function AdminView({ navigate }: AdminViewProps) {
  const wideStats = useMediaQuery('(min-width: 900px)', undefined, { getInitialValueInEffect: false });
  const apiCall = useApi();
  const { user, isAdmin } = useAuth();
  const { demoMode } = useDemo();
  const { t, tReplace } = useI18n();
  const copyWithFeedback = useCopyNotification(t('admin.codeCopied'));
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [config, setConfig] = useState<AdminConfig>({ allowRegistration: true });
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const pendingAction = useRef(false);

  const runAction = async (action: () => Promise<void>) => {
    if (pendingAction.current) return;
    pendingAction.current = true;
    setBusy(true);
    try { await action(); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { pendingAction.current = false; setBusy(false); }
  };

  const loadInvites = useCallback(async () => {
    try {
      const inv = await apiCall<InviteCode[]>('GET', '/api/admin/invites');
      setInvites(inv);
    } catch { /* ignore */ }
  }, [apiCall]);

  const load = useCallback(async () => {
    try {
      const [s, u, c, cfg] = await Promise.all([
        apiCall<AdminStats>('GET', '/api/admin/stats'),
        apiCall<AdminUser[]>('GET', '/api/admin/users'),
        apiCall<Correction[]>('GET', '/api/admin/corrections'),
        apiCall<AdminConfig>('GET', '/api/admin/config'),
      ]);
      setStats(s); setUsers(u); setCorrections(c); setConfig(cfg);
      await loadInvites();
    } catch (e) { toast((e as Error).message, 'error'); navigate('my-songs'); }
  }, [apiCall, navigate, loadInvites]);

  useEffect(() => {
    if (!isAdmin) { navigate('my-songs'); return; }
    load();
  }, [isAdmin, navigate, load]);

  const toggleReg = (val: boolean) => runAction(async () => {
    await apiCall('PUT', '/api/admin/config', { allowRegistration: val });
    setConfig({ ...config, allowRegistration: val });
    toast(val ? 'Registration enabled' : 'Registration disabled', 'success');
  });

  const generateInvite = () => runAction(async () => {
    const data = await apiCall<{ code: string }>('POST', '/api/admin/invites');
    setInviteCode(data.code);
    await loadInvites();
  });

  const deleteInvite = (id: number) => runAction(async () => {
    await apiCall('DELETE', `/api/admin/invites/${id}`);
    await loadInvites();
  });

  const setRole = (userId: number, role: string) => {
    const action = role === 'admin' ? t('admin.confirmPromote') : t('admin.confirmDemote');
    modals.openConfirmModal({ children: action, onConfirm: () => runAction(async () => {
      await apiCall('PUT', `/api/admin/users/${userId}/role`, { role });
      toast(role === 'admin' ? t('admin.userPromoted') : t('admin.userDemoted'), 'success');
      await load();
    }) });
  };

  const setDisabled = (userId: number, disabled: boolean) => {
    modals.openConfirmModal({ children: disabled ? t('admin.confirmDisable') : t('admin.confirmEnable'), onConfirm: () => runAction(async () => {
      await apiCall('PUT', `/api/admin/users/${userId}/disabled`, { disabled });
      toast(disabled ? t('admin.userDisabled') : t('admin.userEnabled'), 'success');
      await load();
    }) });
  };

  const deleteUser = (userId: number, username: string) => {
    modals.openConfirmModal({ children: tReplace('admin.confirmDeleteUser', { username }), onConfirm: () => runAction(async () => {
      await apiCall('DELETE', `/api/admin/users/${userId}`);
      toast(t('admin.userDeleted'), 'success');
      await load();
    }) });
  };

  const resetPassword = (userId: number, username: string) => modals.openContextModal({ modal: 'resetPassword', title: tReplace('admin.resetPasswordPrompt', { username }), innerProps: { onSubmit: (newPassword: string) => runAction(async () => {
    await apiCall('PUT', `/api/admin/users/${userId}/password`, { password: newPassword });
    toast(t('admin.passwordReset'), 'success');
  }) } });

  const deleteSong = (songId: number, title: string) => {
    modals.openConfirmModal({ children: tReplace('admin.confirmDeleteSong', { title }), onConfirm: () => runAction(async () => {
      await apiCall('DELETE', `/api/admin/songs/${songId}`);
      toast(t('admin.songDeleted'), 'success');
      await load();
    }) });
  };

  if (!stats) return <Loading />;

  const isOwner = user?.role === 'owner';
  const currentId = user?.id;
  const pending = invites.filter((i) => !i.used_at);

  return (
    <>
      <Group justify="space-between" mb="lg"><PageTitle className="view-title">{t('admin.title')}</PageTitle></Group>
      <SimpleGrid className="admin-stats" cols={wideStats ? 3 : 1} spacing={12} mb={28}>
        <Paper withBorder className="stat-card" bg="var(--ui-card-bg)" radius="var(--radius)" py={22} px={20} ta="center" shadow="sm"><Text fz={36} fw={700} c="var(--accent)" lh={1.2}>{stats.userCount}</Text><Text fz={13} c="dimmed" mt={4}>{t('admin.users')}</Text></Paper>
        <Paper withBorder className="stat-card" bg="var(--ui-card-bg)" radius="var(--radius)" py={22} px={20} ta="center" shadow="sm"><Text fz={36} fw={700} c="var(--accent)" lh={1.2}>{stats.songCount}</Text><Text fz={13} c="dimmed" mt={4}>{t('admin.songs')}</Text></Paper>
        {stats.pendingCount > 0 && <Paper withBorder className="stat-card stat-warn" bg="var(--ui-card-bg)" radius="var(--radius)" py={22} px={20} ta="center" shadow="sm"><Text fz={36} fw={700} c="var(--accent)" lh={1.2}>{stats.pendingCount}</Text><Text fz={13} c="dimmed" mt={4}>Pending corrections</Text></Paper>}
        {stats.noFormatCount > 0 && <Paper withBorder className="stat-card stat-warn" bg="var(--ui-card-bg)" radius="var(--radius)" py={22} px={20} ta="center" shadow="sm"><Text fz={36} fw={700} c="var(--accent)" lh={1.2}>{stats.noFormatCount}</Text><Text fz={13} c="dimmed" mt={4}>No chords detected</Text></Paper>}
      </SimpleGrid>

      {stats.languageDistribution && stats.languageDistribution.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 className="admin-section-title">Languages</h3>
          <SimpleGrid className="admin-stats" cols={wideStats ? 3 : 1} spacing={12} mb={28}>
            {stats.languageDistribution.map(({ language, count }) => (
              <Paper withBorder key={language} className="stat-card" bg="var(--ui-card-bg)" radius="var(--radius)" py={22} px={20} ta="center" shadow="sm">
                <Text fz={36} fw={700} c="var(--accent)" lh={1.2}>{count}</Text>
                <Text fz={13} c="dimmed" mt={4}>{language ? languageName(language) : 'Not set'}</Text>
              </Paper>
            ))}
          </SimpleGrid>
        </div>
      )}

      <h3 className="admin-section-title">{t('admin.inviteUsers')}</h3>
      <Paper withBorder bg="var(--surface)" radius="var(--radius)" py={16} px={20} mb={20}>
        <div style={{ marginBottom: 14 }}>
          <Switch mb="sm" label="Open Registration" checked={config.allowRegistration} onChange={(e) => toggleReg(e.target.checked)} disabled={demoMode || busy}  />
          <div className="muted-text" style={{ marginTop: 4 }}>
            {config.allowRegistration ? 'Anyone can create an account — no email verification, so open to spam. Use invite codes instead.' : 'Registration is closed. Use invite codes to add new users.'}
          </div>
          {demoMode && <div className="muted-text" style={{ fontSize: 12, marginTop: 4 }}>Disabled in demo mode</div>}
        </div>
        <Stack gap={14}><Divider />
          <Group gap={12}>
            <Button className="btn" onClick={generateInvite} disabled={demoMode || busy} title={demoMode ? 'Disabled in demo mode' : ''}>{t('admin.generateInvite')}</Button>
            {inviteCode && (
              <Group gap={8}>
                <Code fz={18} fw={600} py={6} px={14} bg="var(--accent-bg)" style={{ userSelect: 'all', letterSpacing: '0.08em' }}>{inviteCode}</Code>
                <Button variant="default" size="xs" className="btn btn-ghost btn-sm" onClick={() => copyWithFeedback(inviteCode)}>{t('admin.copy')}</Button>
              </Group>
            )}
          </Group>
          <div className="muted-text" style={{ marginTop: 8 }}>Generate a single-use code and share it. The person enters it on the sign-in page to create their account.</div>
          {pending.length > 0 && (
            <Stack gap={6} mt={12}><Divider />
              <div className="muted-text" style={{ fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{t('admin.pendingInvites')}</div>
              {pending.map((inv) => (
                <Group key={inv.id} gap={8} mb={4}>
                  <code style={{ fontSize: 13 }}>{inv.code}</code>
                  <span className="muted-text" style={{ fontSize: 12 }}>{new Date(inv.created_at).toLocaleDateString()}</span>
                  <Button variant="default" size="xs" className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => deleteInvite(inv.id)} disabled={demoMode || busy}>&#10005;</Button>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <AdminTags />

      <h3 className="admin-section-title">{t('admin.users')}</h3>

      <SimpleGrid className="song-grid" minColWidth="min(100%, 320px)" autoFlow="auto-fill" spacing={12} mb={28}>
        {users.map((u) => {
          const isSelf = u.id === currentId;
          const isTargetOwner = u.role === 'owner';
          const isTargetAdmin = u.role === 'admin';
          const canManage = !isSelf && !isTargetOwner && (isOwner || !isTargetAdmin);

          return (
            <Paper key={u.id} className="user-card" withBorder bg="var(--ui-card-bg)" radius="var(--radius)" py={16} px={20} shadow="sm">
              <Group className="user-card-top" justify="space-between" gap={12}>
                <Box flex="1 1 180px" miw={0}>
                  <div className="song-card-title">@{u.username}{isSelf && <span className="muted-text"> {t('admin.you')}</span>}</div>
                  <div className="song-card-meta">{u.song_count} {u.song_count !== 1 ? t('admin.songPlural') : t('admin.song')} &middot; {t('admin.joined')} {new Date(u.created_at).toLocaleDateString()}</div>
                </Box>
                <Group gap={6}>
                  {u.role === 'owner' && <Badge>owner</Badge>}
                  {u.role === 'admin' && <Badge>admin</Badge>}
                  {u.disabled && <Badge color="red">disabled</Badge>}
                </Group>
              </Group>
              {canManage && !demoMode && (
                <Stack gap={10} mt={10}><Divider /><Group className="user-card-actions" gap={6}>
                  {isOwner && (isTargetAdmin
                    ? <Button variant="default" size="xs" className="btn btn-ghost btn-sm" disabled={busy} onClick={(e) => { e.stopPropagation(); setRole(u.id, 'user'); }}>{t('admin.demote')}</Button>
                    : <Button variant="default" size="xs" className="btn btn-ghost btn-sm" disabled={busy} onClick={(e) => { e.stopPropagation(); setRole(u.id, 'admin'); }}>{t('admin.promote')}</Button>
                  )}
                  <Button variant="default" size="xs" className="btn btn-ghost btn-sm" disabled={busy} onClick={(e) => { e.stopPropagation(); resetPassword(u.id, u.username); }}>{t('admin.resetPassword')}</Button>
                  <Button variant="default" size="xs" className="btn btn-ghost btn-sm" disabled={busy} onClick={(e) => { e.stopPropagation(); setDisabled(u.id, !u.disabled); }}>{u.disabled ? t('admin.enable') : t('admin.disable')}</Button>
                  <Button color="red" size="xs" className="btn btn-danger btn-sm" disabled={busy} onClick={(e) => { e.stopPropagation(); deleteUser(u.id, u.username); }}>{t('admin.delete')}</Button>
                </Group></Stack>
              )}
            </Paper>
          );
        })}
      </SimpleGrid>

      {stats.recentSongs.length > 0 && (
        <>
          <h3 className="admin-section-title">{t('admin.recentSongs')}</h3>
          <SimpleGrid className="song-grid" minColWidth="min(100%, 320px)" autoFlow="auto-fill" spacing={12}>
            {stats.recentSongs.map((s) => (
              <ListCard
                key={s.id}
                className="mantine-focus-auto"
                title={s.title}
                meta={<>{s.artist ? `${s.artist} · ` : ''}@{s.username} &middot; {new Date(s.created_at).toLocaleDateString()}</>}
                onClick={() => navigate('song-view', { id: String(s.id) })}
                actions={<Button color="red" size="xs" className="btn btn-danger btn-sm" disabled={busy} onClick={(e) => { e.stopPropagation(); deleteSong(s.id, s.title); }}>{t('admin.delete')}</Button>}
              />
            ))}
          </SimpleGrid>
        </>
      )}

      {corrections.length > 0 && (
        <>
          <h3 className="admin-section-title">Pending Corrections ({corrections.length})</h3>
          <SimpleGrid className="song-grid" minColWidth="min(100%, 320px)" autoFlow="auto-fill" spacing={12}>
            {corrections.map((c) => (
              <ListCard
                key={c.id}
                className="mantine-focus-auto"
                title={c.title}
                meta={<>by @{c.submitter} &middot; {new Date(c.created_at).toLocaleDateString()}</>}
                onClick={() => navigate('song-view', { id: String(c.parent_id) })}
                actions={<Badge color="yellow">pending</Badge>}
              />
            ))}
          </SimpleGrid>
        </>
      )}
    </>
  );
}
