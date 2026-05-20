import { MD3LightTheme as DefaultTheme, useTheme } from 'react-native-paper';
import { ERIONE_MOBILE_IDENTITY } from './config/erioneVisualIdentity';

const erione = ERIONE_MOBILE_IDENTITY.colors;

export const customTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: erione.primary,
    secondary: erione.accent,
    tertiary: erione.muted,
    background: erione.background,
    surface: erione.surface,
    secondaryContainer: erione.accentSoft,
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#DC2626',
    info: '#0284C7',
    black: erione.text,
    white: erione.surface,
    primaryAlt: erione.primaryDark,
    primaryContainer: erione.primarySoft,
    tertiaryContainer: '#E2E8F0',
    grey: erione.muted
  }
};
export const useAppTheme = () => useTheme<typeof customTheme>();
