"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "summary" | "income" | "expenses" | "charts";
type IncomeCategory = "Salario" | "Extras" | "Ahorros";

type Income = {
  id: string;
  category: IncomeCategory;
  description: string;
  amount: number;
  date: string;
};

type Expense = {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
};

type MonthData = {
  incomes: Income[];
  expenses: Expense[];
};

type StoredBudget = Record<string, MonthData>;

type ChartItem = {
  category: string;
  amount: number;
  percentage: number;
};

const STORAGE_KEY = "track-my-spend-months";

const incomeCategories: IncomeCategory[] = ["Salario", "Extras", "Ahorros"];
const expenseCategories = ["Comida", "Transporte", "Casa", "Salud", "Ocio", "Otro"];

const emptyMonth: MonthData = {
  incomes: [],
  expenses: []
};

const currencyFormatter = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const monthFormatter = new Intl.DateTimeFormat("es-PA", {
  month: "long",
  year: "numeric"
});

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatMonth(monthKey: string) {
  if (!monthKey) {
    return formatMonth(getCurrentMonthKey());
  }

  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return monthFormatter.format(date);
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-PA");
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getChartData(records: Array<{ category: string; amount: number }>): ChartItem[] {
  const totals = records.reduce<Record<string, number>>((result, record) => {
    result[record.category] = (result[record.category] || 0) + record.amount;
    return result;
  }, {});

  const grandTotal = Object.values(totals).reduce((total, amount) => total + amount, 0);

  return Object.entries(totals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: grandTotal > 0 ? (amount / grandTotal) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

function StatCard({
  label,
  value,
  tone = "light"
}: {
  label: string;
  value: string;
  tone?: "light" | "dark" | "green";
}) {
  const toneClass =
    tone === "dark"
      ? "bg-ink text-white"
      : tone === "green"
        ? "bg-leaf text-white"
        : "bg-white text-ink";

  return (
    <article className={`rounded-2xl p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold">{value}</p>
    </article>
  );
}

function ChartList({ title, data }: { title: string; data: ChartItem[] }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-ink">{title}</h2>

      {data.length === 0 ? (
        <p className="mt-4 rounded-xl bg-mint p-4 text-sm leading-6 text-ink/70">
          No hay datos suficientes para mostrar esta gráfica.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {data.map((item) => (
            <li key={item.category}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-semibold text-ink">{item.category}</p>
                <p className="text-right text-sm font-bold text-ink">
                  {item.percentage.toFixed(0)}% · {formatCurrency(item.amount)}
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-mint">
                <div
                  className="h-full rounded-full bg-leaf"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Home() {
  const [selectedTab, setSelectedTab] = useState<Tab>("summary");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [storedBudget, setStoredBudget] = useState<StoredBudget>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>("Salario");
  const [incomeDescription, setIncomeDescription] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(getTodayKey);

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState(expenseCategories[0]);
  const [expenseDate, setExpenseDate] = useState(getTodayKey);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }

    const savedData = window.localStorage.getItem(STORAGE_KEY);

    if (savedData) {
      try {
        setStoredBudget(JSON.parse(savedData) as StoredBudget);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedBudget));
    }
  }, [storedBudget, isLoaded]);

  const monthData = storedBudget[selectedMonth] || emptyMonth;

  const totalIncome = useMemo(
    () => monthData.incomes.reduce((total, income) => total + income.amount, 0),
    [monthData.incomes]
  );

  const totalSpent = useMemo(
    () => monthData.expenses.reduce((total, expense) => total + expense.amount, 0),
    [monthData.expenses]
  );

  const remainingBalance = totalIncome - totalSpent;
  const usedPercentage = totalIncome > 0 ? Math.min((totalSpent / totalIncome) * 100, 100) : 0;

  const incomeChartData = useMemo(() => getChartData(monthData.incomes), [monthData.incomes]);
  const expenseChartData = useMemo(() => getChartData(monthData.expenses), [monthData.expenses]);

  function updateCurrentMonth(nextData: MonthData) {
    setStoredBudget((current) => ({
      ...current,
      [selectedMonth]: nextData
    }));
  }

  function addIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(incomeAmount);

    if (amount <= 0) {
      return;
    }

    const newIncome: Income = {
      id: createId(),
      category: incomeCategory,
      description: incomeDescription.trim(),
      amount,
      date: incomeDate || getTodayKey()
    };

    updateCurrentMonth({
      ...monthData,
      incomes: [newIncome, ...monthData.incomes]
    });

    setIncomeCategory("Salario");
    setIncomeDescription("");
    setIncomeAmount("");
    setIncomeDate(getTodayKey());
  }

  function deleteIncome(id: string) {
    updateCurrentMonth({
      ...monthData,
      incomes: monthData.incomes.filter((income) => income.id !== id)
    });
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(expenseAmount);

    if (!expenseName.trim() || amount <= 0) {
      return;
    }

    const newExpense: Expense = {
      id: createId(),
      name: expenseName.trim(),
      amount,
      category: expenseCategory,
      date: expenseDate || getTodayKey()
    };

    updateCurrentMonth({
      ...monthData,
      expenses: [newExpense, ...monthData.expenses]
    });

    setExpenseName("");
    setExpenseAmount("");
    setExpenseCategory(expenseCategories[0]);
    setExpenseDate(getTodayKey());
  }

  function deleteExpense(id: string) {
    updateCurrentMonth({
      ...monthData,
      expenses: monthData.expenses.filter((expense) => expense.id !== id)
    });
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "summary", label: "Resumen" },
    { id: "income", label: "Ingresos" },
    { id: "expenses", label: "Egresos" },
    { id: "charts", label: "Gráficas" }
  ];

  return (
    <main className="min-h-screen bg-paper px-4 pb-28 pt-5">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="rounded-3xl bg-ink p-5 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-mint">
            Track My Spend
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <h1 className="text-3xl font-bold">Tu mes financiero</h1>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Controla ingresos, egresos y saldo por cada mes.
              </p>
            </div>
            <label className="text-sm font-semibold text-white" htmlFor="month">
              Mes
            </label>
            <input
              id="month"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonthKey())}
              className="w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-base font-bold text-ink outline-none focus:border-mint"
            />
            <p className="text-sm font-semibold capitalize text-mint">
              {formatMonth(selectedMonth)}
            </p>
          </div>
        </header>

        {selectedTab === "summary" && (
          <>
            <section className="grid grid-cols-2 gap-3">
              <StatCard label="Ingresos" value={formatCurrency(totalIncome)} tone="green" />
              <StatCard label="Egresos" value={formatCurrency(totalSpent)} tone="dark" />
              <StatCard label="Saldo" value={formatCurrency(remainingBalance)} />
              <StatCard label="Usado" value={`${usedPercentage.toFixed(0)}%`} />
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">Presupuesto usado</p>
                <p className="text-sm font-bold text-leaf">{usedPercentage.toFixed(0)}%</p>
              </div>
              <div className="mt-3 h-4 overflow-hidden rounded-full bg-mint">
                <div
                  className="h-full rounded-full bg-coral transition-all"
                  style={{ width: `${usedPercentage}%` }}
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-ink">Movimiento del mes</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTab("income")}
                  className="rounded-2xl bg-leaf px-4 py-3 font-bold text-white"
                >
                  Agregar ingreso
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTab("expenses")}
                  className="rounded-2xl bg-ink px-4 py-3 font-bold text-white"
                >
                  Agregar egreso
                </button>
              </div>
            </section>
          </>
        )}

        {selectedTab === "income" && (
          <>
            <form onSubmit={addIncome} className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-ink">Nuevo ingreso</h2>

              <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="income-category">
                Categoría
              </label>
              <select
                id="income-category"
                value={incomeCategory}
                onChange={(event) => setIncomeCategory(event.target.value as IncomeCategory)}
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-base outline-none focus:border-leaf"
              >
                {incomeCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <label
                className="mt-4 block text-sm font-semibold text-ink"
                htmlFor="income-description"
              >
                Descripción opcional
              </label>
              <input
                id="income-description"
                value={incomeDescription}
                onChange={(event) => setIncomeDescription(event.target.value)}
                placeholder="Ej: Pago principal"
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-base outline-none focus:border-leaf"
              />

              <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="income-amount">
                Monto
              </label>
              <input
                id="income-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={incomeAmount}
                onChange={(event) => setIncomeAmount(event.target.value)}
                placeholder="Ej: 1250.75"
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-base outline-none focus:border-leaf"
              />

              <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="income-date">
                Fecha
              </label>
              <input
                id="income-date"
                type="date"
                value={incomeDate}
                onChange={(event) => setIncomeDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-base outline-none focus:border-leaf"
              />

              <button
                type="submit"
                className="mt-5 w-full rounded-2xl bg-leaf px-4 py-3 text-base font-bold text-white transition hover:bg-ink"
              >
                Guardar ingreso
              </button>
            </form>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">Ingresos</h2>
                <p className="text-sm text-ink/60">{monthData.incomes.length} registros</p>
              </div>

              {monthData.incomes.length === 0 ? (
                <p className="mt-4 rounded-xl bg-mint p-4 text-sm leading-6 text-ink/70">
                  Agrega tus ingresos para calcular automáticamente el presupuesto del mes.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {monthData.incomes.map((income) => (
                    <li
                      key={income.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-paper p-3"
                    >
                      <div>
                        <p className="font-semibold text-ink">{income.category}</p>
                        <p className="mt-1 text-xs text-ink/60">
                          {income.description || "Sin descripción"} ·{" "}
                          {formatDate(income.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-leaf">{formatCurrency(income.amount)}</p>
                        <button
                          type="button"
                          onClick={() => deleteIncome(income.id)}
                          className="mt-1 text-xs font-semibold text-coral"
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {selectedTab === "expenses" && (
          <>
            <form onSubmit={addExpense} className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-ink">Nuevo egreso</h2>

              <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="expense-name">
                Nombre
              </label>
              <input
                id="expense-name"
                value={expenseName}
                onChange={(event) => setExpenseName(event.target.value)}
                placeholder="Ej: Mercado"
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-base outline-none focus:border-leaf"
              />

              <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="expense-amount">
                Monto
              </label>
              <input
                id="expense-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="Ej: 85.50"
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-base outline-none focus:border-leaf"
              />

              <label
                className="mt-4 block text-sm font-semibold text-ink"
                htmlFor="expense-category"
              >
                Categoría
              </label>
              <select
                id="expense-category"
                value={expenseCategory}
                onChange={(event) => setExpenseCategory(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-base outline-none focus:border-leaf"
              >
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="expense-date">
                Fecha
              </label>
              <input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-base outline-none focus:border-leaf"
              />

              <button
                type="submit"
                className="mt-5 w-full rounded-2xl bg-ink px-4 py-3 text-base font-bold text-white transition hover:bg-leaf"
              >
                Guardar egreso
              </button>
            </form>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">Egresos</h2>
                <p className="text-sm text-ink/60">{monthData.expenses.length} registros</p>
              </div>

              {monthData.expenses.length === 0 ? (
                <p className="mt-4 rounded-xl bg-mint p-4 text-sm leading-6 text-ink/70">
                  Todavía no hay egresos para este mes.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {monthData.expenses.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-paper p-3"
                    >
                      <div>
                        <p className="font-semibold text-ink">{expense.name}</p>
                        <p className="mt-1 text-xs text-ink/60">
                          {expense.category} ·{" "}
                          {formatDate(expense.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-ink">{formatCurrency(expense.amount)}</p>
                        <button
                          type="button"
                          onClick={() => deleteExpense(expense.id)}
                          className="mt-1 text-xs font-semibold text-coral"
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {selectedTab === "charts" && (
          <>
            <ChartList title="Egresos por categoría" data={expenseChartData} />
            <ChartList title="Ingresos por categoría" data={incomeChartData} />
          </>
        )}
      </section>

      <nav className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-white/95 px-3 py-3 shadow-lg backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTab(tab.id)}
              className={`rounded-2xl px-2 py-3 text-xs font-bold transition ${
                selectedTab === tab.id
                  ? "bg-leaf text-white"
                  : "bg-paper text-ink/70 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
