let isSubmitting = false;

function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}

function showPopup(msg) {
  document.getElementById("popupMsg").innerText = msg;
  document.getElementById("popup").classList.remove("hidden");
}

function closePopup() {
  document.getElementById("popup").classList.add("hidden");
}

// ---------- INIT ----------
window.onload = () => loadApp();

function loadApp() {
  document.getElementById("app").innerHTML = `
    <div class="max-w-5xl mx-auto">
      <button onclick="addRow()" class="bg-yellow-400 text-black px-4 py-2 rounded">+ Add Item</button>
      <button onclick="submitAll()" class="bg-yellow-500 text-black px-4 py-2 rounded ml-2">Submit</button>
      <table class="w-full mt-4">
        <tbody id="tableBody"></tbody>
      </table>
    </div>
  `;
  addRow();
}

// ---------- ADD ROW ----------
function addRow() {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input class="partNo input"></td>
    <td><input type="number" class="qty input"></td>
    <td><div class="desc"></div></td>
    <td><div class="dnp text-yellow-400"></div></td>
    <td><div class="value text-green-400"></div></td>
    <td><button onclick="this.closest('tr').remove()">✕</button></td>
  `;

  document.getElementById("tableBody").appendChild(row);
}

// ---------- SUBMIT ----------
async function submitAll() {

  if (isSubmitting) return;
  isSubmitting = true;

  showLoader();

  const rows = document.querySelectorAll("#tableBody tr");
  const items = [];

  for (let r of rows) {

    const partNo = r.querySelector(".partNo").value.trim();
    const qty = r.querySelector(".qty").value;
    const desc = r.querySelector(".desc").innerText;
    const dnp = Number(r.querySelector(".dnp").innerText) || 0;

    if (!partNo) continue;

    if (!qty || qty < 1) {
      showPopup("Please Enter Quantity ❗");
      hideLoader();
      isSubmitting = false;
      return;
    }

    const value = dnp * qty;

    items.push({
      partNo,
      qty,
      description: desc,
      dnp,
      value
    });
  }

  try {

    for (let item of items) {

      await fetch(`${SUPABASE_URL}/rest/v1/requests`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          part_no: item.partNo,
          qty: Number(item.qty),
          description: item.description,
          dnp: item.dnp,
          value: item.value,
          status: "Pending"
        })
      });

    }

    showPopup("Submitted successfully ✅");

  } catch (err) {
    console.error(err);
    showPopup("Submission failed ❗");
  }

  hideLoader();
  isSubmitting = false;
}
