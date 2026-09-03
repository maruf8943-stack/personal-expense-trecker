document.addEventListener("DOMContentLoaded", async () => {
  await redirectIfLoggedIn();

  const tabs = document.querySelectorAll(".auth-tab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const errorEl = document.getElementById("authError");
  const successEl = document.getElementById("authSuccess");

  function clearMessages() {
    errorEl.textContent = "";
    errorEl.classList.remove("show");
    successEl.textContent = "";
    successEl.classList.remove("show");
  }

  function showError(msg) {
    clearMessages();
    errorEl.textContent = msg;
    errorEl.classList.add("show");
  }

  function showSuccess(msg) {
    clearMessages();
    successEl.textContent = msg;
    successEl.classList.add("show");
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      clearMessages();

      if (tab.dataset.tab === "login") {
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
      } else {
        registerForm.classList.remove("hidden");
        loginForm.classList.add("hidden");
      }
    });
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    const submitButton = loginForm.querySelector("button[type=submit]");
    submitButton.disabled = true;
    const result = await apiRequest("login", {
      method: "POST",
      body: { username, password }
    });
    submitButton.disabled = false;
    if (!result.ok) {
      showError(result.error || "Unable to sign in.");
      return;
    }

    window.location.href = "index.html";
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("registerName").value.trim();
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirm = document.getElementById("registerConfirm").value;

    if (!username || username.length < 3) {
      showError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 4) {
      showError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      showError("Passwords do not match.");
      return;
    }

    const submitButton = registerForm.querySelector("button[type=submit]");
    submitButton.disabled = true;
    const result = await apiRequest("register", {
      method: "POST",
      body: { username, password, name }
    });
    submitButton.disabled = false;
    if (!result.ok) {
      showError(result.error || "Unable to create account.");
      return;
    }

    showSuccess("Account created! You can sign in now.");
    registerForm.reset();
    setTimeout(() => {
      document.querySelector('.auth-tab[data-tab="login"]').click();
      document.getElementById("loginUsername").value = username;
    }, 900);
  });
});
