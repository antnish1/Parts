function togglePass() {
  const p = document.getElementById("password");
  p.type = p.type === "password" ? "text" : "password";
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
  const role = document.querySelector('input[name="role"]:checked')?.value;

  const errorEl = document.getElementById("error");

  if (!branch || !password || !role) {
    showError("Please fill all fields");
    return;
  }

  try {

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?Branch=eq.${branch}&Role=eq.${role}`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const data = await res.json();

    if (data.length === 0) {
      showError("Invalid credentials");
      return;
    }

    const user = data[0];

    if (user.Password !== password) {
      showError("Invalid credentials");
      return;
    }

    // Save session
    localStorage.setItem("user", JSON.stringify(user));

    // Redirect
    if (role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "app.html";
    }

  } catch (err) {
    console.error(err);
    showError("Login failed");
  }
}

function showError(msg) {
  const el = document.getElementById("error");
  el.innerText = msg;
  el.classList.remove("hidden");

  // Shake animation
  el.style.animation = "shake 0.3s";
  setTimeout(() => el.style.animation = "", 300);
}
