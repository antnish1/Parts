function OrderForm() {
  return `
    <div class="card space-y-4">
      <h2 class="text-lg font-semibold">🧾 Order Details</h2>

      <div>
        <div class="label">Order Type</div>
        <select id="orderType" class="input">
          <option value="">Select</option>
          <option>SOP</option>
          <option>VOR</option>
        </select>
      </div>

      <div>
        <div class="label">Order For</div>
        <select id="orderFor" class="input">
          <option>Customer</option>
          <option>Stock</option>
        </select>
      </div>

      <div>
        <div class="label">Employee</div>
        <input id="employeeName" class="input"/>
      </div>

      <div>
        <div class="label">Approved By</div>
        <input id="approvedBy" class="input"/>
      </div>
    </div>
  `;
}
