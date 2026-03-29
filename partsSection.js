function PartsSection() {
  return `
    <div class="card space-y-4">
      <h2 class="text-lg font-semibold">📦 Parts</h2>

      <div id="partsContainer" class="space-y-3"></div>

      <button onclick="addRow()" class="btn-primary">
        + Add Part
      </button>
    </div>
  `;
}
