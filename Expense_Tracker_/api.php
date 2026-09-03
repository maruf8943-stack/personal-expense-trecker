<?php
declare(strict_types=1);



session_name('expense_tracker_session');
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$dataDirectory = getenv('DATA_DIR') ?: __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDirectory)) {
    mkdir($dataDirectory, 0775, true);
}
$database = new PDO('sqlite:' . $dataDirectory . DIRECTORY_SEPARATOR . 'expense_tracker.sqlite');
$database->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$database->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$database->exec(
    'CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ("income", "expense", "saving")),
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL CHECK(amount > 0),
        transaction_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date
        ON transactions(user_id, transaction_date);'
);


$demoCheck = $database->query("SELECT id FROM users WHERE username = 'Maruf'")->fetchColumn();
if (!$demoCheck) {
    $demoUser = $database->prepare(
        'INSERT INTO users (username, name, password_hash) VALUES (?, ?, ?)'
    );
    $demoUser->execute(['maruf', 'Maruf8943', password_hash('demo123', PASSWORD_DEFAULT)]);
    $demoId = (int) $database->lastInsertId();
    $today = new DateTimeImmutable('today');
    $demoDate = fn(int $daysAgo): string => $today->modify("-{$daysAgo} days")->format('Y-m-d');
    $demoTransactions = [
        ['income', 'Salary', 'Monthly salary', 2645, $demoDate(28)],
        ['expense', 'Food & Health', 'Grocery shopping', 86.32, $demoDate(22)],
        ['expense', 'Subscription', 'Streaming service', 14.99, $demoDate(18)],
        ['expense', 'Shopping', 'New shoes', 120, $demoDate(14)],
        ['expense', 'Entertainments', 'Movie night', 32.50, $demoDate(10)],
        ['expense', 'Investment', 'Index fund top-up', 200, $demoDate(7)],
        ['expense', 'Transport', 'Fuel', 45.20, $demoDate(5)],
        ['income', 'Freelance', 'Logo design gig', 300, $demoDate(3)],
        ['saving', 'Emergency fund', 'Starter savings', 250, $demoDate(1)]
    ];
    $demoTransaction = $database->prepare(
        'INSERT INTO transactions (user_id, type, category, description, amount, transaction_date)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($demoTransactions as $transaction) {
        $demoTransaction->execute([$demoId, ...$transaction]);
    }
}

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function input(): array
{
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '{}', true);
    return is_array($decoded) ? $decoded : [];
}

function cleanString(mixed $value, int $max = 120): string
{
    $value = trim((string) $value);
    return substr($value, 0, $max);
}

function currentUser(PDO $database): ?array
{
    if (empty($_SESSION['user_id'])) return null;
    $statement = $database->prepare('SELECT id, username, name FROM users WHERE id = ?');
    $statement->execute([(int) $_SESSION['user_id']]);
    $user = $statement->fetch();
    return $user ?: null;
}

function userData(PDO $database, int $userId): array
{
    $statement = $database->prepare(
        'SELECT id, type, category, description, amount, transaction_date AS date
         FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC, id DESC'
    );
    $statement->execute([$userId]);
    $transactions = array_map(static function (array $row): array {
        $row['id'] = (string) $row['id'];
        $row['amount'] = (float) $row['amount'];
        return $row;
    }, $statement->fetchAll());
    return ['transactions' => $transactions];
}

function validateDate(string $date): bool
{
    $parsed = DateTime::createFromFormat('!Y-m-d', $date);
    return $parsed !== false && $parsed->format('Y-m-d') === $date;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$payload = $method === 'GET' ? [] : input();
$action = $method === 'GET'
    ? cleanString($_GET['action'] ?? 'session', 40)
    : cleanString($payload['action'] ?? '', 40);

try {
    if ($action === 'session') {
        $user = currentUser($database);
        respond($user
            ? ['ok' => true, 'user' => ['username' => $user['username'], 'name' => $user['name']], 'data' => userData($database, (int) $user['id'])]
            : ['ok' => false, 'error' => 'Not signed in.'], 200);
    }

    if ($action === 'register' && $method === 'POST') {
        $username = strtolower(cleanString($payload['username'] ?? '', 40));
        $name = cleanString($payload['name'] ?? '', 80);
        $password = (string) ($payload['password'] ?? '');
        if (!preg_match('/^[a-z0-9_]{3,40}$/', $username)) {
            respond(['ok' => false, 'error' => 'Username must be 3–40 letters, numbers, or underscores.'], 422);
        }
        if ($name === '' || strlen($password) < 4) {
            respond(['ok' => false, 'error' => 'Add a name and a password of at least 4 characters.'], 422);
        }
        $statement = $database->prepare(
            'INSERT INTO users (username, name, password_hash) VALUES (?, ?, ?)'
        );
        try {
            $statement->execute([$username, $name, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $error) {
            if ((int) $error->errorInfo[1] === 19) {
                respond(['ok' => false, 'error' => 'An account with that username already exists.'], 409);
            }
            throw $error;
        }
        respond(['ok' => true]);
    }

    if ($action === 'login' && $method === 'POST') {
        $username = strtolower(cleanString($payload['username'] ?? '', 40));
        $password = (string) ($payload['password'] ?? '');
        $statement = $database->prepare('SELECT id, username, name, password_hash FROM users WHERE username = ?');
        $statement->execute([$username]);
        $user = $statement->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(['ok' => false, 'error' => 'Incorrect username or password.'], 401);
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        respond(['ok' => true, 'user' => ['username' => $user['username'], 'name' => $user['name']]]);
    }

    if ($action === 'logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(['ok' => true]);
    }

    $user = currentUser($database);
    if (!$user) respond(['ok' => false, 'error' => 'Your session has expired. Please sign in again.'], 401);
    $userId = (int) $user['id'];

    if ($action === 'data' && $method === 'GET') {
        respond(['ok' => true, 'data' => userData($database, $userId)]);
    }

    if ($action === 'add_transaction' && $method === 'POST') {
        $type = cleanString($payload['type'] ?? '', 20);
        $category = cleanString($payload['category'] ?? '', 80);
        $description = cleanString($payload['description'] ?? $category, 160);
        $amount = filter_var($payload['amount'] ?? null, FILTER_VALIDATE_FLOAT);
        $date = cleanString($payload['date'] ?? '', 10);
        if (!in_array($type, ['income', 'expense', 'saving'], true) || $category === '' ||
            $amount === false || $amount <= 0 || !validateDate($date)) {
            respond(['ok' => false, 'error' => 'Please provide a valid type, category, amount, and date.'], 422);
        }
        $statement = $database->prepare(
            'INSERT INTO transactions (user_id, type, category, description, amount, transaction_date)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([$userId, $type, $category, $description ?: $category, $amount, $date]);
        respond(['ok' => true, 'data' => userData($database, $userId)]);
    }

    if ($action === 'delete_transaction' && $method === 'POST') {
        $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) respond(['ok' => false, 'error' => 'Invalid transaction.'], 422);
        $statement = $database->prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?');
        $statement->execute([$id, $userId]);
        respond(['ok' => true, 'data' => userData($database, $userId)]);
    }
} catch (Throwable $error) {
    error_log($error->getMessage());
    respond(['ok' => false, 'error' => 'Something went wrong on the server.'], 500);
}

respond(['ok' => false, 'error' => 'Unknown request.'], 404);
