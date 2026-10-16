import { chordVaultTheme, chordVaultVariables } from '../theme';
import { createTheme, mergeMantineTheme, DEFAULT_THEME } from '@mantine/core';

const resolved = chordVaultVariables(mergeMantineTheme(DEFAULT_THEME, createTheme(chordVaultTheme)));

describe('Rubric palette', () => {
  it('fills selected controls in dark mode with the dark text colour', () => {
    expect(chordVaultTheme.primaryShade).toEqual({ light: 9, dark: 0 });
    expect(chordVaultTheme.colors!.ink![0]).toBe(resolved.dark['--mantine-color-text']);
  });

  it('uses the neutral paper and ink in light mode', () => {
    expect(resolved.light['--mantine-color-body']).toBe('#faf8f4');
    expect(resolved.light['--mantine-color-text']).toBe('#1d1b19');
    expect(resolved.light['--cv-band']).toBe('#efece6');
  });

  it('uses warm charcoal, not Mantine neutral gray, in dark mode', () => {
    expect(resolved.dark['--mantine-color-body']).toBe('#171615');
    expect(resolved.dark['--cv-band']).toBe('#211f1e');
    expect(chordVaultTheme.colors?.dark?.[7]).toBe('#171615');
  });

  it('keeps the settled brick chords', () => {
    expect(resolved.light['--cv-chord']).toBe('#8e3f3b');
    expect(resolved.dark['--cv-chord']).toBe('#dda19b');
  });

  it('replaces the cool gray disabled colors', () => {
    expect(resolved.light['--mantine-color-disabled']).toBe('#efece6');
    expect(resolved.dark['--mantine-color-disabled']).toBe('#211f1e');
  });
});

describe('control variants', () => {
  const theme = mergeMantineTheme(DEFAULT_THEME, createTheme(chordVaultTheme));
  const resolve = (variant: string) => chordVaultTheme.variantColorResolver!({ color: 'ink', theme, variant });

  it('puts light controls on the taupe tray', () => {
    expect(resolve('light')).toMatchObject({ background: 'var(--cv-ctrl)', hover: 'var(--cv-ctrl-hover)', color: 'var(--mantine-color-text)' });
  });

  it('keeps filled ink as the selected state', () => {
    expect(resolve('filled').color).toBe('var(--mantine-primary-color-contrast)');
  });
});

describe('badges', () => {
  it('default to sentence case on the control tray', () => {
    expect(chordVaultTheme.components?.Badge?.defaultProps).toMatchObject({ variant: 'light', tt: 'none' });
  });
});

describe('selected-state text in dark mode', () => {
  // Mantine computes these once from the light primary shade, which is white
  // text in both schemes; dark mode's selected fill is light, so use the
  // per-scheme contrast variable instead.
  const theme = mergeMantineTheme(DEFAULT_THEME, createTheme(chordVaultTheme));
  const rootVars = (name: 'Chip' | 'Pagination') => {
    const vars = chordVaultTheme.components?.[name]?.vars as ((t: typeof theme, p: object) => { root: Record<string, string> }) | undefined;
    return vars?.(theme, {}).root ?? {};
  };

  it('keeps checked tag chips readable', () => {
    expect(rootVars('Chip')['--chip-color']).toBe('var(--mantine-primary-color-contrast)');
  });

  it('keeps the current page number readable', () => {
    expect(rootVars('Pagination')['--pagination-active-color']).toBe('var(--mantine-primary-color-contrast)');
  });
});

describe('fonts', () => {
  it('uses JetBrains Mono for Mantine monospace text', () => {
    expect(chordVaultTheme.fontFamilyMonospace).toMatch(/^"JetBrains Mono Variable"/);
  });
});
