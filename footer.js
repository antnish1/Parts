function Footer() {
  return `
    <div class="footer-bar">

      <div class="text-center text-xl font-bold text-yellow-400 mb-2">
        Total: ₹ <span id="totalValue">0</span>
      </div>

      <button onclick="submitAll()" class="btn-primary">
        Submit Order
      </button>

    </div>
  `;
}
