// ================= API =================
const API = "https://script.google.com/macros/s/AKfycbzWsFW_YBfbOwCIg7_fRVP347kbpoOY_e7wRop8OXzVizFG6HXLVtgLrT8KOCbeZIoe/exec";

let isSubmitting = false;
let isLoggingIn = false;

// ================= UTIL =================
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function showLoader() {
  document.getElementById("loader")?.classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loader")?.classList.add("hidden");
}

function showPopup(msg) {
  const popup = document.getElementById("popup");
  const msgEl = document.getElementById("popupMsg");

  if (!popup || !msgEl) return;

  msgEl.innerText = msg;
  popup.classList.remove("hidden");
}

function closePopup() {
  document.getElementById("popup")?.classList.add("hidden");
}

// ================= INIT =================
window.onload = () => {
  const user = getUser();

  if (user && user.branch && user.role) {
    user.role === "admin" ? loadAdmin() : loadBranch();
  } else {
    localStorage.clear();
    loadLogin();
  }
};

// ================= LOGIN =================
function loadLogin() {
  document.getElementById("app").innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-black">
      <div class="card w-full max-w-sm space-y-4">
        <h1 class="text-yellow-400 text-xl font-bold text-center">Login</h1>

        <select id="branch" class="input">
          <option value="">Select Branch</option>
          <option>HQ</option>
          <option>JABALPUR</option>
        </select>

        <input id="password" type="password" placeholder="Password" class="input"/>

        <button onclick="login()" class="btn-primary">Login</button>
      </div>
    </div>
  `;
}

async function login() {
  const branch = document.getElementById("branch").value;
  const password = document.getElementById("password").value;

  if (!branch || !password) {
    showPopup("Enter details");
    return;
  }

  showLoader();

  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "login", branch, password })
  });

  const data = await res.json();

  hideLoader();

  if (data.status === "success") {
    localStorage.setItem("user", JSON.stringify(data));
    data.role === "admin" ? loadAdmin() : loadBranch();
  } else {
    showPopup("Invalid login");
  }
}

// ================= NAV =================
function logout() {
  localStorage.removeItem("user");
  loadLogin();
}

function loadBranch() {
  document.getElementById("app").innerHTML = `<div id="mainContent"></div>`;
  loadCreateOrder();
}

// ================= CREATE ORDER =================
function loadCreateOrder() {
  const user = getUser();

  document.getElementById("app").innerHTML = `
    ${Header(user)}

    <div class="p-5 space-y-5 pb-24">
      ${OrderForm()}
      ${CustomerForm()}
      ${PartsSection()}
    </div>

    ${Footer()}
  `;

  addRow();

  // MACHINE FETCH
  document.getElementById("machineNo")?.addEventListener("blur", async function () {
    const machineNo = this.value.trim();
    if (!machineNo) return;

    const customerEl = document.getElementById("customerName");
    customerEl.innerText = "Loading...";

    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "getMachine", machineNo })
    });

    const data = await res.json();
    customerEl.innerText = data.customer || "--";
  });
}

// ================= ADD PART =================
function addRow() {
  const container = document.getElementById("partsContainer");

  const wrapper = document.createElement("div");
  wrapper.innerHTML = PartCard();

  const card = wrapper.firstElementChild;
  container.appendChild(card);

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

    const res = await fetch(`${API}?partNo=${encodeURIComponent(partNo)}`);
    const data = await res.json();

    if (requestId !== currentRequest) return;

    descEl.innerText = data.description || "Not Found";
    dnpEl.innerText = data.dnp || "0";

    calculateCard(card);
  }, 400));

  qtyInput.addEventListener("input", () => calculateCard(card));
}

function calculateCard(card) {
  const qty = Number(card.querySelector(".qty").value) || 0;
  const dnp = Number(card.querySelector(".dnp").innerText) || 0;

  const value = qty * dnp;

  card.querySelector(".value").innerText = "₹ " + value.toLocaleString();

  updateTotal();
}

// ================= TOTAL =================
function updateTotal() {
  let total = 0;

  document.querySelectorAll(".value").forEach(el => {
    const v = Number(el.innerText.replace(/[^\d]/g, "")) || 0;
    total += v;
  });

  document.getElementById("totalValue").innerText = total.toLocaleString();
}

// ================= SUBMIT =================
async function submitAll() {
  const user = getUser();

  const items = [];

  document.querySelectorAll("#partsContainer > div").forEach(card => {
    const partNo = card.querySelector(".partNo").value.trim();
    const qty = card.querySelector(".qty").value;
    const desc = card.querySelector(".desc").innerText;

    if (!partNo || !qty) return;

    items.push({ partNo, qty, description: desc });
  });

  if (!items.length) {
    showPopup("Add parts first");
    return;
  }

  showLoader();

  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "submitBulk",
      branch: user.branch,
      items
    })
  });

  hideLoader();
  showPopup("Order submitted ✅");

  document.getElementById("partsContainer").innerHTML = "";
  addRow();
}

// ================= ADMIN =================
function loadAdmin() {
  document.getElementById("app").innerHTML = `<div class="p-4">Admin Panel</div>`;
}
