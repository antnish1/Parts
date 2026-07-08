const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'src', 'index.css');
if (!fs.existsSync(cssPath)) process.exit(0);
let css = fs.readFileSync(cssPath, 'utf8');
if (css.includes('CD_CALM_TYPOGRAPHY_V1')) process.exit(0);

css += `

/* CD_CALM_TYPOGRAPHY_V1 */
[data-cd-theme] {
  letter-spacing: -0.005em;
}

[data-cd-theme] h1,
[data-cd-theme] h2,
[data-cd-theme] h3 {
  font-weight: 650 !important;
  letter-spacing: -0.025em !important;
}

[data-cd-theme] p,
[data-cd-theme] td,
[data-cd-theme] input,
[data-cd-theme] select,
[data-cd-theme] textarea {
  font-weight: 500 !important;
}

[data-cd-theme] p[class*='uppercase'],
[data-cd-theme] th,
[data-cd-theme] span[class*='uppercase'] {
  font-weight: 650 !important;
  letter-spacing: 0.13em !important;
}

[data-cd-theme] .cd-hero {
  padding: 18px !important;
  background:
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,251,255,.94)),
    radial-gradient(circle at 92% 10%, rgba(59, 130, 246, .10), transparent 16rem) !important;
}

[data-cd-theme] .cd-hero::after {
  opacity: .45;
}

[data-cd-theme] .cd-stat-card,
[data-cd-theme] .cd-record-card,
[data-cd-theme] .cd-panel,
[data-cd-theme] .cd-table-wrap,
[data-cd-theme] .cd-slip,
[data-cd-theme] .cd-signature-card {
  box-shadow: 0 14px 34px rgba(15, 23, 42, .055), 0 1px 0 rgba(255,255,255,.80) inset !important;
}

[data-cd-theme] .cd-record-card:hover,
[data-cd-theme] .cd-stat-card:hover {
  box-shadow: 0 18px 42px rgba(15, 23, 42, .085) !important;
}

[data-cd-theme] .cd-amount-badge {
  background: linear-gradient(135deg, #eff6ff, #dbeafe) !important;
  color: #0f172a !important;
  border: 1px solid rgba(59, 130, 246, .24) !important;
  box-shadow: 0 10px 24px rgba(37, 99, 235, .10) !important;
}

[data-cd-theme] .cd-amount-badge p:first-child {
  color: #2563eb !important;
}

[data-cd-theme] .cd-amount-badge p:last-child {
  color: #0f172a !important;
  font-weight: 650 !important;
}

[data-cd-theme] button {
  font-weight: 600 !important;
}

[data-cd-theme] table td,
[data-cd-theme] table th {
  line-height: 1.45 !important;
}

@media (max-width: 640px) {
  [data-cd-theme] .cd-hero {
    padding: 14px !important;
  }

  [data-cd-theme] .cd-stat-card,
  [data-cd-theme] .cd-record-card,
  [data-cd-theme] .cd-panel {
    padding: 14px !important;
  }
}

@media print {
  [data-cd-theme] * {
    font-weight: 500 !important;
  }

  [data-cd-theme] h1,
  [data-cd-theme] h2,
  [data-cd-theme] p[class*='uppercase'] {
    font-weight: 650 !important;
  }
}
`;

fs.writeFileSync(cssPath, css);
