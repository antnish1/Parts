function PartCard() {
  return `
    <div class="bg-black p-3 rounded-xl space-y-2 border border-gray-700">

      <input class="partNo input" placeholder="Part No"/>

      <div class="flex gap-2">
        <input type="number" class="qty input" placeholder="Qty"/>
      </div>

      <div class="text-sm text-gray-400 desc">Description</div>

      <div class="flex justify-between text-sm">
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
