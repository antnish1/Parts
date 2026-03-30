let isSubmitting = false;

// ---------- UI ----------
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

// ---------- INIT ----------
window.onload = () => {
  document.getElementById("app").innerHTML = `
    <button onclick="addRow()" class="bg-yellow-400 text-black px-4 py-2">+ Add Item</button>
    <button onclick="submitAll()" class="bg-yellow-500 text-black px-4 py-2 ml-2">Submit</button>

    <table class="w-full mt-4">
      <tbody id="tableBody"></tbody>
    </table>
  `;

  addRow();
};

// ---------- ADD ROW ----------
function addRow() {

  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input class="partNo input"></td>
    <td><input type="number" class="qty input"></td>
    <td><div class="desc"></div></td>
    <td><div class="dnp text-yellow-400"></div></td>
    <td><div class="value text-green-400"></div></td>
    <td><button onclick="this.closest('tr').remove()">X</button></td>
  `;

  document.getElementById("tableBody").appendChild(row);
}

// ---------- SUBMIT ----------
async function submitAll() {

  if (isSubmitting) return;
  isSubmitting = true;

  showLoader();

  const rows = document.querySelectorAll("#tableBody tr");

  try {

    for (let r of rows) {

      const partNo = r.querySelector(".partNo").value.trim();
      const qty = r.querySelector(".qty").value;

      if (!partNo) continue;

      if (!qty || qty < 1) {
        showPopup("Please Enter Quantity ❗");
        hideLoader();
        isSubmitting = false;
        return;
      }

      const dnp = 0;   // TEMP (we will fetch later)
      const value = dnp * qty;

      // 🔥 MAIN SUPABASE CALL
      const res = await fetch(`${SUPABASE_URL}/rest/v1/requests`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          branch: "TEST",
          order_type: "SOP",
          order_for: "Stock",
          warranty_status: "",
          employee_name: "TEST",
          approved_by: "",
          call_id: "",
          machine_no: "",
          customer_name: "",
          contact_no: "",
          part_no: partNo,
          qty: Number(qty),
          description: "",
          temp_order_no: "T" + Date.now(),
          status: "Pending",
          dnp: dnp,
          value: value
        })
      });

      const text = await res.text();
      console.log("SUPABASE RESPONSE:", text);

      if (!res.ok) {
        throw new Error(text);
      }

    }

    showPopup("Submitted successfully ✅");

  } catch (err) {
    console.error(err);
    showPopup("Submission failed ❗");
  }

  hideLoader();
  isSubmitting = false;
}
