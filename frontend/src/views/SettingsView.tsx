import { OfflineLibrarySettings } from '../components/OfflineLibrarySettings';
import { useOffline } from '../context/OfflineContext';
import { Anchor, Box, Group, Text, Select, Paper, Pill, Button, NativeSelect, PasswordInput, Stack, Textarea, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useBusyAction } from '../hooks/useBusyAction';
import { useStatusMessage } from '../hooks/useStatusMessage';
import { StatusText } from '../components/StatusText';
import { downloadBlob } from '../lib/download';
import { errorMessage } from '../lib/errors';
import { LANGUAGES, languageName } from '../lib/languages';
import { useDemo } from '../context/DemoContext';
import { useAuth } from '../context/AuthContext';
import { exportSongsBlob } from '../lib/api';
import { ImportModal } from '../components/ImportModal';
import { GeminiKeySettings } from '../components/GeminiKeySettings';
import { MAX_PREFERRED_LANGUAGES, MAX_OCR_PROMPT, MIN_PASSWORD_LENGTH, DEFAULT_GEMINI_MODEL } from '../lib/constants';
import { PageTitle } from '../components/PageTitle';

export function SettingsView() {
  const { readOnly } = useOffline();
  const apiCall = useApi();
  const { demoMode } = useDemo();
  const { user, isAdmin } = useAuth();
  const passwordForm = useForm({ initialValues: { currentPw: '', newPw: '', confirmPw: '' }, validate: { currentPw: value => value ? null : 'All fields are required', newPw: value => value.length >= MIN_PASSWORD_LENGTH ? null : `New password must be at least ${MIN_PASSWORD_LENGTH} characters`, confirmPw: (value, values) => value === values.newPw ? null : 'New passwords do not match' } });
  const { currentPw, newPw } = passwordForm.values;
  const pwStatus = useStatusMessage();
  const langStatus = useStatusMessage();
  const promptStatus = useStatusMessage();
  const modelStatus = useStatusMessage();
  const exportStatus = useStatusMessage();
  const passwordAction = useBusyAction();
  const exportAction = useBusyAction();
  const [preferredLangs, setPreferredLangs] = useState<string[]>([]);
  const [ocrPrompt, setOcrPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [ocrModel, setOcrModel] = useState(DEFAULT_GEMINI_MODEL);
  const [modelList, setModelList] = useState<{ id: string; label: string }[]>([]);
  const [showImport, { open: openImport, close: closeImport }] = useDisclosure(false);

  const loadPreferredLangs = useCallback(async () => {
    try {
      const data = await apiCall<{ languages: string[] }>('GET', '/api/settings/languages');
      setPreferredLangs(data.languages);
    } catch {}
  }, [apiCall]);

  const loadOcrPrompt = useCallback(async () => {
    try {
      const data = await apiCall<{ prompt: string | null; defaultPrompt: string }>('GET', '/api/settings/ocr-prompt');
      setDefaultPrompt(data.defaultPrompt);
      if (data.prompt) {
        setOcrPrompt(data.prompt);
        setHasCustomPrompt(true);
      }
    } catch {}
  }, [apiCall]);

  const loadOcrModel = useCallback(async () => {
    try {
      const data = await apiCall<{ model: string; models: { id: string; label: string }[] }>('GET', '/api/settings/ocr-model');
      setOcrModel(data.model);
      setModelList(data.models);
    } catch {}
  }, [apiCall]);

  useEffect(() => { loadOcrPrompt(); loadOcrModel(); }, [loadOcrPrompt, loadOcrModel]);
  useEffect(() => { loadPreferredLangs(); }, [loadPreferredLangs]);

  const changePassword = () => passwordAction.run(async () => {
    pwStatus.clear();
    await apiCall('PUT', '/api/auth/password', { current_password: currentPw, new_password: newPw });
    pwStatus.succeed('Password changed successfully');
    passwordForm.reset();
  }, (e) => pwStatus.fail(errorMessage(e)));

  const saveOcrModel = async (model: string) => {
    setOcrModel(model);
    modelStatus.clear();
    try {
      await apiCall('PUT', '/api/settings/ocr-model', { model });
      modelStatus.succeed('Default model saved');
    } catch (e) { modelStatus.fail(errorMessage(e)); }
  };

  const saveOcrPrompt = async () => {
    promptStatus.clear();
    if (!ocrPrompt.trim()) { promptStatus.fail('Prompt cannot be empty'); return; }
    if (ocrPrompt.length > MAX_OCR_PROMPT) { promptStatus.fail(`Prompt must be under ${MAX_OCR_PROMPT} characters`); return; }
    try {
      await apiCall('PUT', '/api/settings/ocr-prompt', { prompt: ocrPrompt });
      promptStatus.succeed('Custom prompt saved');
      setHasCustomPrompt(true);
    } catch (e) { promptStatus.fail(errorMessage(e)); }
  };

  const resetOcrPrompt = async () => {
    try {
      await apiCall('DELETE', '/api/settings/ocr-prompt');
      setOcrPrompt('');
      setHasCustomPrompt(false);
      promptStatus.succeed('Reset to default prompt');
    } catch (e) { promptStatus.fail(errorMessage(e)); }
  };

  const saveLanguages = async (updated: string[]) => {
    try {
      await apiCall('PUT', '/api/settings/languages', { languages: updated });
      setPreferredLangs(updated);
      langStatus.succeed('Saved');
    } catch (e) { langStatus.fail(errorMessage(e)); }
  };
  const addLang = (code: string) => { if (!preferredLangs.includes(code)) void saveLanguages([...preferredLangs, code]); };
  const removeLang = (code: string) => saveLanguages(preferredLangs.filter((c) => c !== code));

  const handleExport = () => {
    const token = user?.token;
    if (!token) return;
    void exportAction.run(async () => {
      exportStatus.clear();
      const { blob, filename } = await exportSongsBlob(token);
      downloadBlob(blob, filename);
    }, (e) => exportStatus.fail(errorMessage(e)));
  };

  return (
    <>
      <Group justify="space-between" mb="lg"><PageTitle className="view-title">Settings</PageTitle></Group>
      <OfflineLibrarySettings />
      <Box component="fieldset" disabled={readOnly} bd={0} p={0} m={0} miw={0} mt="lg">
      <div className="settings-grid">
        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>Change Password</Title>
          {demoMode ? (
            <Text size="sm" c="dimmed">Disabled in demo mode</Text>
          ) : (
            <Stack gap="sm" renderRoot={(props) => <form {...props} onSubmit={passwordForm.onSubmit(changePassword)} />}>
              <PasswordInput label={<>Current Password</>} type="password" {...passwordForm.getInputProps('currentPw')} autoComplete="current-password" />
              <PasswordInput label={<>New Password</>} type="password" {...passwordForm.getInputProps('newPw')} autoComplete="new-password" />
              <PasswordInput label={<>Confirm New Password</>} type="password" {...passwordForm.getInputProps('confirmPw')} autoComplete="new-password" />
              <Button style={{ alignSelf: 'flex-start' }} type="submit" loading={passwordAction.busy} disabled={passwordAction.busy}>Change Password</Button>
              <StatusText status={pwStatus.status} />
            </Stack>
          )}
        </Paper>

        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>My Languages</Title>
          <Text size="sm" c="dimmed" mb="sm">
            Your preferred languages appear at the top of the language picker when creating songs.
          </Text>
          <Stack gap="sm">
            <Group gap="xs">
              {preferredLangs.map(code => (
                <Pill key={code} size="md" withRemoveButton onRemove={() => removeLang(code)} removeButtonProps={{ 'aria-label': `Remove ${languageName(code)}`, 'aria-hidden': false, tabIndex: 0 }}>
                  {languageName(code)}
                </Pill>
              ))}
              {preferredLangs.length === 0 && <Text size="sm" c="dimmed">No languages set</Text>}
            </Group>
            {preferredLangs.length < MAX_PREFERRED_LANGUAGES && (
              <Select searchable label="Add a language" placeholder="Search languages" value={null} data={LANGUAGES.filter(language => !preferredLangs.includes(language.code)).map(language => ({ value: language.code, label: `${language.name} (${language.code})` }))} onChange={(value) => { if (value) addLang(value); }} />
            )}
            <StatusText status={langStatus.status} />
          </Stack>
        </Paper>

        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>{isAdmin ? 'Import & Export' : 'Export Songs'}</Title>
          <Text size="sm" c="dimmed" mb="sm">
            Download all songs you can access as ChordPro (.cho) files in a zip.
            {isAdmin ? ' As an admin, you can also bulk import ChordPro files into the library.' : ''}
          </Text>
          <Stack gap="sm">
            <Group>
              {isAdmin && (
                <Button size="xs" className="btn btn-sm" onClick={openImport}>Import Songs</Button>
              )}
              <Button size="xs" className="btn btn-sm" onClick={handleExport} disabled={exportAction.busy}>
                {exportAction.busy ? 'Exporting…' : 'Export Songs'}
              </Button>
            </Group>
            <StatusText status={exportStatus.status} />
          </Stack>
          <ImportModal opened={showImport} onClose={closeImport} onDone={() => {}} />
        </Paper>

        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>OCR: API Key</Title>
          <Text size="sm" c="dimmed" mb="sm">
            Smart OCR uses Google Gemini to extract chords from photos with higher accuracy. Get a free API key at{' '}
            <Anchor href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" inherit>aistudio.google.com/apikey</Anchor>
          </Text>
          <GeminiKeySettings />
        </Paper>

        <Paper component="section" withBorder radius="lg" p="lg" bg="var(--cv-raise)" className="settings-section">
          <Title order={3} fz={16} mb={4}>OCR: Model &amp; Prompt</Title>
          <Text size="sm" c="dimmed" mb="sm">
            Choose which Gemini model to use for OCR and customize the extraction prompt. You can also change the model per-extraction in the OCR modal.
          </Text>
          <Stack gap="sm">
            <Box>
              <NativeSelect label={<>Model</>}
                value={ocrModel}
                onChange={(e) => saveOcrModel(e.target.value)}
              >
                {modelList.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </NativeSelect>
              <StatusText status={modelStatus.status} mt={4} />
            </Box>
            <Box>
              <Textarea label={<>Prompt</>}
                value={ocrPrompt}
                onChange={(e) => setOcrPrompt(e.target.value)}
                placeholder={defaultPrompt}
                rows={7}
                maxLength={MAX_OCR_PROMPT}
                styles={{ input: { fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' } }}
              />
              <Text size="xs" c="dimmed" ta="right" mt={4}>
                {ocrPrompt.length} / {MAX_OCR_PROMPT}
              </Text>
            </Box>
            <Group gap="xs">
              <Button size="xs" className="btn btn-sm" onClick={saveOcrPrompt}>Save Prompt</Button>
              {!ocrPrompt && (
                <Button size="xs" className="btn btn-sm" style={{ background: 'var(--surface-alt, var(--surface))' }} onClick={() => setOcrPrompt(defaultPrompt)}>
                  Copy Default
                </Button>
              )}
              {hasCustomPrompt && (
                <Button color="red" size="xs" className="btn btn-danger btn-sm" onClick={resetOcrPrompt}>Reset to Default</Button>
              )}
            </Group>
            <StatusText status={promptStatus.status} />
          </Stack>
        </Paper>
      </div>
      </Box>
    </>
  );
}
