import type { ThemeConfig } from './types'
import { stripeTheme } from './stripe'

export type { ThemeConfig, ThemeColors, ThemeTypography, ThemeRadius, ThemeShadows } from './types'

const themes = new Map<string, ThemeConfig>([
  [stripeTheme.id, stripeTheme],
])

export function registerTheme(theme: ThemeConfig): void {
  themes.set(theme.id, theme)
}

export function getTheme(id: string): ThemeConfig | undefined {
  return themes.get(id)
}

export function getAllThemes(): ThemeConfig[] {
  return Array.from(themes.values())
}

export function getDefaultThemeId(): string {
  return 'stripe'
}

export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement
  const { colors, typography, radius, shadows } = theme

  // Colors
  set(root, '--color-primary', colors.primary)
  set(root, '--color-primary-hover', colors.primaryHover)
  set(root, '--color-primary-text', colors.primaryText)
  set(root, '--color-black', colors.textPrimary)
  set(root, '--color-white', colors.bgSurface)
  set(root, '--bg-canvas', colors.bgCanvas)
  set(root, '--bg-surface', colors.bgSurface)
  set(root, '--bg-elevated', colors.bgElevated)
  set(root, '--bg-muted', colors.bgMuted)
  set(root, '--color-text-primary', colors.textPrimary)
  set(root, '--color-text-secondary', colors.textSecondary)
  set(root, '--color-text-muted', colors.textMuted)
  set(root, '--border-color', colors.border)
  set(root, '--border-color-light', colors.borderLight)
  set(root, '--color-success', colors.success)
  set(root, '--color-warning', colors.warning)
  set(root, '--color-danger', colors.danger)
  set(root, '--color-info', colors.info)
  set(root, '--glass-dark', colors.glassDark)
  set(root, '--glass-light', colors.glassLight)

  // Typography
  set(root, '--font-sans', typography.fontFamily)
  set(root, '--font-heading-weight', typography.headingWeight)
  set(root, '--font-body-weight', typography.bodyWeight)
  set(root, '--font-display-weight', typography.displayWeight)
  set(root, '--letter-display', typography.letterSpacing.display)
  set(root, '--letter-heading', typography.letterSpacing.heading)
  set(root, '--letter-body', typography.letterSpacing.body)

  // Radius
  set(root, '--radius-sm', radius.sm)
  set(root, '--radius-md', radius.md)
  set(root, '--radius-lg', radius.lg)
  set(root, '--radius-xl', radius.xl)
  set(root, '--radius-pill', radius.pill)
  set(root, '--radius-circle', radius.circle)

  // Shadows
  set(root, '--shadow-sm', shadows.sm)
  set(root, '--shadow-md', shadows.md)
  set(root, '--shadow-lg', shadows.lg)

  // Element Plus overrides
  applyElementPlusOverrides(theme)

  // Persist
  localStorage.setItem('settlement-theme', theme.id)
}

function set(el: HTMLElement, name: string, value: string | number): void {
  el.style.setProperty(name, String(value))
}

function applyElementPlusOverrides(theme: ThemeConfig): void {
  const c = theme.colors
  const r = theme.radius
  const root = document.documentElement

  set(root, '--el-color-primary', c.primary)
  set(root, '--el-color-success', c.success)
  set(root, '--el-color-warning', c.warning)
  set(root, '--el-color-danger', c.danger)
  set(root, '--el-color-error', c.danger)
  set(root, '--el-color-info', c.info)
  set(root, '--el-color-white', c.bgSurface)
  set(root, '--el-color-black', c.textPrimary)
  set(root, '--el-bg-color', c.bgSurface)
  set(root, '--el-bg-color-page', c.bgCanvas)
  set(root, '--el-text-color-primary', c.textPrimary)
  set(root, '--el-text-color-regular', c.textPrimary)
  set(root, '--el-text-color-secondary', c.textSecondary)
  set(root, '--el-text-color-placeholder', c.textMuted)
  set(root, '--el-border-color', c.border)
  set(root, '--el-border-color-light', c.borderLight)
  set(root, '--el-button-border-radius', r.pill)
  set(root, '--el-input-border-radius', r.md)
  set(root, '--el-card-border-radius', r.lg)
  set(root, '--el-dialog-border-radius', r.lg)
  set(root, '--el-table-header-bg-color', c.bgMuted)
  set(root, '--el-table-row-hover-bg-color', c.glassDark)
  set(root, '--el-menu-bg-color', c.bgCanvas)
  set(root, '--el-menu-text-color', c.textPrimary)
  set(root, '--el-menu-active-color', c.primary)
  set(root, '--el-fill-color-blank', c.bgSurface)
  set(root, '--el-fill-color', c.bgMuted)
}
