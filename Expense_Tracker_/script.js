/* =========================================================
   script.js - Personal Expense Tracker dashboard logic
   Depends on common.js being loaded first.
   ========================================================= */

const CREDIT_LIMIT = 12645; // static "total available" line used for the My Card progress bar

let currentUser = null;
let userData = { transactions: [] };
let referenceDate = new Date();
let activeExpensePeriod = "monthly"; // for the "All Expenses" card tabs
let headerPeriod = "monthly";        // for the top Income/Expenses summary cards
let sortDir = "desc";
let activeFilter = { type: "all", category: "all" };
let budgetAlertDismissed = false;

/* ---------------- bootstrap ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
    const session = await apiRequest("session");
    if (!session.ok) {
        window.location.href = "login.html";
        return;
    }

    currentUser = session.user;
    userData = session.data || { transactions: [] };

    const refDateInput = document.getElementById("refDate");
    refDateInput.value = toISODate(referenceDate);

    document.getElementById("cardHolder").textContent = currentUser.name;
    document.getElementById("userDropdownName").textContent = currentUser.name;
    document.getElementById("userAvatar").textContent = currentUser.name.charAt(0).toUpperCase();

    attachEventListeners();
    renderAll();
});

/* ---------------- event wiring ---------------- */

function attachEventListeners() {
    document.getElementById("refDate").addEventListener("change", (e) => {
        const val = e.target.value;
        if (val) {
            referenceDate = new Date(val + "T00:00:00");
            budgetAlertDismissed = false;
            renderAll();
        }
    });

    document.getElementById("headerPeriod").addEventListener("change", (e) => {
        headerPeriod = e.target.value;
        budgetAlertDismissed = false;
        renderSummaryCards();
    });

    document.getElementById("budgetAlertClose").addEventListener("click", () => {
        budgetAlertDismissed = true;
        document.getElementById("budgetAlert").classList.remove("show");
    });

    // user menu
    const userAvatar = document.getElementById("userAvatar");
    const userDropdown = document.getElementById("userDropdown");
    userAvatar.addEventListener("click", (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle("show");
    });
    document.addEventListener("click", () => userDropdown.classList.remove("show"));

    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("fabLogout").addEventListener("click", logout);

    // floating add button
    const fabAdd = document.getElementById("fabAdd");
    const fabMenu = document.getElementById("fabMenu");
    fabAdd.addEventListener("click", (e) => {
        e.stopPropagation();
        fabMenu.classList.toggle("show");
    });
    document.addEventListener("click", () => fabMenu.classList.remove("show"));

    fabMenu.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
            fabMenu.classList.remove("show");
            openModal(btn.dataset.type + "Modal");
        });
    });

    // modal close (X button, cancel button, backdrop click)
    document.querySelectorAll("[data-close]").forEach(el => {
        el.addEventListener("click", () => closeModal(el.dataset.close));
    });
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    // forms
    document.getElementById("incomeForm").addEventListener("submit", (e) => {
        e.preventDefault();
        addTransaction("income");
    });
    document.getElementById("expenseForm").addEventListener("submit", (e) => {
        e.preventDefault();
        addTransaction("expense");
    });
    document.getElementById("savingForm").addEventListener("submit", (e) => {
        e.preventDefault();
        addTransaction("saving");
    });

    // sort
    document.getElementById("sortBtn").addEventListener("click", () => {
        sortDir = sortDir === "desc" ? "asc" : "desc";
        renderTransactionsTable();
    });

    // filter panel
    const filterBtn = document.getElementById("filterBtn");
    const filterPanel = document.getElementById("filterPanel");
    filterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        populateFilterCategories();
        filterPanel.classList.toggle("show");
    });
    document.addEventListener("click", (e) => {
        if (!filterPanel.contains(e.target)) filterPanel.classList.remove("show");
    });

    document.getElementById("applyFilterBtn").addEventListener("click", () => {
        activeFilter.type = document.getElementById("filterType").value;
        activeFilter.category = document.getElementById("filterCategory").value;
        filterPanel.classList.remove("show");
        renderTransactionsTable();
    });

    document.getElementById("clearFilterBtn").addEventListener("click", () => {
        activeFilter = { type: "all", category: "all" };
        document.getElementById("filterType").value = "all";
        document.getElementById("filterCategory").value = "all";
        filterPanel.classList.remove("show");
        renderTransactionsTable();
    });

    // expenses breakdown period tabs
    document.querySelectorAll("#periodTabs .period-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll("#periodTabs .period-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeExpensePeriod = tab.dataset.period;
            renderAllExpensesCard();
        });
    });
}

async function logout() {
    await apiRequest("logout", { method: "POST", body: {} });
    window.location.href = "login.html";
}

/* ---------------- modals ---------------- */

function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add("show");
    const dateField = modal.querySelector('input[type="date"]');
    if (dateField && !dateField.value) dateField.value = toISODate(new Date());
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("show");
    const form = modal.querySelector("form");
    if (form) form.reset();
}

async function addTransaction(type) {
    const prefix = type;
    const amount = parseFloat(document.getElementById(prefix + "AmountInput").value);
    const category = document.getElementById(prefix + "Category").value;
    const description = document.getElementById(prefix + "Description").value.trim();
    const date = document.getElementById(prefix + "Date").value;

    if (!amount || amount <= 0 || !category || !date) return;

    const result = await apiRequest("add_transaction", {
        method: "POST",
        body: { type, amount, category, description: description || category, date }
    });
    if (!result.ok) {
        showToast(result.error || "Could not save transaction");
        return;
    }
    userData = result.data;
    closeModal(prefix + "Modal");
    showToast((type === "income" ? "Income" : type === "expense" ? "Expense" : "Savings") + " added successfully");
    budgetAlertDismissed = false;
    renderAll();
}

async function deleteTransaction(id) {
    const result = await apiRequest("delete_transaction", {
        method: "POST",
        body: { id: Number(id) }
    });
    if (!result.ok) {
        showToast(result.error || "Could not delete transaction");
        return;
    }
    userData = result.data;
    budgetAlertDismissed = false;
    renderAll();
    showToast("Transaction deleted");
}

/* ---------------- rendering ---------------- */

function renderAll() {
    renderGreeting();
    renderSummaryCards();
    renderCardSection();
    renderChart();
    renderAllExpensesCard();
    renderTransactionsTable();
}

function renderGreeting() {
    const hour = new Date().getHours();
    let greeting = "Good Morning";
    if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
    else if (hour >= 17) greeting = "Good Evening";
    document.getElementById("greeting").textContent = greeting + ", " + currentUser.name.split(" ")[0] + "!";
}

function renderSummaryCards() {
    const { start, end } = getPeriodRange(headerPeriod, referenceDate);
    const { start: prevStart, end: prevEnd } = getPreviousPeriodRange(headerPeriod, referenceDate);

    const income = sumTransactions(userData.transactions, "income", start, end);
    const expense = sumTransactions(userData.transactions, "expense", start, end);
    const savings = sumTransactions(userData.transactions, "saving", start, end);
    const prevIncome = sumTransactions(userData.transactions, "income", prevStart, prevEnd);
    const prevExpense = sumTransactions(userData.transactions, "expense", prevStart, prevEnd);
    const prevSavings = sumTransactions(userData.transactions, "saving", prevStart, prevEnd);

    document.getElementById("incomeAmount").textContent = formatCurrency(income);
    document.getElementById("expenseAmount").textContent = formatCurrency(expense);
    document.getElementById("savingsAmount").textContent = formatCurrency(savings);

    setChangeIndicator("incomeChange", income, prevIncome, headerPeriod);
    setChangeIndicator("expenseChange", expense, prevExpense, headerPeriod);
    setChangeIndicator("savingsChange", savings, prevSavings, headerPeriod);

    checkBudgetAlert(income, expense, headerPeriod);
}

/* ---------------- budget alert ---------------- */

function checkBudgetAlert(income, expense, period) {
    const banner = document.getElementById("budgetAlert");
    const text = document.getElementById("budgetAlertText");
    const over = expense - income;

    if (over > 0) {
        text.textContent =
            "Your " + period + " expenses (" + formatCurrency(expense) + ") have exceeded your " +
            period + " income (" + formatCurrency(income) + ") by " + formatCurrency(over) + ".";

        if (!budgetAlertDismissed) {
            banner.classList.add("show");
        }
    } else {
        banner.classList.remove("show");
        budgetAlertDismissed = false; // reset so it can show again next time it's exceeded
    }
}

function setChangeIndicator(elId, current, previous, period) {
    const el = document.getElementById(elId);
    const span = el.querySelector("span");
    const label = period.charAt(0).toUpperCase() + period.slice(1);

    if (previous === 0) {
        el.style.color = "#10b981";
        span.textContent = current > 0 ? ("New this period vs last " + label.toLowerCase()) : ("vs Last " + label.toLowerCase());
        return;
    }

    const pct = ((current - previous) / previous) * 100;
    const up = pct >= 0;
    el.style.color = up ? "#10b981" : "#dc2626";
    span.textContent = Math.abs(pct).toFixed(0) + "% vs last " + label.toLowerCase();
}

function renderCardSection() {
    const { start, end } = getPeriodRange("monthly", referenceDate);
    const used = sumTransactions(userData.transactions, "expense", start, end);
    const pct = Math.min(100, (used / CREDIT_LIMIT) * 100);

    document.getElementById("spendingLimitText").textContent = formatCurrency(used);
    document.getElementById("spendingUsedText").textContent = "used from " + formatCurrency(CREDIT_LIMIT);
    document.getElementById("progressFill").style.width = pct.toFixed(1) + "%";
}

function renderChart() {
    const container = document.getElementById("chartContainer");
    const labelsEl = document.getElementById("chartLabels");
    container.innerHTML = "";
    labelsEl.innerHTML = "";

    const year = referenceDate.getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    document.getElementById("chartYearLabel").textContent = String(year);

    const monthlyData = monthNames.map((_, m) => {
        const start = new Date(year, m, 1);
        const end = new Date(year, m + 1, 1);
        return {
            income: sumTransactions(userData.transactions, "income", start, end),
            expense: sumTransactions(userData.transactions, "expense", start, end)
        };
    });

    const maxVal = Math.max(1, ...monthlyData.map(d => Math.max(d.income, d.expense)));
    const maxBarHeight = 220;
    const currentMonthIndex = referenceDate.getMonth();

    monthNames.forEach((name, i) => {
        const d = monthlyData[i];
        const barHeight = Math.max(6, (Math.max(d.income, d.expense) / maxVal) * maxBarHeight);
        const isActive = i === currentMonthIndex;

        const bar = document.createElement("div");
        bar.className = "chart-bar" + (isActive ? " active" : "");
        bar.style.height = barHeight + "px";
        bar.setAttribute("role", "img");
        bar.setAttribute("aria-label", name + " " + year + ": income " +
            formatCurrency(d.income) + ", expenses " + formatCurrency(d.expense));

        const tooltip = document.createElement("div");
        tooltip.className = "chart-tooltip";
        tooltip.innerHTML =
            '<div style="font-weight:600;">' + name + " " + year + '</div>' +
            '<div style="color:#10b981;">Income: ' + formatCurrency(d.income) + '</div>' +
            '<div style="color:#ea580c;">Expenses: ' + formatCurrency(d.expense) + '</div>';
        bar.appendChild(tooltip);

        const incomeBar = document.createElement("div");
        incomeBar.className = "chart-bar-income";
        incomeBar.style.height = (d.income ? Math.max(3, (d.income / maxVal) * barHeight) : 0) + "px";

        const expenseBar = document.createElement("div");
        expenseBar.className = "chart-bar-expense";
        expenseBar.style.height = (d.expense ? Math.max(3, (d.expense / maxVal) * barHeight) : 0) + "px";

        bar.appendChild(incomeBar);
        bar.appendChild(expenseBar);

        container.appendChild(bar);

        const label = document.createElement("span");
        label.textContent = name;
        labelsEl.appendChild(label);
    });
}

function renderAllExpensesCard() {
    const expenses = userData.transactions.filter(t => t.type === "expense");
    const totalAllTime = expenses.reduce((s, t) => s + t.amount, 0);
    document.getElementById("allExpensesTotal").textContent = formatCurrency(totalAllTime);

    const dayRange = getPeriodRange("daily", referenceDate);
    const weekRange = getPeriodRange("weekly", referenceDate);
    const monthRange = getPeriodRange("monthly", referenceDate);

    document.getElementById("dailyValue").textContent = formatCurrency(sumTransactions(userData.transactions, "expense", dayRange.start, dayRange.end));
    document.getElementById("weeklyValue").textContent = formatCurrency(sumTransactions(userData.transactions, "expense", weekRange.start, weekRange.end));
    document.getElementById("monthlyValue").textContent = formatCurrency(sumTransactions(userData.transactions, "expense", monthRange.start, monthRange.end));

    // category breakdown for the currently active tab period
    const range = getPeriodRange(activeExpensePeriod, referenceDate);
    const periodExpenses = expenses.filter(t => inRange(t.date, range.start, range.end));
    const byCategory = {};
    periodExpenses.forEach(t => {
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });

    const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const list = document.getElementById("categoryList");
    list.innerHTML = "";

    if (categories.length === 0) {
        list.innerHTML = '<li class="expense-category" style="color:#9ca3af;">No expenses in this period</li>';
        return;
    }

    categories.forEach(([cat, amount]) => {
        const li = document.createElement("li");
        li.className = "expense-category";
        li.innerHTML =
            '<div class="category-info">' +
                '<span>' + escapeHtml(cat) + '</span>' +
            '</div>' +
            '<span>' + formatCurrency(amount) + '</span>';
        list.appendChild(li);
    });
}

function renderTransactionsTable() {
    const tbody = document.getElementById("transactionsBody");
    const emptyState = document.getElementById("emptyState");
    tbody.innerHTML = "";

    let list = userData.transactions.slice();

    if (activeFilter.type !== "all") {
        list = list.filter(t => t.type === activeFilter.type);
    }
    if (activeFilter.category !== "all") {
        list = list.filter(t => t.category === activeFilter.category);
    }

    list.sort((a, b) => {
        const diff = new Date(a.date) - new Date(b.date);
        return sortDir === "asc" ? diff : -diff;
    });

    document.getElementById("sortBtn").textContent =
        sortDir === "asc" ? "Sort: Oldest first" : "Sort: Newest first";

    if (list.length === 0) {
        emptyState.style.display = "block";
        document.querySelector(".transactions-table").style.display = "none";
        return;
    }
    emptyState.style.display = "none";
    document.querySelector(".transactions-table").style.display = "table";

    list.forEach(t => {
        const tr = document.createElement("tr");
        const amountColor = t.type === "income" ? "#059669" : t.type === "saving" ? "#7c3aed" : "#dc2626";

        tr.innerHTML =
            "<td>" + formatDate(t.date) + "</td>" +
            "<td>" + escapeHtml(t.category) + "</td>" +
            '<td style="color:' + amountColor + '; font-weight:600;">' + formatCurrency(t.amount) + "</td>" +
            '<td><span class="status-success">Success</span></td>' +
            '<td><button class="action-btn delete-btn" data-id="' + t.id + '">Delete</button></td>';
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteTransaction(btn.dataset.id));
    });
}

function populateFilterCategories() {
    const select = document.getElementById("filterCategory");
    const current = select.value;
    const categories = [...new Set(userData.transactions.map(t => t.category))].sort();
    select.innerHTML = '<option value="all">All</option>' +
        categories.map(c => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>').join("");
    select.value = categories.includes(current) ? current : "all";
}

/* ---------------- date / period helpers ---------------- */

function toISODate(d) {
    return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function inRange(iso, start, end) {
    const d = new Date(iso + "T00:00:00");
    return d >= start && d < end;
}

function sumTransactions(transactions, type, start, end) {
    return transactions
        .filter(t => t.type === type && inRange(t.date, start, end))
        .reduce((s, t) => s + t.amount, 0);
}

function getPeriodRange(period, refDate) {
    const d = new Date(refDate);
    if (period === "daily") {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        return { start, end };
    }
    if (period === "weekly") {
        const day = d.getDay(); // 0 = Sunday
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 7);
        return { start, end };
    }
    // monthly
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { start, end };
}

function getPreviousPeriodRange(period, refDate) {
    const d = new Date(refDate);
    if (period === "daily") {
        const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
        return getPeriodRange("daily", prev);
    }
    if (period === "weekly") {
        const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
        return getPeriodRange("weekly", prev);
    }
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return getPeriodRange("monthly", prev);
}

/* ---------------- misc helpers ---------------- */

function formatCurrency(num) {
    return "\u09F3" + Number(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

let toastTimeout;
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2500);
}
