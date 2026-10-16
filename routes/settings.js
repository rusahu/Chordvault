const express = require('express');
const User = require('../lib/models/user');
const { requireAuth } = require('../lib/auth');
const { GEMINI_MODELS, isValidGeminiModel, resolveGeminiModel } = require('../lib/constants');
const { validateObjectBody, assertValid, validatePreferredLanguages, validateGeminiApiKey, validateOcrPrompt, validateOcrImage, validateRefineInput } = require('../lib/validation');
const { LANGUAGE_CODES } = require('../lib/languages');
const { AppError } = require('../lib/errors');
const { imageTurn, stripFences, callGemini } = require('../lib/gemini');
const { jsonToChordPro } = require('../lib/ocr-convert');
const { encryptApiKey, loadGeminiCredentials } = require('../lib/geminiKey');
const { DEFAULT_OCR_PROMPT, OCR_JSON_SCHEMA, OCR_REFINE_PROMPT } = require('../lib/ocrPrompts');

const DETECTED_LANGUAGE_RE = /^DETECTED_LANGUAGE:\s*([a-z]{2})\s*$/m;

/** Custom prompts reply in text with an optional DETECTED_LANGUAGE line. */
function readLegacyOcrText(text) {
  const match = text.match(DETECTED_LANGUAGE_RE);
  return {
    text: stripFences(text.replace(DETECTED_LANGUAGE_RE, '')),
    language: match && LANGUAGE_CODES.has(match[1]) ? match[1] : null,
  };
}

function createSettingsRouter() {
  const router = express.Router();
  router.use(validateObjectBody);
  router.use(['/settings', '/ocr'], requireAuth);

  router.put('/settings/gemini-key', (req, res) => {
    const { api_key } = req.body;
    assertValid(validateGeminiApiKey(api_key));
    const encrypted = encryptApiKey(api_key);
    User.updateGeminiApiKey(req.user.id, encrypted);
    res.json({ success: true });
  });

  router.delete('/settings/gemini-key', (req, res) => {
    User.updateGeminiApiKey(req.user.id, null);
    res.json({ success: true });
  });

  router.get('/settings/gemini-key', (req, res) => {
    const user = User.getFullById(req.user.id);
    res.json({ hasKey: !!user?.gemini_api_key });
  });

  router.get('/settings/ocr-prompt', (req, res) => {
    const user = User.getFullById(req.user.id);
    res.json({ prompt: user?.gemini_prompt || null, defaultPrompt: DEFAULT_OCR_PROMPT });
  });

  router.put('/settings/ocr-prompt', (req, res) => {
    const { prompt } = req.body;
    assertValid(validateOcrPrompt(prompt));
    User.updateGeminiPrompt(req.user.id, prompt.trim());
    res.json({ success: true });
  });

  router.delete('/settings/ocr-prompt', (req, res) => {
    User.updateGeminiPrompt(req.user.id, null);
    res.json({ success: true });
  });

  router.get('/settings/languages', (req, res) => {
    const user = User.getFullById(req.user.id);
    const languages = user?.preferred_languages ? user.preferred_languages.split(',').filter(Boolean) : [];
    res.json({ languages });
  });

  router.put('/settings/languages', (req, res) => {
    const languages = req.body.languages ?? [];
    assertValid(validatePreferredLanguages(languages));
    const value = languages.length > 0 ? languages.join(',') : null;
    User.updatePreferredLanguages(req.user.id, value);
    res.json({ success: true });
  });

  router.get('/settings/ocr-model', (req, res) => {
    const user = User.getFullById(req.user.id);
    res.json({
      model: resolveGeminiModel(user?.gemini_model),
      models: GEMINI_MODELS,
    });
  });

  router.put('/settings/ocr-model', (req, res) => {
    const { model } = req.body;
    if (!model || !isValidGeminiModel(model)) throw new AppError('Invalid model', 400);
    User.updateGeminiModel(req.user.id, model);
    res.json({ success: true });
  });

  router.post('/ocr/gemini', async (req, res) => {
    const { image, model: requestModel } = req.body;
    assertValid(validateOcrImage(image));
    const { user, apiKey, model } = loadGeminiCredentials(req.user.id, requestModel);

    const isJsonMode = !user.gemini_prompt;

    const text = await callGemini({
      apiKey,
      model,
      contents: [imageTurn(user.gemini_prompt || DEFAULT_OCR_PROMPT, image)],
      schema: isJsonMode ? OCR_JSON_SCHEMA : undefined,
      subject: 'image',
      retryHint: 'Try a clearer photo.',
    });

    if (isJsonMode) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new AppError('Gemini returned invalid JSON. Try again.', 502, 'GEMINI_BAD_JSON');
      }
      let result;
      try {
        result = jsonToChordPro(parsed);
      } catch (e) {
        // Schema-valid JSON can still have a shape the converter rejects.
        throw new AppError(`Gemini error: ${e.message}`, 502, 'GEMINI_CONVERT');
      }
      return res.json({ text: result.text, language: result.language });
    }

    // Legacy text mode (custom prompt users)
    res.json(readLegacyOcrText(text));
  });

  // Refinement endpoint — multi-turn conversation with image context
  router.post('/ocr/gemini/refine', async (req, res) => {
    const { image, history, message, model: requestModel } = req.body;
    assertValid(validateRefineInput({ image, history, message }));
    const { user, apiKey, model } = loadGeminiCredentials(req.user.id, requestModel);

    // Refine always uses text-based prompt for context (even if initial extraction used JSON mode)
    const contents = [{ role: 'user', ...imageTurn(user.gemini_prompt || OCR_REFINE_PROMPT, image) }];
    contents.push(...history.map(({ role, text }) => ({ role, parts: [{ text }] })));
    contents.push({
      role: 'user',
      parts: [{ text: `The user wants to fix the chord sheet. Here is their correction:\n\n${message}\n\nApply the correction and return the FULL corrected ChordPro text. Do not include explanations, just the corrected text.` }]
    });

    const text = await callGemini({
      apiKey,
      model,
      contents,
      retryHint: 'Try rephrasing your correction.',
    });

    res.json({ text: stripFences(text) });
  });

  return router;
}

module.exports = { createSettingsRouter };
