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

## Deploy to Render

This folder includes `Dockerfile` and `render.yaml`. Create a new Render Web Service
from the repository containing this folder. Render uses the PHP built-in server inside
the Docker image, and the mounted disk stores the SQLite database at `/var/data`.
The included persistent disk uses Render's `starter` plan because persistent disks
are not available on the free plan.

The app is intentionally HTML/CSS/JavaScript-first. PHP only handles authentication
and durable SQL database operations, so the interface can be edited without a framework.