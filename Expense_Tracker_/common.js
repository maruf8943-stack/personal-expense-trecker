/* Shared browser helpers for the PHP/SQLite API. */

const API_URL = "api.php";

async function apiRequest(action, options = {}) {
  const request = {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  };

  if (options.body !== undefined) {
    request.method = request.method === "GET" ? "POST" : request.method;
    request.headers["Content-Type"] = "application/json";
    request.body = JSON.stringify({ ...(options.body || {}), action });
  }

  const query = request.method === "GET" ? "?action=" + encodeURIComponent(action) : "";
  let response;
  try {
    response = await fetch(API_URL + query, request);
  } catch (error) {
    return { ok: false, error: "Unable to reach the server. Please try again." };
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    return {
      ok: false,
      error: response.status
        ? "The server returned an invalid response (HTTP " + response.status +
          "). Make sure Render is running the included PHP Web Service, not a Static Site."
        : "The server returned an invalid response."
    };
  }

  if (!response.ok && result.ok !== false) {
    result.ok = false;
  }
  return result;
}

async function getCurrentUser() {
  const result = await apiRequest("session");
  return result.ok ? result.user : null;
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

async function redirectIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) window.location.href = "index.html";
  return user;
}

async function logout() {
  await apiRequest("logout", { method: "POST", body: {} });
  window.location.href = "login.html";
}
