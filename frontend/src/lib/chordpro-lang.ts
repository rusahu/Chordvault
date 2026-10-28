import { StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { CHORD_TOKEN, SECTION_DIRECTIVE } from './chordTokens';

const chordProParser = StreamLanguage.define({
  languageData: { closeBrackets: { brackets: ['[', '{'] } },
  token(stream) {
    // Chord in brackets: [Am7], [G/B]
    if (stream.match(CHORD_TOKEN)) return 'keyword';
    // Section directives: {verse}, {chorus}, {bridge}, {start_of_chorus}, etc.
    if (stream.match(SECTION_DIRECTIVE)) return 'heading';
    // Metadata directives: {title:}, {artist:}, {key:}, {tempo:}, {capo:}, etc.
    if (stream.match(/\{[^}]*\}/)) return 'meta';
    // Comment lines starting with #
    if (stream.sol() && stream.match(/#.*/)) return 'comment';
    // Skip to next token
    stream.next();
    return null;
  },
});

// --chord (#e6a530) = amber for chords (matches existing chord rendering)
// --accent-alt (#7a9bb5) = steel blue for section directives
const chordProHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--chord)' },
  { tag: tags.heading, color: 'var(--accent-alt)', fontWeight: 'bold' },
  { tag: tags.meta, color: 'var(--muted)' },
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
]);

export const chordProLanguage = chordProParser;
export const chordProHighlightStyle = syntaxHighlighting(chordProHighlight);
