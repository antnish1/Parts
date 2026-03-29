function PartCard() {
  return `
    <div class="bg-black p-4 rounded-2xl space-y-3 border border-gray-700">

      <input class="partNo input" placeholder="Part No"/>

      <input type="number" class="qty input" placeholder="Quantity"/>

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
