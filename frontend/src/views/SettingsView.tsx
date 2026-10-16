import { OfflineLibrarySettings } from '../components/OfflineLibrarySettings';
import { useOffline } from '../context/OfflineContext';
import { Anchor, Box, Group, Text, Select, Pill, Button, PasswordInput, Stack, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useBusyAction } from '../hooks/useBusyAction';
import { useStatusMessage } from '../hooks/useStatusMessage';
import { StatusText } from '../components/StatusText';
import { downloadBlob } from '../lib/download';
import { errorMessage } from '../lib/errors';
import { languageName, languageOptions } from '../lib/languages';
import { useDemo } from '../context/DemoContext';
import { useAuth } from '../context/AuthContext';
import { exportSongsBlob } from '../lib/api';
import { ImportModal } from '../components/ImportModal';
import { GeminiKeySettings } from '../components/GeminiKeySettings';
import { MAX_PREFERRED_LANGUAGES, MAX_OCR_PROMPT, MIN_PASSWORD_LENGTH, DEFAULT_GEMINI_MODEL } from '../lib/constants';
import { PageTitle } from '../components/PageTitle';
import { SettingsSection } from '../components/SettingsSection';
import { ModelSelect } from '../components/ModelSelect';
import { getLanguages, getOcrModels, type OcrModels } from '../lib/settingsApi';
import { useI18n } from '../context/I18nContext';

export function SettingsView() {
  const { readOnly } = useOffline();
  const { t } = useI18n();
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
  const [modelList, setModelList] = useState<OcrModels['models']>([]);
  const [showImport, { open: openImport, close: closeImport }] = useDisclosure(false);


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


  useEffect(() => {
    loadOcrPrompt();
    getOcrModels(apiCall).then(data => { setOcrModel(data.model); setModelList(data.models); }).catch(() => {});
    getLanguages(apiCall).then(setPreferredLangs).catch(() => {});
  }, [apiCall, loadOcrPrompt]);

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
        <SettingsSection title="Change Password">
          {demoMode ? (
            <Text size="sm" c="dimmed">{t('common.demoDisabled')}</Text>
          ) : (
            <Stack gap="sm" renderRoot={(props) => <form {...props} onSubmit={passwordForm.onSubmit(changePassword)} />}>
              <PasswordInput label={<>Current Password</>} type="password" {...passwordForm.getInputProps('currentPw')} autoComplete="current-password" />
              <PasswordInput label={<>New Password</>} type="password" {...passwordForm.getInputProps('newPw')} autoComplete="new-password" />
              <PasswordInput label={<>Confirm New Password</>} type="password" {...passwordForm.getInputProps('confirmPw')} autoComplete="new-password" />
              <Button style={{ alignSelf: 'flex-start' }} type="submit" loading={passwordAction.busy} disabled={passwordAction.busy}>Change Password</Button>
              <StatusText status={pwStatus.status} />
            </Stack>
          )}
        </SettingsSection>

        <SettingsSection title="My Languages">
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
              <Select searchable label="Add a language" placeholder="Search languages" value={null} data={languageOptions(code => !preferredLangs.includes(code))} onChange={(value) => { if (value) addLang(value); }} />
            )}
            <StatusText status={langStatus.status} />
          </Stack>
        </SettingsSection>

        <SettingsSection title={isAdmin ? 'Import & Export' : 'Export Songs'}>
          <Text size="sm" c="dimmed" mb="sm">
            Download all songs you can access as ChordPro (.cho) files in a zip.
            {isAdmin ? ' As an admin, you can also bulk import ChordPro files into the library.' : ''}
          </Text>
          <Stack gap="sm">
            <Group>
              {isAdmin && (
                <Button size="xs" onClick={openImport}>{t('admin.importSongs')}</Button>
              )}
              <Button size="xs" onClick={handleExport} disabled={exportAction.busy}>
                {exportAction.busy ? 'Exporting…' : 'Export Songs'}
              </Button>
            </Group>
            <StatusText status={exportStatus.status} />
          </Stack>
          <ImportModal opened={showImport} onClose={closeImport} />
        </SettingsSection>

        <SettingsSection title="OCR: API Key">
          <Text size="sm" c="dimmed" mb="sm">
            Smart OCR uses Google Gemini to extract chords from photos with higher accuracy. Get a free API key at{' '}
            <Anchor href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" inherit>aistudio.google.com/apikey</Anchor>
          </Text>
          <GeminiKeySettings />
        </SettingsSection>

        <SettingsSection title="OCR: Model & Prompt">
          <Text size="sm" c="dimmed" mb="sm">
            Choose which Gemini model to use for OCR and customize the extraction prompt. You can also change the model per-extraction in the OCR modal.
          </Text>
          <Stack gap="sm">
            <Box>
              <ModelSelect label="Model" models={modelList} value={ocrModel} onChange={saveOcrModel} />
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
              <Button size="xs" onClick={saveOcrPrompt}>Save Prompt</Button>
              {!ocrPrompt && (
                <Button size="xs" style={{ background: 'var(--surface-alt, var(--surface))' }} onClick={() => setOcrPrompt(defaultPrompt)}>
                  Copy Default
                </Button>
              )}
              {hasCustomPrompt && (
                <Button color="red" size="xs" onClick={resetOcrPrompt}>Reset to Default</Button>
              )}
            </Group>
            <StatusText status={promptStatus.status} />
          </Stack>
        </SettingsSection>
      </div>
      </Box>
    </>
  );
}
