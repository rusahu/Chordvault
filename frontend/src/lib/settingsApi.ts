import type { ApiCaller } from './api';

export interface OcrModels {
  model: string;
  models: { id: string; label: string }[];
}

export const getLanguages = (call: ApiCaller) =>
  call<{ languages: string[] }>('GET', '/api/settings/languages').then(d => d.languages);

export const getOcrModels = (call: ApiCaller) => call<OcrModels>('GET', '/api/settings/ocr-model');

export const getGeminiKeySaved = (call: ApiCaller) =>
  call<{ hasKey: boolean }>('GET', '/api/settings/gemini-key').then(d => d.hasKey);
