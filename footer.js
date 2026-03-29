function Footer() {
  return `
    <div class="footer-bar flex justify-between items-center">
      <div class="text-yellow-400 font-semibold">
        ₹ <span id="totalValue">0</span>
      </div>

      <button onclick="submitAll()" class="btn-primary w-[150px]">
        Submit
      </button>
    </div>
  `;
}
