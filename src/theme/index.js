export const Colors = {
  // App-Todo-Weather "Azure Horizon / Atmospheric Curator" Logic Update
  primary: '#00668a',
  primaryContainer: '#00bfff',
  onPrimary: '#ffffff',
  secondary: '#005ac1',
  secondaryContainer: '#4d8efe',
  tertiary: '#005bc0',
  background: '#f7f9ff',
  surface: '#f7f9ff',
  surfaceContainer: '#ebeef4',
  surfaceContainerLow: '#f1f4fa',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerHigh: '#e5e8ee',
  surfaceContainerHighest: '#dfe3e8',
  text: '#181c20', // on_surface
  textSecondary: '#3d4850', // on_surface_variant
  outline: '#6d7981',
  outlineVariant: '#bcc8d1',
  error: '#ba1a1a',
  glass: 'rgba(255, 255, 255, 0.75)',
  shadow: 'rgba(0, 74, 101, 0.08)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  huge: 64,
};

export const Typography = {
  // Plus Jakarta Sans for Display/Headline, Inter for Body
  display: {
    fontSize: 64,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -2,
  },
  h1: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  body: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
};
