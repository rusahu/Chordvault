// JSON-based prompt for structured OCR output (default mode)
const DEFAULT_OCR_PROMPT = `You are a chord sheet OCR tool. Extract chord/lyric data from this image into structured JSON.

For each line of lyrics, break it into segments. Each segment is a chord followed by the lyrics that play under that chord, up to the next chord.

RULES:
- Transcribe chords EXACTLY as shown (keep Gsus2, A/C#, Cmaj7 as-is).
- ONLY transcribe what is visible. NEVER add, invent, or reposition chords.
- Preserve all spacing between character groups in lyrics exactly as shown.
- For chord-only lines (intros, interludes), use segments with empty string lyrics.
- For lyric-only lines (no chords), use a single segment with null chord.
- If a chord is hard to read, give your best guess. Do NOT skip anything.
- Include section labels (Verse, Chorus, Bridge, Intro, Outro, etc.) in the label field.
- Include repeat markers (e.g. "x2") as part of the lyrics text.
- For metadata, only include what is clearly visible on the sheet.
- Set language to the ISO 639-1 code of the lyrics language (e.g. "en", "zh", "ko", "ja").`;

// Schema for Gemini structured output
const OCR_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    metadata: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        artist: { type: 'STRING' },
        key: { type: 'STRING' },
        capo: { type: 'STRING' },
        tempo: { type: 'STRING' },
        language: { type: 'STRING' },
      },
    },
    sections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          lines: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                segments: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      chord: { type: 'STRING', nullable: true },
                      lyrics: { type: 'STRING' },
                    },
                    required: ['lyrics'],
                  },
                },
              },
              required: ['segments'],
            },
          },
        },
        required: ['lines'],
      },
    },
  },
  required: ['sections'],
};

// Text-based prompt for refine endpoint and custom prompt fallback
const OCR_REFINE_PROMPT = `You are a chord sheet OCR tool. Transcribe this image/PDF into ChordPro format.

RULES:
- Place chords inline with lyrics using square brackets: [G]When I [C]find myself
- Each bracket must contain exactly ONE chord.
- Place each [chord] DIRECTLY before the syllable/word it belongs to.
- Transcribe chords EXACTLY as shown. Do NOT normalize or simplify chord names.
- ONLY transcribe what is visible. NEVER add, invent, or reposition chords.
- Preserve all spacing between character groups exactly as shown.
- Use ChordPro directives for metadata: {title: Song Title}, {artist: Artist Name}, {key: G}, {capo: 2}, {tempo: 120}
- Always add: {x_language: <ISO 639-1 code>}
- For chord-only lines: [G] [D] [Em] [C]
- Preserve repeat markers as plain text.

Return ONLY the ChordPro text, no explanations or markdown code fences.`;

module.exports = { DEFAULT_OCR_PROMPT, OCR_JSON_SCHEMA, OCR_REFINE_PROMPT };
