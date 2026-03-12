/*
  ReporterHQ front-end logic.
  - Uses backend API if available.
  - Falls back to localStorage for offline/demo usage.
*/

let USE_API = true;
const STORAGE_KEYS = {
  token: "reporterhq_token",
  username: "reporterhq_username",
  articles: "news_reports_articles",
  gallery: "news_reports_gallery",
};

function getApiBase() {
  // When loaded via file://, origin is "null", so we fall back to empty (relative)
  const origin = window.location.origin;
  return origin === "null" ? "" : origin;
}

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.token, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.token);
  }
}

function setUsername(username) {
  if (username) {
    localStorage.setItem(STORAGE_KEYS.username, username);
  } else {
    localStorage.removeItem(STORAGE_KEYS.username);
  }
}

function getUsername() {
  return localStorage.getItem(STORAGE_KEYS.username);
}

function showToast(message, duration = 2800) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toast._hideTimer);
  toast._hideTimer = window.setTimeout(() => toast.classList.remove("show"), duration);
}

function apiFetch(path, options = {}) {
  if (!USE_API) return Promise.reject(new Error("API disabled"));

  const url = `${getApiBase()}/api${path}`;
  const token = getToken();
  const headers = options.headers || {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  }).then(async (res) => {
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const message = data?.error || res.statusText || "Request failed";
      const error = new Error(message);
      error.response = data;
      throw error;
    }

    return data;
  });
}

async function detectBackend() {
  try {
    await apiFetch("/articles");
    USE_API = true;
  } catch {
    USE_API = false;
    showToast("Backend not available; running in local mode.");
  }
}

function isSignedIn() {
  if (!USE_API) {
    return !!getUsername();
  }
  return !!getToken();
}

function signOut() {
  setToken(null);
  setUsername(null);
}

function requireAuth() {
  if (!isSignedIn()) {
    window.location.href = "./login.html";
  }
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/* --- Local-storage fallback --- */
function getArticlesLocal() {
  const raw = localStorage.getItem(STORAGE_KEYS.articles);
  if (!raw) return [];
  try {
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function saveArticlesLocal(articles) {
  localStorage.setItem(STORAGE_KEYS.articles, JSON.stringify(articles));
}

function getGalleryLocal() {
  const raw = localStorage.getItem(STORAGE_KEYS.gallery);
  if (!raw) return [];
  try {
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function saveGalleryLocal(items) {
  localStorage.setItem(STORAGE_KEYS.gallery, JSON.stringify(items));
}

/* --- Public pages --- */
async function renderHomeArticles() {
  const container = document.getElementById("home-news");
  if (!container) return;

  const articles = await fetchArticles().catch(() => getArticlesLocal());
  if (!articles.length) {
    container.innerHTML = "<p class='small'>No articles yet. Sign in to add content.</p>";
    return;
  }

  container.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "grid";

  articles
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((article) => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <h3>${escapeHtml(article.title)}</h3>
        <time>${formatDate(article.updatedAt)}</time>
        <p>${escapeHtml(article.summary || "No summary yet.")}</p>
        <div class='card-actions'>
          <a class='btn' href='${article.url || "#"}' target='_blank'>Read full</a>
        </div>
      `;
      grid.appendChild(card);
    });

  container.appendChild(grid);
}

async function renderGalleryPreview() {
  const grid = document.getElementById("gallery-preview");
  if (!grid) return;

  const items = await fetchGallery().catch(() => getGalleryLocal());
  if (!items.length) {
    grid.innerHTML = "<p class='small'>No photos available yet. Add some in the admin panel.</p>";
    return;
  }

  const cards = items
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((item) => {
      return `
        <div class="gallery-item">
          <img src="${item.dataUrl}" alt="${escapeHtml(item.caption || "Gallery image")}" loading="lazy"/>
          <div class="caption">
            ${escapeHtml(item.caption || "Untitled")}
            <span class="small">${formatDate(item.updatedAt)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  grid.innerHTML = cards;
}

/* --- Admin pages --- */
async function renderAdminArticles() {
  const table = document.getElementById("articles-table");
  if (!table) return;

  const articles = await fetchArticles().catch(() => getArticlesLocal());
  if (!articles.length) {
    table.querySelector("tbody").innerHTML = "<tr><td colspan='4' class='small'>No saved stories yet.</td></tr>";
    return;
  }

  const rows = articles
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((article) => {
      return `
        <tr data-id="${article.id}">
          <td>${escapeHtml(article.title)}</td>
          <td class="small">${formatDate(article.updatedAt)}</td>
          <td class="small">${escapeHtml(article.summary || "—")}</td>
          <td class="actions">
            <button class="btn" type="button" data-action="edit">Edit</button>
            <button class="btn btn--danger" type="button" data-action="delete">Delete</button>
          </td>
        </tr>
      `;
    })
    .join("");

  table.querySelector("tbody").innerHTML = rows;
}

async function renderAdminGallery() {
  const table = document.getElementById("gallery-table");
  if (!table) return;

  const items = await fetchGallery().catch(() => getGalleryLocal());
  if (!items.length) {
    table.querySelector("tbody").innerHTML = "<tr><td colspan='3' class='small'>No images yet.</td></tr>";
    return;
  }

  const rows = items
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((item) => {
      return `
        <tr data-id="${item.id}">
          <td>
            <img src="${item.dataUrl}" alt="${escapeHtml(item.caption || "Photo")}" style="width: 96px; height: 64px; object-fit: cover; border-radius: 10px;" />
          </td>
          <td>
            <div>${escapeHtml(item.caption || "Untitled")}</div>
            <div class="small">${formatDate(item.updatedAt)}</div>
          </td>
          <td class="actions">
            <button class="btn" type="button" data-action="edit">Edit</button>
            <button class="btn btn--danger" type="button" data-action="delete">Delete</button>
          </td>
        </tr>
      `;
    })
    .join("");

  table.querySelector("tbody").innerHTML = rows;
}

/* --- API helper methods --- */
function fetchArticles() {
  if (!USE_API) return Promise.resolve(getArticlesLocal());
  return apiFetch("/articles").then((data) => data.articles || []);
}

function createArticle({ title, url, summary }) {
  if (!USE_API) {
    const articles = getArticlesLocal();
    const now = new Date().toISOString();
    const article = { id: generateId(), title, url, summary, createdAt: now, updatedAt: now };
    articles.unshift(article);
    saveArticlesLocal(articles);
    return Promise.resolve(article);
  }
  return apiFetch("/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, url, summary }),
  }).then((data) => data.article);
}

function updateArticle(id, { title, url, summary }) {
  if (!USE_API) {
    const articles = getArticlesLocal();
    const index = articles.findIndex((item) => item.id === id);
    if (index === -1) return Promise.reject(new Error("Not found"));
    articles[index] = { ...articles[index], title, url, summary, updatedAt: new Date().toISOString() };
    saveArticlesLocal(articles);
    return Promise.resolve(articles[index]);
  }
  return apiFetch(`/articles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, url, summary }),
  }).then((data) => data.article);
}

function deleteArticle(id) {
  if (!USE_API) {
    const articles = getArticlesLocal();
    const index = articles.findIndex((item) => item.id === id);
    if (index === -1) return Promise.reject(new Error("Not found"));
    articles.splice(index, 1);
    saveArticlesLocal(articles);
    return Promise.resolve();
  }
  return apiFetch(`/articles/${id}`, { method: "DELETE" });
}

function fetchGallery() {
  if (!USE_API) return Promise.resolve(getGalleryLocal());
  return apiFetch("/gallery").then((data) => data.gallery || []);
}

function addGalleryItem({ caption, dataUrl }) {
  if (!USE_API) {
    const items = getGalleryLocal();
    const now = new Date().toISOString();
    const item = { id: generateId(), caption, dataUrl, createdAt: now, updatedAt: now };
    items.unshift(item);
    saveGalleryLocal(items);
    return Promise.resolve(item);
  }
  return apiFetch("/gallery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caption, dataUrl }),
  }).then((data) => data.item);
}

function updateGalleryItem(id, { caption }) {
  if (!USE_API) {
    const items = getGalleryLocal();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return Promise.reject(new Error("Not found"));
    items[index] = { ...items[index], caption, updatedAt: new Date().toISOString() };
    saveGalleryLocal(items);
    return Promise.resolve(items[index]);
  }
  return apiFetch(`/gallery/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caption }),
  }).then((data) => data.item);
}

function deleteGalleryItem(id) {
  if (!USE_API) {
    const items = getGalleryLocal();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return Promise.reject(new Error("Not found"));
    items.splice(index, 1);
    saveGalleryLocal(items);
    return Promise.resolve();
  }
  return apiFetch(`/gallery/${id}`, { method: "DELETE" });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function initLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = form.elements["username"].value.trim();
    const password = form.elements["password"].value;

    if (!username || !password) {
      showToast("Please enter username and password.");
      return;
    }

    if (!USE_API) {
      setUsername(username);
      showToast("Logged in (local). Redirecting...");
      window.location.href = "./dashboard.html";
      return;
    }

    try {
      const data = await apiFetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      setToken(data.token);
      setUsername(data.username);
      showToast("Logged in successfully.");
      window.location.href = "./dashboard.html";
    } catch (err) {
      showToast(err.message || "Invalid credentials.");
    }
  });
}

function initDashboardPage() {
  requireAuth();

  const signOutBtn = document.getElementById("signout");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      signOut();
      window.location.href = "./login.html";
    });
  }

  renderAdminArticles();
  renderAdminGallery();

  const articleForm = document.getElementById("article-form");
  articleForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = articleForm.elements["title"].value.trim();
    const url = articleForm.elements["url"].value.trim();
    const summary = articleForm.elements["summary"].value.trim();
    const id = articleForm.elements["article-id"].value;

    if (!title) {
      showToast("Title is required.");
      return;
    }

    try {
      if (id) {
        await updateArticle(id, { title, url, summary });
        showToast("Story updated.");
      } else {
        await createArticle({ title, url, summary });
        showToast("Story added.");
      }

      articleForm.reset();
      articleForm.elements["article-id"].value = "";
      await renderAdminArticles();
      await renderHomeArticles();
    } catch (err) {
      showToast(err.message || "Could not save story.");
    }
  });

  const articlesTable = document.getElementById("articles-table");
  articlesTable?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const tr = button.closest("tr");
    if (!tr) return;

    const id = tr.dataset.id;
    const action = button.dataset.action;

    if (action === "edit") {
      const articles = await fetchArticles().catch(() => getArticlesLocal());
      const existing = articles.find((item) => item.id === id);
      if (!existing) return;

      articleForm.elements["title"].value = existing.title;
      articleForm.elements["url"].value = existing.url;
      articleForm.elements["summary"].value = existing.summary;
      articleForm.elements["article-id"].value = existing.id;
      articleForm.scrollIntoView({ behavior: "smooth" });
    }

    if (action === "delete") {
      const confirmed = confirm("Delete this story? This cannot be undone.");
      if (!confirmed) return;

      try {
        await deleteArticle(id);
        await renderAdminArticles();
        await renderHomeArticles();
        showToast("Story deleted.");
      } catch (err) {
        showToast(err.message || "Could not delete story.");
      }
    }
  });

  const galleryForm = document.getElementById("gallery-form");
  galleryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fileInput = galleryForm.elements["photo"];
    const caption = galleryForm.elements["caption"].value.trim();

    if (!fileInput?.files?.length) {
      showToast("Pick an image to upload.");
      return;
    }

    try {
      const file = fileInput.files[0];
      const dataUrl = await fileToDataUrl(file);
      await addGalleryItem({ caption, dataUrl });
      galleryForm.reset();
      await renderAdminGallery();
      await renderGalleryPreview();
      showToast("Photo added.");
    } catch (err) {
      showToast(err.message || "Could not upload photo.");
    }
  });

  const galleryTable = document.getElementById("gallery-table");
  galleryTable?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const tr = button.closest("tr");
    if (!tr) return;

    const id = tr.dataset.id;
    const action = button.dataset.action;

    if (action === "delete") {
      const confirmed = confirm("Remove this photo? This cannot be undone.");
      if (!confirmed) return;

      try {
        await deleteGalleryItem(id);
        await renderAdminGallery();
        await renderGalleryPreview();
        showToast("Photo removed.");
      } catch (err) {
        showToast(err.message || "Could not remove photo.");
      }
    }

    if (action === "edit") {
      const items = await fetchGallery().catch(() => getGalleryLocal());
      const existing = items.find((item) => item.id === id);
      if (!existing) return;

      const newCaption = prompt("Update caption:", existing.caption || "");
      if (newCaption != null) {
        try {
          await updateGalleryItem(id, { caption: newCaption });
          await renderAdminGallery();
          await renderGalleryPreview();
          showToast("Caption updated.");
        } catch (err) {
          showToast(err.message || "Could not update caption.");
        }
      }
    }
  });
}

function initPublicPages() {
  renderHomeArticles();
  renderGalleryPreview();
}

async function setup() {
  const page = document.body.dataset.page;
  if (!page) return;

  await detectBackend();

  switch (page) {
    case "home":
      initPublicPages();
      break;
    case "login":
      initLoginPage();
      break;
    case "dashboard":
      initDashboardPage();
      break;
  }
}

window.addEventListener("DOMContentLoaded", setup);
