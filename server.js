const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.resolve(__dirname, "data.json");

const ADMIN = {
  username: "admin",
  password: "password",
};

const JWT_SECRET = process.env.JWT_SECRET || "reporterhq-secret";
const JWT_EXPIRES = "4h";

app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "6mb" }));

app.use(express.static(path.resolve(__dirname)));

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return { articles: [], gallery: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function requireAuth(req, res, next) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  if (username !== ADMIN.username || password !== ADMIN.password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, username });
});

app.get("/api/articles", (req, res) => {
  const data = readData();
  res.json({ articles: data.articles || [] });
});

app.post("/api/articles", requireAuth, (req, res) => {
  const { title, url, summary } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const data = readData();
  const now = new Date().toISOString();
  const id = Math.random().toString(16).slice(2) + Date.now().toString(16);

  const article = {
    id,
    title,
    url: url || "",
    summary: summary || "",
    createdAt: now,
    updatedAt: now,
  };

  data.articles = data.articles || [];
  data.articles.unshift(article);
  writeData(data);

  res.json({ article });
});

app.put("/api/articles/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const { title, url, summary } = req.body;
  const data = readData();
  const articles = data.articles || [];
  const index = articles.findIndex((a) => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Article not found" });
  }

  articles[index] = {
    ...articles[index],
    title: title || articles[index].title,
    url: url || articles[index].url,
    summary: summary || articles[index].summary,
    updatedAt: new Date().toISOString(),
  };

  writeData(data);
  res.json({ article: articles[index] });
});

app.delete("/api/articles/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const data = readData();
  const articles = data.articles || [];
  const index = articles.findIndex((a) => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Article not found" });
  }

  articles.splice(index, 1);
  writeData(data);
  res.json({ success: true });
});

app.get("/api/gallery", (req, res) => {
  const data = readData();
  res.json({ gallery: data.gallery || [] });
});

app.post("/api/gallery", requireAuth, (req, res) => {
  const { caption, dataUrl } = req.body;
  if (!dataUrl) {
    return res.status(400).json({ error: "dataUrl is required" });
  }

  const data = readData();
  const now = new Date().toISOString();
  const id = Math.random().toString(16).slice(2) + Date.now().toString(16);

  const item = {
    id,
    caption: caption || "",
    dataUrl,
    createdAt: now,
    updatedAt: now,
  };

  data.gallery = data.gallery || [];
  data.gallery.unshift(item);
  writeData(data);

  res.json({ item });
});

app.put("/api/gallery/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const { caption } = req.body;
  const data = readData();
  const gallery = data.gallery || [];
  const index = gallery.findIndex((item) => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Gallery item not found" });
  }

  gallery[index] = {
    ...gallery[index],
    caption: caption ?? gallery[index].caption,
    updatedAt: new Date().toISOString(),
  };

  writeData(data);
  res.json({ item: gallery[index] });
});

app.delete("/api/gallery/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const data = readData();
  const gallery = data.gallery || [];
  const index = gallery.findIndex((item) => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Gallery item not found" });
  }

  gallery.splice(index, 1);
  writeData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`ReporterHQ server running on http://localhost:${PORT}`);
});
