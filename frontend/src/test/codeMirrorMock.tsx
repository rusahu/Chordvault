// Stands in for CodeMirrorEditor in view tests: jsdom cannot type into CodeMirror, a textarea can.
export function CodeMirrorEditor({ value, onChange, placeholder, ariaLabel = 'editor' }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return <textarea data-testid="editor" aria-label={ariaLabel} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
