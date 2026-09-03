# Personal Expense Tracker

An HTML-first expense tracker with a small PHP API and SQLite SQL database.

## Run locally

From this folder:

```bash
php -S localhost:8000
```

Open <http://localhost:8000/login.html>. The demo account is `nick` / `demo123`.
Your PHP installation must have both `pdo_sqlite` and `sqlite3` enabled.

The first API request creates `data/expense_tracker.sqlite` and the `users` and
`transactions` tables automatically. The same schema is also available in
`database.sql` if you want to inspect or initialize the database manually.
Income, expense, and savings records are stored in the `transactions` table.

## Deploy to Render Free

Upload the contents of this folder to the root of a GitHub repository, then create a
new Render Web Service with these settings:

```text
Runtime: Docker
Dockerfile Path: Dockerfile
Docker Build Context Directory: .
Root Directory: blank
Build Command: blank
Start Command: blank
Plan: Free
```

Do not add environment variables or a persistent disk for the Free plan. The
Dockerfile starts PHP's built-in server automatically. Free Render services use
temporary storage, so SQLite data can be lost after a restart or redeploy.

The included `render.yaml` is for a paid Render service with a persistent disk.
Use it only when you want durable SQLite storage.

The app is intentionally HTML/CSS/JavaScript-first. PHP handles authentication
and SQL database operations, so the interface can be edited without a framework.