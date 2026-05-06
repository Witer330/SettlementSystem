export interface ThemeColors {
  primary: string
  primaryHover: string
  primaryText: string
  bgCanvas: string
  bgSurface: string
  bgElevated: string
  bgMuted: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  border: string
  borderLight: string
  success: string
  warning: string
  danger: string
  info: string
  glassDark: string
  glassLight: string
}

export interface ThemeTypography {
  fontFamily: string
  headingWeight: number
  bodyWeight: number
  displayWeight: number
  letterSpacing: {
    display: string
    heading: string
    body: string
  }
}

export interface ThemeRadius {
  sm: string
  md: string
  lg: string
  xl: string
  pill: string
  circle: string
}

export interface ThemeShadows {
  sm: string
  md: string
  lg: string
}

export interface ThemeConfig {
  id: string
  name: string
  description: string
  colors: ThemeColors
  typography: ThemeTypography
  radius: ThemeRadius
  shadows: ThemeShadows
}
