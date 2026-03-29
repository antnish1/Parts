function CustomerForm() {
  return `
    <div class="card space-y-4">
      <h2 class="text-lg font-semibold">👤 Customer Info</h2>

      <div>
        <div class="label">Machine No</div>
        <input id="machineNo" class="input"/>
      </div>

      <div>
        <div class="label">Customer Name</div>
        <div id="customerName" class="input flex items-center">--</div>
      </div>

      <div>
        <div class="label">Contact</div>
        <input id="contactNo" class="input"/>
      </div>
    </div>
  `;
}
