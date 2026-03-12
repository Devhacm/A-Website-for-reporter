# ReporterHQ (News Reporter Website)

A simple modern news reporter site with:

- Public home page (latest stories + gallery)
- Admin login & dashboard
- Editable news stories (create/edit/delete)
- Editable gallery (upload/delete/edit caption)

## Running locally (recommended)

This project includes a small backend API (Node/Express) to store data in `data.json`.

### Prerequisites

- Node.js (includes `npm`) must be installed.

### Start the server

```bash
cd "c:\Users\singh\OneDrive\Desktop\Web\news"
npm install
npm start
```

Then open:

- http://localhost:3000/index.html (public home)
- http://localhost:3000/login.html (admin login)

### Admin login (demo)

- Username: `admin`
- Password: `password`

## Running without the backend (local-only mode)

If the backend cannot be reached, the app will automatically fall back to storing data in your browser's `localStorage`.

This means:

- Stories and photos are saved per-browser
- No authentication is enforced (anyone can access the admin UI)

---

If you want help deploying this to a real server or adding a database (SQLite / MongoDB), just ask!
