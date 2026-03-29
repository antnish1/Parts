function CustomerForm() {
  return `
    <div class="card space-y-4">

      <div onclick="toggleSection('customerSection')" class="flex justify-between items-center cursor-pointer">
        <h2 class="text-lg font-semibold">👤 Customer Info</h2>
        <span>▼</span>
      </div>

      <div id="customerSection" class="space-y-4">

        <div class="grid grid-cols-2 gap-3">

          <div>
            <div class="label">Machine No</div>
            <input id="machineNo" class="input"/>
          </div>

          <div>
            <div class="label">Contact</div>
            <input id="contactNo" class="input"/>
          </div>

        </div>

        <div>
          <div class="label">Customer Name</div>
          <div id="customerName" class="input flex items-center">--</div>
        </div>

      </div>
    </div>
  `;
}
