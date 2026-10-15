import { getLanguages, getOcrModels, getGeminiKeySaved } from '../settingsApi';

const caller = (data: unknown) => vi.fn().mockResolvedValue(data);

it('reads the preferred languages', async () => {
  const call = caller({ languages: ['en', 'zh'] });
  expect(await getLanguages(call)).toEqual(['en', 'zh']);
  expect(call).toHaveBeenCalledWith('GET', '/api/settings/languages');
});

it('reads the OCR model choice and list', async () => {
  const data = { model: 'gemini-flash', models: [{ id: 'gemini-flash', label: 'Flash' }] };
  const call = caller(data);
  expect(await getOcrModels(call)).toEqual(data);
  expect(call).toHaveBeenCalledWith('GET', '/api/settings/ocr-model');
});

it('reads whether a Gemini key is saved', async () => {
  const call = caller({ hasKey: true });
  expect(await getGeminiKeySaved(call)).toBe(true);
  expect(call).toHaveBeenCalledWith('GET', '/api/settings/gemini-key');
});
