import { Anchor, Box, Center, Paper, Text, Tabs, Button, PasswordInput, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useBusyAction } from '../hooks/useBusyAction';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { DEMO_ACCOUNT } from '../lib/constants';
import type { AuthConfig, AuthResponse } from '../types';
import type { Navigate } from '../lib/routes';

interface AuthViewProps {
  navigate: Navigate;
}

export function AuthView({ navigate }: AuthViewProps) {
  const { login } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<'login' | 'register' | 'invite'>('login');
  const form = useForm({ initialValues: { username: '', password: '', inviteCode: '' }, validate: { username: value => value ? null : t('auth.fillAllFields'), password: value => value ? null : t('auth.fillAllFields'), inviteCode: value => tab !== 'invite' || value ? null : t('auth.fillAllFields') } });
  const { username, password, inviteCode } = form.values;
  const { setValues } = form;
  const { busy: submitting, run } = useBusyAction();
  const [error, setError] = useState('');
  const [config, setConfig] = useState<AuthConfig>({ allowRegistration: true, invitesEnabled: false, turnstileSiteKey: null, demoMode: false });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const userRef = useRef<HTMLInputElement>(null);
  const inviteRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<AuthConfig>('GET', '/api/auth/config').then((cfg) => {
      setConfig(cfg);
      if (cfg.demoMode) setValues(DEMO_ACCOUNT);
    }).catch(() => {});
  }, [setValues]);

  useEffect(() => {
    if (tab === 'invite' && inviteRef.current) inviteRef.current.focus();
    else if (userRef.current) userRef.current.focus();
  }, [tab]);

  useEffect(() => {
    const siteKey = config.turnstileSiteKey;
    if (!siteKey || tab === 'login') return;
    setTurnstileToken(null);

    const scriptId = 'cf-turnstile-script';
    const renderWidget = () => {
      const w = window as unknown as { turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => void } };
      if (turnstileRef.current && w.turnstile) {
        while (turnstileRef.current.firstChild) turnstileRef.current.removeChild(turnstileRef.current.firstChild);
        w.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
        });
      }
    };

    if (document.getElementById(scriptId)) {
      renderWidget();
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [config.turnstileSiteKey, tab]);

  const submit = () => run(async () => {
    setError('');
    const effectiveTab = !config.allowRegistration ? 'login' : tab;
    const endpoint = tab === 'invite' ? '/api/auth/redeem-invite' : effectiveTab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = tab === 'invite' ? { code: inviteCode, username, password, turnstile_token: turnstileToken }
      : effectiveTab === 'login' ? { username, password } : { username, password, turnstile_token: turnstileToken };
    const data = await api<AuthResponse>('POST', endpoint, body);
    login(data);
    navigate('browse', {}, { leave: true });
  }, (e) => setError(errorMessage(e)));

  const showTabs = config.allowRegistration;
  const showInviteLink = !config.allowRegistration && config.invitesEnabled && tab !== 'invite';

  return (
    <Center mih="calc(100vh - 56px)">
      <Paper component="form" w="100%" maw={400} py={{ base: 24, xs: 44 }} px={{ base: 24, xs: 40 }} radius={14} bg="var(--ui-modal-bg)" withBorder onSubmit={(event) => form.onSubmit(submit)(event)}>
        <Text fz={36} fw={700} c="var(--cv-brand)" ta="center" mb={6}>{t('auth.logo')}</Text>
        <Text fz={13} c="dimmed" ta="center" mb={28}>{t('auth.tagline')}</Text>
        {showTabs && (
          <Tabs value={tab === 'login' ? 'login' : 'register'} onChange={(value) => setTab(value === 'login' ? 'login' : 'register')} mb={24}>
            <Tabs.List grow><Tabs.Tab value="login">{t('auth.signIn')}</Tabs.Tab><Tabs.Tab value="register">{t('auth.register')}</Tabs.Tab></Tabs.List>
          </Tabs>
        )}
        {tab === 'invite' && (
          <TextInput mb={14} label={<>{t('auth.inviteCode')}</>} type="text" ref={inviteRef} {...form.getInputProps('inviteCode')} placeholder={t('auth.inviteCodePlaceholder')} autoComplete="off" />
        )}
        <TextInput mb={14} label={<>{t('auth.username')}</>} type="text" ref={userRef} id="auth-user" {...form.getInputProps('username')} placeholder={t('auth.usernamePlaceholder')} autoComplete="username" />
        <PasswordInput mb={14} label={<>{t('auth.password')}</>} {...form.getInputProps('password')} placeholder="••••••••" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
        {config.turnstileSiteKey && tab !== 'login' && <Box ref={turnstileRef} mt={8} />}
        <Button fullWidth id="auth-submit" mt={8} type="submit" loading={submitting} disabled={submitting}>
          {tab === 'invite' ? t('auth.createAccount') : (tab === 'login' || !showTabs ? t('auth.signIn') : t('auth.createAccount'))}
        </Button>
        {showInviteLink && (
          <Button variant="default" fullWidth mt={10} onClick={() => setTab('invite')}>{t('auth.haveInvite')}</Button>
        )}
        {tab === 'invite' && (
          <Box ta="center" mt={12}>
            <Anchor href="#" onClick={(e) => { e.preventDefault(); setTab('login'); }} fz={13} c="dimmed" underline="never">{t('auth.backToLogin')}</Anchor>
          </Box>
        )}
        {error && <Text role="alert" c="red.6" fz={13} mt={12} ta="center">{error}</Text>}
      </Paper>
    </Center>
  );
}
