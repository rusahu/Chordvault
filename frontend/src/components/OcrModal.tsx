import { Progress, Modal, Button, FileInput, TextInput, Textarea, Stack, Group, Text, Paper, Image, ScrollArea } from '@mantine/core';
import { useTimeout } from '@mantine/hooks';
import { IconFileText, IconSparkles } from '@tabler/icons-react';
import { useState, useRef, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { showStatusNotification as toast } from '../lib/notifications';
import { errorMessage } from '../lib/errors';
import { useStackedModalProps } from '../hooks/useStackedModalProps';
import { useActiveRef } from '../hooks/useActiveRef';
import { readFile } from '../lib/files';
import { DEFAULT_GEMINI_MODEL } from '../lib/constants';
import { ModelSelect } from './ModelSelect';
import { getOcrModels, type OcrModels } from '../lib/settingsApi';

interface OcrModalProps {
  opened: boolean;
  hasGeminiKey: boolean;
  onResult: (text: string, language?: string | null) => void;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export function OcrModal({ opened, hasGeminiKey, onResult, onClose }: OcrModalProps) {
  const stacked = useStackedModalProps();
  return (
    <Modal opened={opened} onClose={onClose} title="Import from image or PDF" {...stacked}>
      {opened && <OcrContent hasGeminiKey={hasGeminiKey} onResult={onResult} onClose={onClose} />}
    </Modal>
  );
}

function OcrContent({ hasGeminiKey, onResult, onClose }: Omit<OcrModalProps, 'opened'>) {
  const active = useActiveRef();
  const api = useApi();
  const [file, setFile] = useState<File | null>(null);
  const previewFile = useRef<File | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { start: scrollToLatest } = useTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultText, setResultText] = useState('');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Model selection
  const [selectedModel, setSelectedModel] = useState(DEFAULT_GEMINI_MODEL);
  const [models, setModels] = useState<OcrModels['models']>([]);

  useEffect(() => {
    getOcrModels(api)
      .then(data => { if (active.current) { setSelectedModel(data.model); setModels(data.models); } })
      .catch(() => {});
  }, [api, active]);

  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [fixInput, setFixInput] = useState('');
  const [refining, setRefining] = useState(false);

  const handleFile = (selected: File | null) => {
    previewFile.current = selected;
    setFile(selected);
    setPreview(null);
    setIsPdf(selected?.type === 'application/pdf');
    setResultText('');
    setChatHistory([]);
    setImageBase64(null);
    setDetectedLang(null);
    setProgress(0);
    if (!selected) return;
    if (selected.type === 'application/pdf') {
      setPreview(selected.name);
    } else {
      readFile(selected, 'dataURL').then(url => { if (active.current && previewFile.current === selected) setPreview(url); }, () => {});
    }
  };

  const process = async () => {
    if (processing) return;
    if (!file) { toast('Please select a file first', 'error'); return; }
    if (!hasGeminiKey) { toast('Please set up your Gemini API key in Settings first', 'error'); return; }

    setProcessing(true);
    setProgress(0);
    setChatHistory([]);
    try {
      setProgress(10);
      const base64 = await readFile(file, 'dataURL');
      if (!active.current) return;
      setImageBase64(base64);
      setProgress(30);
      const result = await api<{ text: string; language: string | null }>('POST', '/api/ocr/gemini', { image: base64, model: selectedModel });
      if (!active.current) return;
      setProgress(100);
      setResultText(result.text);
      setDetectedLang(result.language);
      // Seed chat history with the initial model response
      setChatHistory([{ role: 'model', text: result.text }]);
    } catch (e) {
      if (active.current) toast(`OCR failed: ${errorMessage(e)}`, 'error');
    }
    if (active.current) setProcessing(false);
  };

  const sendFix = async () => {
    const msg = fixInput.trim();
    if (refining || !msg || !imageBase64) return;

    setRefining(true);
    setFixInput('');
    const newHistory = [...chatHistory, { role: 'user' as const, text: msg }];
    setChatHistory(newHistory);

    try {
      const result = await api<{ text: string }>('POST', '/api/ocr/gemini/refine', {
        image: imageBase64,
        history: chatHistory,
        message: msg,
        model: selectedModel,
      });
      if (!active.current) return;
      setResultText(result.text);
      setChatHistory([...newHistory, { role: 'model', text: result.text }]);
      scrollToLatest();
    } catch (e) {
      if (!active.current) return;
      toast(`Fix failed: ${errorMessage(e)}`, 'error');
      // Remove the user message on failure
      setChatHistory(chatHistory);
    }
    if (active.current) setRefining(false);
  };

  const useResult = () => {
    onResult(resultText, detectedLang);
    onClose();
    toast('Text imported — review and edit before saving', 'success');
  };

  const hasCorrections = chatHistory.filter(m => m.role === 'user').length > 0;

  return (
    <Stack gap={12}>
      {/* Hide file selection after extraction to leave room for corrections. */}
      {!resultText && (
        <>
          <FileInput
            label="Select image or PDF"
            value={file}
            onChange={handleFile}
            accept="image/*,application/pdf"
            disabled={processing}
            clearable
            clearButtonProps={{ 'aria-label': 'Clear selected file', disabled: processing }}
            fileInputProps={{ 'aria-label': 'Image or PDF file upload' }}
          />
          {preview && (isPdf ? (
            <Paper p={12} bg="var(--surface2)" radius="md">
              <Group gap={6} wrap="nowrap"><IconFileText size={18} aria-hidden /><Text c="dimmed" fz={13} style={{ overflowWrap: 'anywhere' }}>{preview}</Text></Group>
            </Paper>
          ) : (
            <Image src={preview} alt="Preview" mah={200} w="auto" maw="100%" fit="contain" radius="md" bd="1px solid var(--border)" />
          ))}
          {!hasGeminiKey && (
            <Paper p={10} bg="var(--surface)" radius="md">
              <Text c="dimmed" fz={13}>Requires a Gemini API key. Set one up in Settings.</Text>
            </Paper>
          )}
          {models.length > 0 && (
            <ModelSelect label="Model" models={models} value={selectedModel} onChange={setSelectedModel} disabled={processing} />
          )}
          <Button onClick={process} loading={processing} disabled={processing} fullWidth size="md" leftSection={<IconSparkles size={18} aria-hidden />}>
            {processing ? 'Processing...' : 'Extract text'}
          </Button>
          {(processing || progress > 0) && <Progress value={progress} aria-label="OCR progress" />}
        </>
      )}
      {resultText && (
        <>
          {hasCorrections && (
            <ScrollArea.Autosize mah={120} mb="xs">
              <Stack gap={4}>
                {chatHistory.slice(1).map((m, i) => (
                  <Paper key={i} px="xs" py={6} radius="md" maw="85%" fz="xs"
                    bg={m.role === 'user' ? 'var(--accent-bg)' : 'var(--surface2)'}
                    c={m.role === 'user' ? 'var(--accent)' : 'dimmed'}
                    style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', overflowWrap: 'anywhere' }}>
                    {m.role === 'user' ? m.text : '\u2713 Fix applied'}
                  </Paper>
                ))}
                <div ref={chatEndRef} />
              </Stack>
            </ScrollArea.Autosize>
          )}
          <Textarea
            label={hasCorrections ? 'Corrected result' : 'Extracted text'}
            description={hasCorrections ? `${chatHistory.filter(m => m.role === 'user').length} fixes applied` : undefined}
            readOnly value={resultText}
            styles={{ input: { minHeight: 200, maxHeight: 300, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6 } }}
          />
          {detectedLang && <Text c="dimmed" fz={13}>Detected language: <strong>{detectedLang}</strong></Text>}
          {models.length > 0 && (
            <ModelSelect aria-label="Correction model" models={models} value={selectedModel} onChange={setSelectedModel} disabled={refining} size="xs" />
          )}
          <Group gap={6} wrap="nowrap" align="flex-start">
            <TextInput aria-label="Describe what to fix..." flex={1} miw={0}
              placeholder="Describe what to fix..." value={fixInput}
              onChange={(e) => setFixInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFix(); } }}
              disabled={refining}
            />
            <Button onClick={sendFix} loading={refining} disabled={refining || !fixInput.trim()}>Fix</Button>
          </Group>
          <Text c="dimmed" fz={12}>e.g. "move the G chord to the next word" or "verse 2 should be Am not Em"</Text>
          <Group gap={8}>
            <Button onClick={useResult}>Use this</Button>
            <Button variant="default" onClick={onClose}>Cancel</Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
