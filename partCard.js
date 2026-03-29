function PartCard() {
  return `
    <div class="bg-black p-4 rounded-2xl space-y-4 border border-gray-700">

      <div class="grid grid-cols-2 gap-3">
        <input class="partNo input" placeholder="Part No"/>
        <input type="number" class="qty input" placeholder="Qty"/>
      </div>

      <div class="text-base text-gray-300 desc">Description</div>

      <div class="flex justify-between text-base">
        <span class="text-yellow-400 dnp">₹0</span>
        <span class="text-green-400 value">₹0</span>
      </div>

      <button onclick="this.closest('div').remove(); updateTotal();" 
        class="text-red-400 text-sm">
        Remove
      </button>
    </div>
  `;
}
