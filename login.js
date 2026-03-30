function togglePass() {
  const p = document.getElementById("password");
  const eye = document.getElementById("eyeIcon");

  if (p.type === "password") {
    p.type = "text";
    eye.innerText = "🙈"; // open
  } else {
    p.type = "password";
    eye.innerText = "👁️"; // closed
  }
}

// Auto role based on branch
function setRole() {
  const branch = document.getElementById("branch").value;
  const radios = document.getElementsByName("role");

  if (branch === "HQ") {
    radios[1].checked = true; // admin
  } else {
    radios[0].checked = true; // branch
  }
}

// LOGIN FUNCTION
async function login() {

  const branch = document.getElementById("branch").value;
  const password = document.getElementById("password").value;
  const errorEl = document.getElementById("error");

  if (!branch || !password) {
    showError("Please fill all fields");
    return;
  }

  showLoader(true);

  try {

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?Branch=eq.${branch}`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const data = await res.json();

    if (!data || data.length === 0) {
      showError("Invalid credentials");
      showLoader(false);
      return;
    }

    const user = data[0];

    if (user.Password !== password) {
      showError("Invalid credentials");
      showLoader(false);
      return;
    }

    localStorage.setItem("user", JSON.stringify(user));

    // redirect
    if (user.Role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "app.html";
    }

  } catch (err) {
    console.error(err);
    showError("Login failed");
  }

  showLoader(false);
}

function showError(msg) {
  const el = document.getElementById("error");
  el.innerText = msg;
  el.classList.remove("hidden");

  // Shake animation
  el.style.animation = "shake 0.3s";
  setTimeout(() => el.style.animation = "", 300);
}


async function fetchRole() {

  const branch = document.getElementById("branch").value;

  if (!branch) return;

  // ✅ ADD THIS LINE HERE
  document.getElementById("role").value = "Loading...";

  try {

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?Branch=eq.${branch}`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const data = await res.json();

    if (data.length === 0) {
      showError("User not found");
      document.getElementById("role").value = "";
      return;
    }

    const user = data[0];

    // 🔥 FINAL VALUE SET
    document.getElementById("role").value = user.Role;

  } catch (err) {
    console.error(err);
    showError("Error fetching role");
    document.getElementById("role").value = "";
  }
}


function showLoader(show) {
  document.getElementById("btnText").classList.toggle("hidden", show);
  document.getElementById("btnLoader").classList.toggle("hidden", !show);
}
