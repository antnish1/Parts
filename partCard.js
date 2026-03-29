function PartCard(data) {
  return `
    <div class="bg-black p-4 rounded-2xl border border-gray-700">

      <div class="flex justify-between">
        <div>
          <div class="font-semibold">${data.partNo}</div>
          <div class="text-sm text-gray-400">${data.description}</div>
        </div>

        <div class="text-right">
          <div>Qty: ${data.qty}</div>
          <div class="text-green-400">₹ ${data.value}</div>
        </div>
      </div>

      <button onclick="this.parentElement.remove(); updateTotal();" 
        class="text-red-400 mt-2">
        Remove
      </button>

    </div>
  `;
}
