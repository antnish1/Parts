function loadCreateOrder() {
  const user = getUser();

  document.getElementById("app").innerHTML = `
    ${Header(user)}

    <div class="p-4 space-y-4 pb-24">
      ${OrderForm()}
      ${CustomerForm()}
      ${PartsSection()}
    </div>

    ${Footer()}
  `;

  addRow(); // keep this
}


----------------------------------------------------------------------------------------------------------------

  

function addRow() {
  const container = document.getElementById("partsContainer");

  const wrapper = document.createElement("div");
  wrapper.innerHTML = PartCard();

  const card = wrapper.firstElementChild;
  container.appendChild(card);

  // 👉 IMPORTANT: REATTACH YOUR EXISTING LOGIC HERE

  let currentRequest = 0;

  const partInput = card.querySelector(".partNo");
  const qtyInput = card.querySelector(".qty");
  const descEl = card.querySelector(".desc");
  const dnpEl = card.querySelector(".dnp");
  const valueEl = card.querySelector(".value");

  partInput.addEventListener("input", debounce(async function () {

    const partNo = this.value.trim();
    if (!partNo) return;

    currentRequest++;
    const requestId = currentRequest;

    descEl.innerText = "Loading...";

    try {
      const res = await fetch(`${API}?partNo=${encodeURIComponent(partNo)}`);
      const data = await res.json();

      if (requestId !== currentRequest) return;

      descEl.innerText = data.description || "Not Found";
      dnpEl.innerText = data.dnp || "-";

      const qty = Number(qtyInput.value) || 0;
      const dnp = Number(data.dnp) || 0;

      const value = qty * dnp;
      valueEl.innerText = value ? "₹ " + value.toLocaleString() : "₹ 0";

      updateTotal();

    } catch (err) {
      descEl.innerText = "Error";
    }

  }, 400));

  qtyInput.addEventListener("input", function () {
    const dnp = Number(dnpEl.innerText) || 0;
    const qty = Number(this.value) || 0;

    const value = qty * dnp;
    valueEl.innerText = value ? "₹ " + value.toLocaleString() : "₹ 0";

    updateTotal();
  });



  --------------------------------------------------------------------------------------------------------------



    
}
