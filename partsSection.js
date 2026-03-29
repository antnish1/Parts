function PartsSection() {
  return `
    <div class="card space-y-4">

      <h2 class="text-lg font-semibold">📦 Add Part</h2>

      <!-- INPUT AREA -->
      <div id="partInputArea" class="space-y-4">

        <div class="grid grid-cols-2 gap-3">
          <input id="partNoInput" class="input" placeholder="Part No"/>
          <input id="qtyInput" type="number" class="input" placeholder="Qty"/>
        </div>

        <div id="partDesc" class="text-gray-400">Description</div>

        <button onclick="addPartToList()" class="btn-primary">
          Add Part
        </button>

      </div>

      <!-- LIST -->
      <div>
        <h3 class="text-md font-semibold mt-4">Added Parts</h3>
        <div id="partsList" class="space-y-3 mt-3"></div>
      </div>

    </div>
  `;
}
