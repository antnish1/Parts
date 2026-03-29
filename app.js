<script>


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
    
}

 --------------------------------------------------------------------------------------------------------------




const API = "https://script.google.com/macros/s/AKfycbzWsFW_YBfbOwCIg7_fRVP347kbpoOY_e7wRop8OXzVizFG6HXLVtgLrT8KOCbeZIoe/exec";

let isSubmitting = false;
let isLoggingIn = false;

// ---------- SAFE STORAGE ----------

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
  } catch (e) {
    localStorage.removeItem("user");
    return null;
  }
}

// ---------- UTIL ----------
function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}

function showPopup(msg) {
  const popup = document.getElementById("popup");
  const msgEl = document.getElementById("popupMsg");

  msgEl.innerText = msg;
  popup.classList.remove("hidden");

  // small animation
  popup.style.opacity = "0";
  setTimeout(() => {
    popup.style.opacity = "1";
  }, 50);
}

function closePopup() {
  document.getElementById("popup").classList.add("hidden");
}

// ---------- INIT ----------
window.onload = () => {
  try {
    const user = getUser();

    if (user && user.branch && user.role) {
      user.role === "admin" ? loadAdmin() : loadBranch();
    } else {
      localStorage.clear(); // 🔥 important
      loadLogin();
    }

  } catch (e) {
    localStorage.clear();
    loadLogin();
  }
};

// ---------- LOGIN ----------
function loadLogin() {
  document.getElementById("app").innerHTML = `

  <div class="min-h-screen flex flex-col justify-between bg-gradient-to-br from-black via-gray-900 to-black">

    <!-- CENTER -->
    <div class="flex flex-col items-center justify-center flex-grow px-4">

      <!-- HEADING -->
      <h1 class="text-3xl font-bold text-yellow-400 mb-2 text-center tracking-wide">
        FCV Parts Connect Portal
      </h1>



      <!-- GLASS CARD -->
      <div class="w-full max-w-md backdrop-blur-lg bg-white/5 border border-gray-700 rounded-2xl p-6 shadow-2xl transition-all duration-500 hover:scale-[1.01]">

        <p class="text-gray-300 text-sm mb-5 text-center">
          Welcome Back
        </p>

        <!-- Branch -->
        
        <select id="branch"
          class="w-full bg-black/70 border border-gray-600 text-white p-2 rounded mb-4 focus:ring-2 focus:ring-yellow-400 transition">
          <option value="">Select Branch</option>
          <option>DAMOH</option>
          <option>ANUPPUR</option>
          <option>DINDORI</option>
          <option>MANDLA</option>
          <option>NARSINGHPUR</option>
          <option>BALAGHAT</option>
          <option>SEONI</option>
          <option>KATNI</option>
          <option>JABALPUR</option>
          <option>HQ</option>
        </select>

        <!-- Password -->
        
        <input id="password" type="password" placeholder="Password"
          class="w-full bg-black/70 border border-gray-600 text-white p-2 rounded mb-6 focus:ring-2 focus:ring-yellow-400 transition"/>

        <!-- BUTTON -->
        <button id="loginBtn" onclick="login()"
          class="w-full flex items-center justify-center gap-2 bg-yellow-400 text-black py-2 rounded font-semibold hover:bg-yellow-500 transition relative">

          <span id="loginText">Login</span>

          <!-- Spinner -->
          <span id="loginSpinner" class="hidden w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>

        </button>

      </div>

    </div>

    <!-- FOOTER -->
    <div class="text-center text-xs text-gray-500 py-4">
      © 2026 All rights reserved | For Internal Use Only
    </div>

  </div>
  `;
}

  
async function login() {

  if (isLoggingIn) return;
  isLoggingIn = true;

  const branchEl = document.getElementById("branch");
  const passwordEl = document.getElementById("password");

  // 🔥 NEW: Button elements
  const btn = document.getElementById("loginBtn");
  const text = document.getElementById("loginText");
  const spinner = document.getElementById("loginSpinner");

  if (!branchEl || !passwordEl) {
    showPopup("UI error: reload page");
    isLoggingIn = false;
    return;
  }

  const branch = branchEl.value;
  const password = passwordEl.value;

  if (!branch || !password) {
    showPopup("Please select branch and enter password");
    isLoggingIn = false;
    return;
  }

  // 🔥 START BUTTON LOADING
  if (btn && text && spinner) {
    btn.disabled = true;
    text.innerText = "Signing in...";
    spinner.classList.remove("hidden");
  }

  showLoader(); // (optional: you can remove later if button loader feels enough)

  try {
    const payload = {
      action: "login",
      branch: branch,
      password: password
    };

              const res = await fetch(API, {
                method: "POST",
                headers: {
                  "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
              });

    const data = await res.json();
    console.log("LOGIN RESPONSE:", data);

    if (data.status === "success") {
      localStorage.setItem("user", JSON.stringify(data));

      if (data.role === "admin") {
        loadAdmin();
      } else {
        loadBranch();
      }

    } else {
      showPopup("Invalid credentials!");
    }

  } catch (err) {
    console.error(err);
    showPopup("Network error!");
  }

  // 🔥 STOP BUTTON LOADING (ALWAYS RUNS)
  if (btn && text && spinner) {
    btn.disabled = false;
    text.innerText = "Login";
    spinner.classList.add("hidden");
  }

  hideLoader();
  isLoggingIn = false;
}


  
function logout() {
  if (isSubmitting) {
    showPopup("Please wait, submitting...");
    return;
  }

  localStorage.removeItem("user");
  document.getElementById("app").innerHTML = "";

  setTimeout(loadLogin, 100);
}

function loadBranch() {
  const user = getUser();

  if (!user || !user.branch) {
    showPopup("Session error, please login again");
    logout();
    return;
  }

  // ✅ No sidebar anymore
  document.getElementById("app").innerHTML = `
    <div id="mainContent" class="p-6"></div>
  `;

  // Load default page
  loadCreateOrder();
}




function showCustomerInputPopup() {
  const popup = document.getElementById("popup");
  const msgEl = document.getElementById("popupMsg");

  msgEl.innerHTML = `
    <div class="text-center space-y-3">
      <p class="text-white text-sm">Customer not found ❗</p>
      
      <input id="manualCustomer"
        placeholder="Enter Customer Name"
        class="w-full bg-black border border-gray-600 text-white px-3 py-2 rounded"/>

      <!-- 🔥 BUTTON ROW -->
      <div class="flex gap-3 justify-center">
        
        <button onclick="saveManualCustomer()"
          class="bg-yellow-400 text-black px-4 py-2 rounded font-semibold hover:bg-yellow-500 w-1/2">
          Save
        </button>

        <button onclick="cancelCustomerInput()"
          class="bg-gray-700 text-white px-4 py-2 rounded font-semibold hover:bg-gray-600 w-1/2">
          Cancel
        </button>

      </div>
    </div>
  `;

  popup.classList.remove("hidden");

  // ✅ Auto focus + Enter support
  setTimeout(() => {
    const input = document.getElementById("manualCustomer");

    if (input) {
      input.focus();

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          saveManualCustomer();
        }
      });
    }
  }, 100);
}

function cancelCustomerInput() {
  closePopup();

  // Optional: reset UI
  document.getElementById("customerName").innerText = "--";
}
  



function saveManualCustomer() {
  const input = document.getElementById("manualCustomer");
  const customerName = input.value.trim();

  if (!customerName) {
    alert("Please enter customer name");
    return;
  }

  document.getElementById("customerName").innerText = customerName;

  closePopup();
}
  

  

// ---------- SUBMIT ----------
async function submitAll() {

  if (isSubmitting) return;
  isSubmitting = true;

  showLoader();

  const user = getUser();

  const orderType = document.getElementById("orderType").value;
  const orderFor = document.getElementById("orderFor").value;
  const machineNo = document.getElementById("machineNo").value;
  const customerName = document.getElementById("customerName").innerText;
  const contactNo = document.getElementById("contactNo").value;

  const warrantyStatus = document.getElementById("warrantyStatus").value;
  const employeeName = document.getElementById("employeeName").value;
  const approvedBy = document.getElementById("approvedBy").value;
  const callId = document.getElementById("callId").value;

  if (!orderType || !orderFor || !employeeName) {
    showPopup("Please fill mandatory fields ❗");
    hideLoader();
    isSubmitting = false;
    return;
  }

  const rows = document.querySelectorAll("#tableBody tr");

  const items = [];

  for (let r of rows) {
    const partNo = r.querySelector(".partNo").value.trim();
    const qty = r.querySelector(".qty").value;
    const desc = r.querySelector(".desc").innerText.trim();

    if (!partNo || !qty) continue;

    if (!desc || desc === "Not Found" || desc === "Checking...") {
      showPopup("Invalid or loading Part Number ❗");
      hideLoader();
      isSubmitting = false;
      return;
    }

    items.push({
      partNo,
      qty,
      description: desc
    });
  }

  if (items.length === 0) {
    showPopup("Enter at least one valid part");
    hideLoader();
    isSubmitting = false;
    return;
  }

  const payload = {
    action: "submitBulk",   // 🔥 NEW ACTION
    branch: user.branch,
    orderType,
    orderFor,
    warrantyStatus,
    employeeName,
    approvedBy,
    callId,
    machineNo,
    customerName,
    contactNo,
    items: items
  };

  console.log("BULK PAYLOAD:", payload);

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.status === "success") {
      showPopup(`Submitted successfully ✅\nTemp Order No: ${result.tempOrderNo}`);

      document.getElementById("tableBody").innerHTML = "";
      addRow();
    } else {
      showPopup("Submit failed ❗");
    }

  } catch (err) {
    console.error(err);
    showPopup("Submission failed ❗");
  }

  hideLoader();
  isSubmitting = false;
}


  
function loadAdmin() {

  document.getElementById("app").innerHTML = `
    <div class="max-w-7xl mx-auto space-y-4">

      <!-- TOP BAR -->
      <div class="flex justify-between items-center bg-gray-900 px-5 py-3 rounded-xl border border-gray-700">

        <p class="text-yellow-400 font-semibold text-lg">
          HQ Dashboard
        </p>

        <button onclick="logout()"
          class="bg-yellow-400 text-black px-4 py-2 rounded">
          Logout
        </button>

      </div>

      <!-- FILTER TABS -->
      <div class="flex gap-3">
        <button onclick="loadHQOrders('Pending')" 
          class="px-4 py-2 bg-yellow-400 text-black rounded">
          Pending
        </button>

        <button onclick="loadHQOrders('Processed')" 
          class="px-4 py-2 bg-gray-800 text-gray-300 rounded">
          Processed
        </button>

        <button onclick="loadHQOrders('All')" 
          class="px-4 py-2 bg-gray-800 text-gray-300 rounded">
          All
        </button>
      </div>

      <!-- ORDERS -->
      <div id="hqOrders"></div>

    </div>
  `;

  loadHQOrders("Pending"); // default
}





async function loadTrackOrders() {

  showLoader();

  const user = getUser();

  try {
            const res = await fetch(API, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain;charset=utf-8"
              },
              body: JSON.stringify({ action: "getRequests" })
            });

    const data = await res.json();

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    // ✅ READ FILTER VALUES SAFELY (before rendering)
    const fromDateVal = document.getElementById("fromDate")?.value || "";
    const toDateVal = document.getElementById("toDate")?.value || "";
    const searchPartVal = (document.getElementById("searchPart")?.value || "").toLowerCase();

    console.log("DATA SAMPLE:", data[0]);
    
    // ✅ FILTER DATA FIRST (IMPORTANT FIX)
    const filteredData = data.filter(d => {

      if (d.branch !== user.branch) return false;

      // Convert "3/26/2026 18:33:05"
        // Convert to YYYY-MM-DD string
      // ✅ SAFE DATE PARSING
      if (!d.date) return false;
              
        // ✅ USE ISO DATE DIRECTLY
       // ✅ Convert UTC → Local date (IST)
        const localDate = new Date(d.date);
        
        // format YYYY-MM-DD in LOCAL time
        const rowDateStr = `${localDate.getFullYear()}-${(localDate.getMonth()+1).toString().padStart(2,'0')}-${localDate.getDate().toString().padStart(2,'0')}`;

      // Default 7 days
        if (!fromDateVal && !toDateVal) {
        
          const todayStr = new Date().toISOString().split("T")[0];
        
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
        
          if (rowDateStr < sevenDaysAgoStr) return false;
        }

        // From date
        if (fromDateVal && rowDateStr < fromDateVal) return false;
        
        // To date
        if (toDateVal && rowDateStr > toDateVal) return false;

      // Search
        if (searchPartVal) {
          const found = d.items.some(item =>
            (item.partNo || "").toLowerCase().includes(searchPartVal)
          );
        
          if (!found) return false;
        }

      return true;
    });

    // ✅ BUILD UI
    let html = `

    <div class="space-y-4">

      <!-- TOP BAR -->
      <div class="flex justify-between items-center bg-gray-900 px-5 py-3 rounded-xl border border-gray-700">

        <p class="font-semibold text-yellow-400 text-lg">
          ${user.branch}
        </p>

        <div class="flex gap-3">
          <button onclick="loadCreateOrder()"
            class="px-4 py-1.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-yellow-400">
            Create New Order
          </button>

          <button
            class="px-4 py-1.5 rounded-lg bg-gray-800 text-yellow-400 border border-gray-700">
            Track Orders
          </button>
        </div>

        <button onclick="logout()"
          class="px-4 py-2 bg-yellow-400 text-black rounded-lg">
          Logout
        </button>

      </div>

      <!-- FILTERS -->
      <div class="bg-gray-900 p-4 rounded-xl border border-gray-700 flex gap-4 flex-wrap">

        <input id="fromDate" placeholder="From Date"
          class="bg-black border border-gray-600 text-white px-3 py-2 rounded"/>

        <input id="toDate" placeholder="To Date"
          class="bg-black border border-gray-600 text-white px-3 py-2 rounded"/>

        <input type="text" id="searchPart"
          placeholder="Search Part No"
          class="bg-black border border-gray-600 text-white px-3 py-2 rounded"/>

        <button onclick="loadTrackOrders()"
          class="bg-yellow-400 text-black px-4 py-2 rounded">
          Apply
        </button>
        
        <button onclick="clearFilters()"
          class="bg-gray-800 border border-gray-600 text-gray-300 px-4 py-2 rounded hover:bg-gray-700 hover:text-white transition">
          Clear
        </button>

      </div>

      <!-- TABLE -->
    <div class="bg-gray-900 p-5 rounded-xl border border-gray-700 overflow-x-auto">
    
      <table class="min-w-[1400px] text-sm border border-gray-700 bg-gray-800">
          <thead class="bg-black text-yellow-400">
            <tr>
              <th class="p-3 whitespace-nowrap">Date</th>
              <th class="p-3 whitespace-nowrap">Type</th>
              <th class="p-3 whitespace-nowrap">For</th>
              <th class="p-3 whitespace-nowrap">Warranty</th>
              <th class="p-3 whitespace-nowrap">Employee</th>
              <th class="p-3 whitespace-nowrap">Approved By</th>
              <th class="p-3 whitespace-nowrap">Call ID</th>
              <th class="p-3 whitespace-nowrap">Machine</th>
              <th class="p-3 whitespace-nowrap">Customer</th>
              <th class="p-3 whitespace-nowrap">Contact</th>
              <th class="p-3 whitespace-nowrap">Parts</th>
              <th class="p-3 whitespace-nowrap">Total Qty</th>
              <th class="p-3 whitespace-nowrap">Order No</th>
              <th class="p-3 whitespace-nowrap">Value</th>
              <th class="p-3 whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    let index = 0;

filteredData.forEach(d => {
  
  const rowClass = index % 2 === 0 ? "bg-gray-800" : "bg-gray-900";

  // ✅ CALCULATE HERE (OUTSIDE HTML)
  const totalQty = d.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  html += `
    <tr class="${rowClass} border-t border-gray-700 text-gray-200 text-center cursor-pointer"
        onclick="toggleItems(${index})">

        <td class="p-3 whitespace-nowrap">${new Date(d.date).toLocaleDateString()}</td>
        <td class="p-3 whitespace-nowrap">${d.orderType}</td>
        <td class="p-3 whitespace-nowrap">${d.orderFor}</td>
        <td class="p-3 whitespace-nowrap">${d.warrantyStatus || "-"}</td>
        <td class="p-3 whitespace-nowrap">${d.employeeName || "-"}</td>
        <td class="p-3 whitespace-nowrap">${d.approvedBy || "-"}</td>
        <td class="p-3 whitespace-nowrap">${d.callId || "-"}</td>
        <td class="p-3 whitespace-nowrap">${d.machineNo || "-"}</td>
        <td class="p-3 whitespace-nowrap">${d.customerName || "-"}</td>
        <td class="p-3 whitespace-nowrap">${d.contactNo || "-"}</td>
        <td class="p-3 whitespace-nowrap">${d.items.length}</td>
        <td class="p-3 whitespace-nowrap">${totalQty}</td>
        <td class="p-3 whitespace-nowrap">${d.orderNo || "-"}</td>
        <td class="p-3 whitespace-nowrap text-green-400 font-semibold">
          ₹ ${Number(d.totalValue || 0).toLocaleString()}
        </td>
        <td class="p-3 whitespace-nowrap">${d.status}</td>
    </tr>

    <tr id="items-${index}" class="hidden bg-black">
      <td colspan="15" class="p-3 text-left">

        <!-- ✅ HEADER ROW (ADDED HERE) -->
        <div class="flex justify-between text-yellow-400 font-semibold border-b border-gray-600 pb-1 mb-2">
          <span class="w-[20%]">Part</span>
          <span class="w-[35%]">Description</span>
          <span class="w-[15%] text-right">Qty</span>
          <span class="w-[25%] text-right">Value</span>
        </div>

        <!-- ✅ ITEMS -->
        ${d.items.map(item => `
          <div class="flex justify-between border-b border-gray-700 py-1 text-sm">
            
            <span class="w-[20%]">${item.partNo}</span>
            
            <span class="w-[35%]">${item.description}</span>
            
            <span class="w-[15%] text-right">Qty: ${item.qty}</span>

            <span class="w-[25%] text-right text-green-400">
              ₹ ${Number(item.value || 0).toLocaleString()}
            </span>

          </div>
        `).join("")}

      </td>
    </tr>
  `;

  index++;
});

    html += `</tbody></table></div></div>`;

    document.getElementById("mainContent").innerHTML = html;

    // ✅ INIT DATE PICKER AFTER RENDER
    flatpickr("#fromDate", {
      dateFormat: "Y-m-d",
      maxDate: "today",
      defaultDate: fromDateVal || null
    });

    flatpickr("#toDate", {
      dateFormat: "Y-m-d",
      maxDate: "today",
      defaultDate: toDateVal || null
    });

  } catch (err) {
    console.error(err);
    showPopup("Error loading orders");
  }

  hideLoader();
}


function clearFilters() {

  // Clear inputs
  const fromEl = document.getElementById("fromDate");
  const toEl = document.getElementById("toDate");
  const searchEl = document.getElementById("searchPart");

  if (fromEl) fromEl.value = "";
  if (toEl) toEl.value = "";
  if (searchEl) searchEl.value = "";

  // Reload default view (last 7 days)
  loadTrackOrders();
}

function updateTotal() {
  let total = 0;

  document.querySelectorAll("#tableBody tr").forEach(row => {
    const valueText = row.querySelector(".value")?.innerText || "0";
    const value = Number(valueText.replace(/,/g, "")) || 0;
    total += value;
  });

  document.getElementById("totalValue").innerText = total.toLocaleString();
}


function toggleItems(i) {
  const row = document.getElementById("items-" + i);
  if (row) row.classList.toggle("hidden");
}

async function loadHQOrders(filter = "Pending") {

  showLoader();

            const res = await fetch(API, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain;charset=utf-8"
              },
              body: JSON.stringify({ action: "getRequests" })
            });

  const data = await res.json();

  // 🔥 FILTER
  let filtered = data;
  if (filter !== "All") {
    filtered = data.filter(d => d.status === filter);
  }

  // 🔥 PROCESSED TODAY
  const today = new Date().toDateString();
  const processedToday = data.filter(d =>
    d.status === "Processed" &&
    new Date(d.date).toDateString() === today
  ).length;

  // 🔥 TABLE START
  let html = `
    <div class="mb-3 text-sm text-gray-300">
      Processed Today: <span class="text-yellow-400 font-semibold">${processedToday}</span>
    </div>
  
    <!-- 🔥 SCROLL WRAPPER -->
    <div class="bg-gray-900 p-4 rounded-xl border border-gray-700 overflow-x-auto">
  
      <table class="min-w-[1400px] text-sm border border-gray-700 bg-gray-800">
        <thead class="bg-black text-yellow-400">
          <tr>
            <th class="p-3 whitespace-nowrap">Date</th>
            <th class="p-3 whitespace-nowrap">Branch</th>
            <th class="p-3 whitespace-nowrap">Type</th>
            <th class="p-3 whitespace-nowrap">For</th>
            <th class="p-3 whitespace-nowrap">Warranty</th>
            <th class="p-3 whitespace-nowrap">Employee</th>
            <th class="p-3 whitespace-nowrap">Approved By</th>
            <th class="p-3 whitespace-nowrap">Call ID</th>
            <th class="p-3 whitespace-nowrap">Machine</th>
            <th class="p-3 whitespace-nowrap">Customer</th>
            <th class="p-3 whitespace-nowrap">Contact</th>
            <th class="p-3 whitespace-nowrap">Parts</th>
            <th class="p-3 whitespace-nowrap">Total Qty</th>
            <th class="p-3 whitespace-nowrap">Order No</th>
            <th class="p-3 whitespace-nowrap">Value</th>
            <th class="p-3 whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  // 🔥 LOOP (THIS WAS MISSING)
 filtered.forEach((d, index) => {

  const isVOR = d.orderType === "VOR";
  const rowClass = isVOR ? "bg-red-900/30" : (index % 2 === 0 ? "bg-gray-800" : "bg-gray-900");

  const totalQty = d.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  html += `
    <tr class="${rowClass} border-t border-gray-700 text-gray-200 text-center cursor-pointer"
        onclick="toggleHQ(${index})">

      <td class="p-3 whitespace-nowrap">${new Date(d.date).toLocaleDateString()}</td>
      <td class="p-3 whitespace-nowrap">${d.branch}</td>
      <td class="p-3 whitespace-nowrap">${d.orderType}</td>
      <td class="p-3 whitespace-nowrap">${d.orderFor}</td>
      <td class="p-3 whitespace-nowrap">${d.warrantyStatus || "-"}</td>
      <td class="p-3 whitespace-nowrap">${d.employeeName || "-"}</td>
      <td class="p-3 whitespace-nowrap">${d.approvedBy || "-"}</td>
      <td class="p-3 whitespace-nowrap">${d.callId || "-"}</td>
      <td class="p-3 whitespace-nowrap">${d.machineNo || "-"}</td>
      <td class="p-3 whitespace-nowrap">${d.customerName || "-"}</td>
      <td class="p-3 whitespace-nowrap">${d.contactNo || "-"}</td>
      <td class="p-3 whitespace-nowrap">${d.items.length}</td>
      <td class="p-3 whitespace-nowrap">${totalQty}</td>
      <td class="p-3 whitespace-nowrap text-yellow-400 font-semibold">${d.tempOrderNo}</td>
      <td class="p-3 whitespace-nowrap text-green-400 font-semibold">
        ₹ ${Number(d.totalValue || 0).toLocaleString()}
      </td>
      <td class="p-3 whitespace-nowrap">${d.status}</td>
    </tr>

    <tr id="hq-${index}" class="hidden bg-black">
      <td colspan="16" class="p-3 text-left">

        <!-- HEADER -->
        <div class="flex justify-between text-yellow-400 font-semibold border-b border-gray-600 pb-1 mb-2">
          <span class="w-[20%]">Part</span>
          <span class="w-[35%]">Description</span>
          <span class="w-[15%] text-right">Qty</span>
          <span class="w-[25%] text-right">Value</span>
        </div>

        <!-- ITEMS -->
        ${d.items.map(item => `
          <div class="flex justify-between border-b border-gray-700 py-1 text-sm">
            <span class="w-[20%]">${item.partNo}</span>
            <span class="w-[35%]">${item.description}</span>
            <span class="w-[15%] text-right">Qty: ${item.qty}</span>
            <span class="w-[25%] text-right text-green-400">
              ₹ ${Number(item.value || 0).toLocaleString()}
            </span>
          </div>
        `).join("")}

        <!-- 🔥 PROCESS SECTION -->
        ${d.status === "Pending" ? `
          <div class="flex justify-center gap-2 mt-3">
            <input id="po-${index}" placeholder="Enter PO Number"
              class="bg-black border border-gray-600 px-3 py-2 rounded w-60 text-center"/>

            <button onclick="event.stopPropagation(); processOrder('${d.tempOrderNo}', ${index})"
              class="bg-green-500 px-4 py-2 rounded">
              Process
            </button>
          </div>
        ` : ""}

      </td>
    </tr>
  `;
});

  // 🔥 CLOSE TABLE
  html += `
      </tbody>
    </table>
  </div>
`;

  document.getElementById("hqOrders").innerHTML = html;

  hideLoader();
}

function toggleHQ(i) {
  const row = document.getElementById("hq-" + i);
  if (row) row.classList.toggle("hidden");
}
  

async function processOrder(tempOrderNo, index) {

  const poNo = document.getElementById("po-" + index).value;

  if (!poNo) {
    showPopup("Enter PO Number");
    return;
  }

  showLoader();

            await fetch(API, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain;charset=utf-8"
              },
              body: JSON.stringify({
                action: "updateOrder",
                tempOrderNo: tempOrderNo,
                orderNo: poNo
              })
            });

  hideLoader();
  showPopup("Order Processed!");

  loadHQOrders("Pending");
}

  
</script>
