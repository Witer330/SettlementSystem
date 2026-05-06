/**
 * Static Element Plus structural overrides.
 * Color overrides are handled by applyTheme() in themes/index.ts.
 */
export function setupElementPlusTheme(): void {
  const style = document.createElement('style')
  style.id = 'ep-structural-overrides'
  style.textContent = `
    .el-button:focus-visible {
      outline: dashed 2px var(--color-primary) !important;
      outline-offset: 2px !important;
    }

    .el-input__wrapper {
      box-shadow: none !important;
    }
    .el-input__wrapper:hover {
      box-shadow: none !important;
    }
    .el-input__wrapper.is-focus {
      box-shadow: none !important;
    }
    .el-input__wrapper.is-focus::after {
      content: '';
      position: absolute;
      inset: -2px;
      border: dashed 2px var(--color-primary);
      border-radius: var(--radius-md);
      pointer-events: none;
    }

    .el-table th.el-table__cell {
      background-color: var(--bg-muted) !important;
    }
    .el-table tr:hover > td.el-table__cell {
      background-color: var(--glass-dark) !important;
    }

    .el-menu {
      border-right: none !important;
    }
    .el-menu-item.is-active {
      background-color: var(--glass-dark) !important;
    }
    .el-menu-item:hover {
      background-color: var(--glass-dark) !important;
    }

    .el-pagination button {
      border-radius: var(--radius-pill) !important;
    }
    .el-pagination li.is-active {
      background-color: var(--color-primary) !important;
      color: var(--color-primary-text) !important;
      border-radius: var(--radius-pill) !important;
    }

    .el-dropdown-menu {
      border-radius: var(--radius-lg) !important;
      border: 1px solid var(--border-color) !important;
      box-shadow: var(--shadow-md) !important;
    }

    .el-tag {
      border-radius: var(--radius-pill) !important;
    }

    .el-badge__content {
      border-radius: 50% !important;
    }
  `
  document.head.appendChild(style)
}

export default setupElementPlusTheme
