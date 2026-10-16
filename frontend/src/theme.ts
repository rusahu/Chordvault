import { Chip, createTheme, defaultVariantColorsResolver, Divider, localStorageColorSchemeManager, Pagination, Paper, Tabs, type CSSVariablesResolver } from '@mantine/core';

const fontFamily = '"Source Sans 3 Variable", "Noto Sans TC Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const chordVaultTheme = createTheme({
  fontFamily,
  fontFamilyMonospace: '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Consolas, monospace',
  headings: { fontFamily, fontWeight: '700' },
  primaryColor: 'ink',
  colors: {
    ink: ['#eeeae4', '#e8e4dd', '#d6d1c8', '#bdb7ad', '#a39c92', '#8a847a', '#6c6761', '#4a4642', '#2b2825', '#1d1b19'],
    dark: ['#eeeae4', '#c9c4bd', '#a8a29b', '#7d7872', '#433f3b', '#363331', '#2c2a28', '#171615', '#121110', '#0d0c0c'],
  },
  primaryShade: { light: 9, dark: 0 },
  defaultRadius: 'md',
  autoContrast: true,
  luminanceThreshold: 0.179,
  variantColorResolver: (input) => {
    const resolved = defaultVariantColorsResolver(input);
    if (input.color !== 'ink') return resolved;
    if (input.variant === 'filled') return { ...resolved, color: 'var(--mantine-primary-color-contrast)' };
    // Controls sit on the muted taupe tray rather than a tint of the ink colour.
    if (input.variant === 'light') return { ...resolved, background: 'var(--cv-ctrl)', hover: 'var(--cv-ctrl-hover)', color: 'var(--mantine-color-text)' };
    return resolved;
  },
  components: {
    Button: { defaultProps: { variant: 'light' } },
    ActionIcon: { defaultProps: { variant: 'subtle', size: 'lg' } },
    Badge: { defaultProps: { variant: 'light', size: 'lg', radius: 'xl', tt: 'none', fw: 600 } },
    // Mantine works these out once from the light shade; dark mode's selected fill is light, so follow the scheme.
    Chip: Chip.extend({ vars: () => ({ root: { '--chip-color': 'var(--mantine-primary-color-contrast)' } }) }),
    Pagination: Pagination.extend({ vars: () => ({ root: { '--pagination-active-color': 'var(--mantine-primary-color-contrast)' } }) }),
    // Borders in the app's line colour rather than Mantine's grey.
    Paper: Paper.extend({ styles: { root: { '--paper-border-color': 'var(--border)' } } }),
    Divider: Divider.extend({ vars: (_, props) => ({ root: { '--divider-color': props.color ? undefined : 'var(--border)' } }) }),
    Tabs: Tabs.extend({ styles: { root: { '--tab-border-color': 'var(--border)' } } }),
    Modal: { defaultProps: { centered: true, size: 'lg', overlayProps: { backgroundOpacity: 0.5, blur: 0 } } },
  },
});

export const colorSchemeManager = localStorageColorSchemeManager({ key: 'cv_theme' });

const light = {
  bg: '#faf8f4', band: '#efece6', ctrl: '#e8e4dd', ctrlHover: '#ddd8d0', line: '#e1ddd5', lineStrong: '#cfcac1',
  text: '#1d1b19', muted: '#6c6761', chord: '#8e3f3b', raise: '#fcfbf8',
};
const dark = {
  bg: '#171615', band: '#211f1e', ctrl: '#2c2a28', ctrlHover: '#363331', line: '#302d2b', lineStrong: '#433f3b',
  text: '#eeeae4', muted: '#a8a29b', chord: '#dda19b', raise: '#1c1b1a',
};

function schemeVariables(c: typeof light): Record<string, string> {
  return {
    '--mantine-color-body': c.bg,
    '--mantine-color-default': c.raise,
    '--mantine-color-default-hover': c.ctrlHover,
    '--mantine-color-default-color': c.text,
    '--mantine-color-default-border': c.lineStrong,
    '--mantine-color-text': c.text,
    '--mantine-color-dimmed': c.muted,
    '--mantine-color-disabled': c.band,
    '--mantine-color-disabled-color': c.muted,
    '--mantine-color-disabled-border': c.line,
    '--cv-chord': c.chord,
    '--cv-brand': c.chord,
    '--cv-surface': c.bg,
    '--cv-surface-secondary': c.band,
    '--cv-border': c.line,
    '--cv-band': c.band,
    '--cv-ctrl': c.ctrl,
    '--cv-ctrl-hover': c.ctrlHover,
    '--cv-line-strong': c.lineStrong,
    '--cv-raise': c.raise,
  };
}

export const chordVaultVariables: CSSVariablesResolver = () => ({
  variables: {},
  light: schemeVariables(light),
  dark: schemeVariables(dark),
});
