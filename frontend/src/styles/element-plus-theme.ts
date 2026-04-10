/* ============================================================
   Element Plus Theme Configuration
   Based on Figma Design System
   ============================================================ */

export const setupElementPlusTheme = () => {
  // Element Plus will use CSS variables from design-system.css
  // This file can be extended for dynamic theme switching if needed

  // Override Element Plus default colors with our design system
  const style = document.createElement('style')
  style.textContent = `
    :root {
      /* Element Plus Color Variables */
      --el-color-primary: #000000;
      --el-color-success: #00c853;
      --el-color-warning: #ffd600;
      --el-color-danger: #ff1744;
      --el-color-error: #ff1744;
      --el-color-info: #2979ff;

      --el-color-white: #ffffff;
      --el-color-black: #000000;
      --el-bg-color: #ffffff;
      --el-bg-color-page: #f5f5f5;

      --el-text-color-primary: #000000;
      --el-text-color-regular: #000000;
      --el-text-color-secondary: #666666;
      --el-text-color-placeholder: #999999;

      /* Border */
      --el-border-color: #e5e7eb;
      --el-border-color-light: #eef0f5;
      --el-border-color-lighter: #f2f3f5;
      --el-border-color-extra-light: #f5f6f7;
      --el-border-color-dark: #dcdfe6;
      --el-border-color-darker: #c4c7cd;

      /* Fill */
      --el-fill-color-blank: #ffffff;
      --el-fill-color: #f0f2f5;
      --el-fill-color-light: #f5f7fa;
      --el-fill-color-lighter: #fafbfc;
      --el-fill-color-extra-light: #ffffff;
      --el-fill-color-dark: #ebedf0;
      --el-fill-color-darker: #e5e7eb;

      /* Button */
      --el-button-size: 32px;
      --el-button-border-radius: 50px;

      /* Input */
      --el-input-border-radius: 6px;
      --el-input-height: 40px;

      /* Card */
      --el-card-border-radius: 8px;

      /* Table */
      --el-table-header-bg-color: rgba(0, 0, 0, 0.04);
      --el-table-row-hover-bg-color: rgba(0, 0, 0, 0.03);

      /* Menu */
      --el-menu-bg-color: #f5f5f5;
      --el-menu-text-color: #000000;
      --el-menu-active-color: #000000;

      /* Dialog */
      --el-dialog-border-radius: 8px;
    }

    /* Button Styles Override */
    .el-button--primary {
      background-color: #000000 !important;
      border-color: #000000 !important;
      color: #ffffff !important;
      border-radius: 50px !important;
    }

    .el-button--default {
      background-color: #ffffff !important;
      border-color: #000000 !important;
      color: #000000 !important;
      border-radius: 50px !important;
      border-width: 1px !important;
    }

    .el-button:focus-visible {
      outline: dashed 2px #000000 !important;
      outline-offset: 2px !important;
    }

    /* Input Styles Override */
    .el-input__wrapper {
      border-radius: 6px !important;
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
      border: dashed 2px #000000;
      border-radius: 6px;
      pointer-events: none;
    }

    /* Table Styles Override */
    .el-table {
      font-family: 'Inter', -apple-system, sans-serif !important;
      font-size: 16px !important;
      font-weight: 330 !important;
      letter-spacing: -0.14px !important;
    }

    .el-table th.el-table__cell {
      font-weight: 450 !important;
      background-color: rgba(0, 0, 0, 0.04) !important;
    }

    .el-table tr:hover > td.el-table__cell {
      background-color: rgba(0, 0, 0, 0.03) !important;
    }

    /* Menu Styles Override */
    .el-menu {
      border-right: none !important;
      background-color: #f5f5f5 !important;
    }

    .el-menu-item {
      font-weight: 330 !important;
      letter-spacing: -0.14px !important;
    }

    .el-menu-item.is-active {
      background-color: rgba(0, 0, 0, 0.06) !important;
      font-weight: 480 !important;
    }

    .el-menu-item:hover {
      background-color: rgba(0, 0, 0, 0.04) !important;
    }

    /* Card Styles Override */
    .el-card {
      border-radius: 8px !important;
      border: none !important;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
    }

    /* Dialog Styles Override */
    .el-dialog {
      border-radius: 8px !important;
    }

    .el-dialog__header {
      font-weight: 450 !important;
      letter-spacing: -0.14px !important;
    }

    /* Form Label Styles */
    .el-form-item__label {
      font-weight: 450 !important;
      letter-spacing: -0.14px !important;
    }

    /* Badge Styles */
    .el-badge__content {
      border-radius: 50% !important;
    }

    /* Tag Styles */
    .el-tag {
      border-radius: 50px !important;
      font-weight: 330 !important;
      letter-spacing: -0.14px !important;
    }

    /* Dropdown Styles */
    .el-dropdown-menu {
      border-radius: 8px !important;
      border: 1px solid #e5e7eb !important;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
    }

    .el-dropdown-menu__item {
      font-weight: 330 !important;
      letter-spacing: -0.14px !important;
    }

    /* Tooltip Styles */
    .el-tooltip__popper {
      border-radius: 6px !important;
    }

    /* Pagination Styles */
    .el-pagination button {
      border-radius: 50px !important;
    }

    .el-pagination li.is-active {
      background-color: #000000 !important;
      color: #ffffff !important;
      border-radius: 50px !important;
    }
  `
  document.head.appendChild(style)
}

export default setupElementPlusTheme
