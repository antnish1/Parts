const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'src', 'index.css');
if (!fs.existsSync(cssPath)) process.exit(0);

let css = fs.readFileSync(cssPath, 'utf8');
if (css.includes('CD_WORKFLOW_POLISH_V1')) process.exit(0);

css += `

/* CD_WORKFLOW_POLISH_V1 */
[data-cd-theme] {
  --cd-ink: #0f172a;
  --cd-muted: #64748b;
  --cd-line: rgba(148, 163, 184, 0.26);
  --cd-blue: #1d4ed8;
  --cd-blue-soft: #eff6ff;
  --cd-green: #047857;
  --cd-amber: #b45309;
  --cd-red: #be123c;
  color: var(--cd-ink);
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
}

[data-cd-theme].cd-shell {
  position: relative;
}

[data-cd-theme].cd-shell::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  background:
    radial-gradient(circle at top left, rgba(29, 78, 216, 0.14), transparent 34rem),
    radial-gradient(circle at 80% 0%, rgba(14, 165, 233, 0.10), transparent 28rem),
    linear-gradient(180deg, #f8fbff 0%, #f4f7fb 48%, #eef3f8 100%);
}

[data-cd-theme] .cd-hero,
[data-cd-theme] .cd-panel,
[data-cd-theme] .cd-record-card,
[data-cd-theme] .cd-stat-card,
[data-cd-theme] .cd-table-wrap,
[data-cd-theme] .cd-slip,
[data-cd-theme] .cd-signature-card {
  border-color: rgba(148, 163, 184, 0.28) !important;
  background: rgba(255, 255, 255, 0.92) !important;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.07), 0 1px 0 rgba(255, 255, 255, 0.85) inset !important;
  backdrop-filter: blur(14px);
}

[data-cd-theme] .cd-hero {
  position: relative;
  overflow: hidden;
  border-radius: 28px !important;
  padding: 20px !important;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.90)),
    radial-gradient(circle at 92% 12%, rgba(29, 78, 216, 0.12), transparent 18rem) !important;
}

[data-cd-theme] .cd-hero::after {
  content: '';
  position: absolute;
  right: -56px;
  top: -72px;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.18), transparent 68%);
}

[data-cd-theme] .cd-hero > * {
  position: relative;
  z-index: 1;
}

[data-cd-theme] h1 {
  letter-spacing: -0.035em;
}

[data-cd-theme] p[class*='uppercase'] {
  letter-spacing: 0.18em !important;
}

[data-cd-theme] .cd-stat-card {
  border-radius: 24px !important;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

[data-cd-theme] .cd-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.10) !important;
}

[data-cd-theme] .cd-stat-card svg,
[data-cd-theme] .cd-hero svg {
  stroke-width: 2.4;
}

[data-cd-theme] .cd-record-card {
  border-radius: 28px !important;
  padding: 18px !important;
}

[data-cd-theme] .cd-record-card:hover {
  border-color: rgba(29, 78, 216, 0.28) !important;
  box-shadow: 0 26px 60px rgba(15, 23, 42, 0.12) !important;
}

[data-cd-theme] .cd-table-wrap {
  border-radius: 24px !important;
}

[data-cd-theme] .cd-table-wrap thead {
  background: linear-gradient(180deg, #f8fafc, #eef4ff) !important;
}

[data-cd-theme] .cd-table-wrap th {
  color: #475569 !important;
  font-weight: 900 !important;
}

[data-cd-theme] .cd-table-wrap td {
  padding-top: 14px !important;
  padding-bottom: 14px !important;
  color: #334155;
}

[data-cd-theme] input,
[data-cd-theme] select,
[data-cd-theme] textarea {
  border-radius: 16px !important;
  border-color: rgba(148, 163, 184, 0.36) !important;
  background: rgba(255, 255, 255, 0.96) !important;
  box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset;
}

[data-cd-theme] input:focus,
[data-cd-theme] select:focus,
[data-cd-theme] textarea:focus {
  border-color: rgba(37, 99, 235, 0.60) !important;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12) !important;
}

[data-cd-theme] button:not([disabled]) {
  transition: transform 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}

[data-cd-theme] button:not([disabled]):active {
  transform: translateY(1px) scale(0.99);
}

[data-cd-theme] span[class*='rounded-full'][class*='border'] {
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.75) inset;
}

[data-cd-theme='request'] .cd-panel {
  border-radius: 28px !important;
  padding: 20px !important;
}

[data-cd-theme='request'] .cd-amount-badge {
  background: linear-gradient(135deg, #0f172a, #1d4ed8) !important;
  box-shadow: 0 18px 36px rgba(30, 64, 175, 0.22);
}

[data-cd-theme='request'] .cd-signature-card canvas {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.92)),
    repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(148, 163, 184, 0.20) 32px) !important;
}

[data-cd-theme='detail'] .cd-slip {
  background: linear-gradient(180deg, #ffffff, #fbfdff) !important;
}

[data-cd-theme='detail'] .cd-slip > div:first-child {
  border-color: rgba(37, 99, 235, 0.16) !important;
}

@media (max-width: 640px) {
  [data-cd-theme] .cd-hero {
    padding: 16px !important;
    border-radius: 24px !important;
  }

  [data-cd-theme] h1 {
    font-size: 1.25rem !important;
    line-height: 1.65rem !important;
  }

  [data-cd-theme] .cd-stat-card,
  [data-cd-theme] .cd-record-card,
  [data-cd-theme] .cd-panel {
    border-radius: 22px !important;
  }
}

@media print {
  [data-cd-theme].cd-shell::before {
    display: none !important;
  }

  [data-cd-theme] .cd-slip,
  [data-cd-theme] .cd-slip * {
    box-shadow: none !important;
    backdrop-filter: none !important;
  }
}
`;

fs.writeFileSync(cssPath, css);
