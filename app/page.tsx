"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Tab = "summary" | "income" | "expenses" | "charts";
type ModalType =
  | "none"
  | "menu"
  | "income"
  | "expense"
  | "categories"
  | "editIncome"
  | "editExpense";
type CategoryType = "income" | "expense";

type Income = {
  id: string;
  category: string;
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

type CategoryConfig = {
  income: string[];
  expense: string[];
};

type ChartItem = {
  category: string;
  amount: number;
  percentage: number;
};

type ChartDetail = {
  type: CategoryType;
  category: string;
} | null;

const STORAGE_KEY = "track-my-spend-months";
const CATEGORY_STORAGE_KEY = "track-my-spend-categories";

const defaultIncomeCategories = ["Salario", "Extras", "Ahorros"];
const defaultExpenseCategories = ["Comida", "Transporte", "Casa", "Salud", "Ocio", "Otros"];

const fallbackCategories = {
  income: "Extras",
  expense: "Otros"
};

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
  return monthFormatter.format(new Date(year, month - 1, 1));
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

function normalizeCategoryName(value: string) {
  return value.trim();
}

function hasCategory(categories: string[], name: string) {
  const normalizedName = normalizeCategoryName(name).toLowerCase();
  return categories.some((category) => category.toLowerCase() === normalizedName);
}

function mergeCategories(...groups: string[][]) {
  return groups.flat().reduce<string[]>((result, category) => {
    const normalizedCategory = normalizeCategoryName(category);

    if (normalizedCategory && !hasCategory(result, normalizedCategory)) {
      result.push(normalizedCategory);
    }

    return result;
  }, []);
}

function getCategoriesFromBudget(storedBudget: StoredBudget): CategoryConfig {
  const income = Object.values(storedBudget).flatMap((month) =>
    month.incomes.map((incomeItem) => incomeItem.category)
  );
  const expense = Object.values(storedBudget).flatMap((month) =>
    month.expenses.map((expenseItem) => expenseItem.category)
  );

  return { income, expense };
}

function normalizeCategoryConfig(config: Partial<CategoryConfig>, storedBudget: StoredBudget) {
  const historyCategories = getCategoriesFromBudget(storedBudget);

  return {
    income: mergeCategories(defaultIncomeCategories, config.income || [], historyCategories.income),
    expense: mergeCategories(
      defaultExpenseCategories,
      config.expense || [],
      historyCategories.expense
    )
  };
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

function Card({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[28px] border border-ink/5 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "income" | "expense";
}) {
  const toneClass =
    tone === "income"
      ? "border-leaf/10 bg-mint text-leaf"
      : "border-coral/10 bg-coral/10 text-coral";

  return (
    <article className={`rounded-[24px] border p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 break-words text-xl font-black">{value}</p>
    </article>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[22px] bg-paper p-4 text-sm leading-6 text-ink/60">{children}</p>
  );
}

function Modal({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/35 px-3 pb-3 backdrop-blur-sm">
      <section className="mx-auto w-full max-w-md rounded-[32px] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full bg-paper text-xl font-black text-ink"
            aria-label="Cerrar modal"
          >
            x
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ChartList({
  title,
  data,
  accent = "green",
  onSelectCategory
}: {
  title: string;
  data: ChartItem[];
  accent?: "green" | "coral";
  onSelectCategory: (category: string) => void;
}) {
  const barClass = accent === "green" ? "bg-leaf" : "bg-coral";

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-ink">{title}</h2>
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-ink/60">
          {data.length}
        </span>
      </div>

      {data.length === 0 ? (
        <div className="mt-4">
          <EmptyState>No hay datos suficientes para mostrar esta grafica.</EmptyState>
        </div>
      ) : (
        <ul className="mt-5 space-y-5">
          {data.map((item) => (
            <li key={item.category}>
              <button
                type="button"
                onClick={() => onSelectCategory(item.category)}
                className="w-full rounded-[22px] p-2 text-left transition hover:bg-paper"
              >
                <div className="mb-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{item.category}</p>
                    <p className="mt-1 text-xs font-semibold text-ink/50">
                      {item.percentage.toFixed(0)}% del total
                    </p>
                  </div>
                  <p className="text-sm font-black text-ink">{formatCurrency(item.amount)}</p>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-paper">
                  <div
                    className={`h-full rounded-full ${barClass}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Home() {
  const [selectedTab, setSelectedTab] = useState<Tab>("summary");
  const [activeModal, setActiveModal] = useState<ModalType>("none");
  const [chartDetail, setChartDetail] = useState<ChartDetail>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [storedBudget, setStoredBudget] = useState<StoredBudget>({});
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig>({
    income: defaultIncomeCategories,
    expense: defaultExpenseCategories
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [canPersistBudget, setCanPersistBudget] = useState(true);
  const [canPersistCategories, setCanPersistCategories] = useState(true);

  const [incomeCategory, setIncomeCategory] = useState("Salario");
  const [incomeDescription, setIncomeDescription] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(getTodayKey);

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState(defaultExpenseCategories[0]);
  const [expenseDate, setExpenseDate] = useState(getTodayKey);
  const [editingIncomeId, setEditingIncomeId] = useState("");
  const [editIncomeCategory, setEditIncomeCategory] = useState("Salario");
  const [editIncomeDescription, setEditIncomeDescription] = useState("");
  const [editIncomeAmount, setEditIncomeAmount] = useState("");
  const [editIncomeDate, setEditIncomeDate] = useState(getTodayKey);
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [editExpenseName, setEditExpenseName] = useState("");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseCategory, setEditExpenseCategory] = useState(defaultExpenseCategories[0]);
  const [editExpenseDate, setEditExpenseDate] = useState(getTodayKey);
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<{
    type: CategoryType;
    name: string;
  } | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }

    const savedData = window.localStorage.getItem(STORAGE_KEY);
    const savedCategories = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    let loadedBudget: StoredBudget = {};
    let loadedCategories: Partial<CategoryConfig> = {};

    if (savedData) {
      try {
        loadedBudget = JSON.parse(savedData) as StoredBudget;
      } catch {
        setCanPersistBudget(false);
      }
    }

    if (savedCategories) {
      try {
        loadedCategories = JSON.parse(savedCategories) as Partial<CategoryConfig>;
      } catch {
        setCanPersistCategories(false);
      }
    }

    setStoredBudget(loadedBudget);
    setCategoryConfig(normalizeCategoryConfig(loadedCategories, loadedBudget));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded && canPersistBudget) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedBudget));
    }
  }, [storedBudget, isLoaded, canPersistBudget]);

  useEffect(() => {
    if (isLoaded && canPersistCategories) {
      window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categoryConfig));
    }
  }, [categoryConfig, isLoaded, canPersistCategories]);

  useEffect(() => {
    if (!hasCategory(categoryConfig.income, incomeCategory)) {
      setIncomeCategory(categoryConfig.income[0] || fallbackCategories.income);
    }

    if (!hasCategory(categoryConfig.expense, expenseCategory)) {
      setExpenseCategory(categoryConfig.expense[0] || fallbackCategories.expense);
    }
  }, [categoryConfig, expenseCategory, incomeCategory]);

  useEffect(() => {
    document.body.style.overflow = activeModal === "none" && !chartDetail ? "" : "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [activeModal, chartDetail]);

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
  const topCategories = expenseChartData.slice(0, 3);
  const chartDetailRecords = useMemo(() => {
    if (!chartDetail) {
      return [];
    }

    const records = chartDetail.type === "income" ? monthData.incomes : monthData.expenses;

    return records.filter(
      (record) => record.category.toLowerCase() === chartDetail.category.toLowerCase()
    );
  }, [chartDetail, monthData.expenses, monthData.incomes]);
  const chartDetailTotal = chartDetailRecords.reduce((total, record) => total + record.amount, 0);
  const chartDetailBaseTotal =
    chartDetail?.type === "income" ? totalIncome : chartDetail?.type === "expense" ? totalSpent : 0;
  const chartDetailPercentage =
    chartDetailBaseTotal > 0 ? (chartDetailTotal / chartDetailBaseTotal) * 100 : 0;

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

    setIncomeCategory(categoryConfig.income[0] || fallbackCategories.income);
    setIncomeDescription("");
    setIncomeAmount("");
    setIncomeDate(getTodayKey());
    setSelectedTab("income");
    setActiveModal("none");
  }

  function deleteIncome(id: string) {
    updateCurrentMonth({
      ...monthData,
      incomes: monthData.incomes.filter((income) => income.id !== id)
    });
  }

  function openEditIncome(income: Income) {
    setChartDetail(null);
    setEditingIncomeId(income.id);
    setEditIncomeCategory(income.category);
    setEditIncomeDescription(income.description);
    setEditIncomeAmount(String(income.amount));
    setEditIncomeDate(income.date);
    setActiveModal("editIncome");
  }

  function saveEditedIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(editIncomeAmount);

    if (!editingIncomeId || amount <= 0) {
      return;
    }

    updateCurrentMonth({
      ...monthData,
      incomes: monthData.incomes.map((income) =>
        income.id === editingIncomeId
          ? {
              ...income,
              category: editIncomeCategory,
              description: editIncomeDescription.trim(),
              amount,
              date: editIncomeDate || getTodayKey()
            }
          : income
      )
    });

    setEditingIncomeId("");
    setEditIncomeCategory(categoryConfig.income[0] || fallbackCategories.income);
    setEditIncomeDescription("");
    setEditIncomeAmount("");
    setEditIncomeDate(getTodayKey());
    setActiveModal("none");
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
    setExpenseCategory(categoryConfig.expense[0] || fallbackCategories.expense);
    setExpenseDate(getTodayKey());
    setSelectedTab("expenses");
    setActiveModal("none");
  }

  function deleteExpense(id: string) {
    updateCurrentMonth({
      ...monthData,
      expenses: monthData.expenses.filter((expense) => expense.id !== id)
    });
  }

  function openEditExpense(expense: Expense) {
    setChartDetail(null);
    setEditingExpenseId(expense.id);
    setEditExpenseName(expense.name);
    setEditExpenseAmount(String(expense.amount));
    setEditExpenseCategory(expense.category);
    setEditExpenseDate(expense.date);
    setActiveModal("editExpense");
  }

  function saveEditedExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(editExpenseAmount);

    if (!editingExpenseId || !editExpenseName.trim() || amount <= 0) {
      return;
    }

    updateCurrentMonth({
      ...monthData,
      expenses: monthData.expenses.map((expense) =>
        expense.id === editingExpenseId
          ? {
              ...expense,
              name: editExpenseName.trim(),
              amount,
              category: editExpenseCategory,
              date: editExpenseDate || getTodayKey()
            }
          : expense
      )
    });

    setEditingExpenseId("");
    setEditExpenseName("");
    setEditExpenseAmount("");
    setEditExpenseCategory(categoryConfig.expense[0] || fallbackCategories.expense);
    setEditExpenseDate(getTodayKey());
    setActiveModal("none");
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = normalizeCategoryName(newCategoryName);

    if (!normalizedName) {
      setCategoryMessage("El nombre no puede estar vacio.");
      return;
    }

    if (hasCategory(categoryConfig[newCategoryType], normalizedName)) {
      setCategoryMessage("Esa categoria ya existe.");
      return;
    }

    setCategoryConfig((current) => ({
      ...current,
      [newCategoryType]: [...current[newCategoryType], normalizedName]
    }));
    setNewCategoryName("");
    setCategoryMessage("Categoria agregada.");
  }

  function startEditingCategory(type: CategoryType, name: string) {
    setEditingCategory({ type, name });
    setEditingCategoryName(name);
    setCategoryMessage("");
  }

  function saveEditedCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCategory) {
      return;
    }

    const normalizedName = normalizeCategoryName(editingCategoryName);

    if (!normalizedName) {
      setCategoryMessage("El nombre no puede estar vacio.");
      return;
    }

    const categoryList = categoryConfig[editingCategory.type];
    const duplicateExists = categoryList.some(
      (category) =>
        category.toLowerCase() !== editingCategory.name.toLowerCase() &&
        category.toLowerCase() === normalizedName.toLowerCase()
    );

    if (duplicateExists) {
      setCategoryMessage("Esa categoria ya existe.");
      return;
    }

    setCategoryConfig((current) => ({
      ...current,
      [editingCategory.type]: current[editingCategory.type].map((category) =>
        category.toLowerCase() === editingCategory.name.toLowerCase() ? normalizedName : category
      )
    }));

    setStoredBudget((current) => {
      const nextBudget: StoredBudget = {};

      Object.entries(current).forEach(([monthKey, data]) => {
        nextBudget[monthKey] = {
          incomes:
            editingCategory.type === "income"
              ? data.incomes.map((income) => ({
                  ...income,
                  category:
                    income.category.toLowerCase() === editingCategory.name.toLowerCase()
                      ? normalizedName
                      : income.category
                }))
              : data.incomes,
          expenses:
            editingCategory.type === "expense"
              ? data.expenses.map((expense) => ({
                  ...expense,
                  category:
                    expense.category.toLowerCase() === editingCategory.name.toLowerCase()
                      ? normalizedName
                      : expense.category
                }))
              : data.expenses
        };
      });

      return nextBudget;
    });

    if (
      editingCategory.type === "income" &&
      incomeCategory.toLowerCase() === editingCategory.name.toLowerCase()
    ) {
      setIncomeCategory(normalizedName);
    }

    if (
      editingCategory.type === "expense" &&
      expenseCategory.toLowerCase() === editingCategory.name.toLowerCase()
    ) {
      setExpenseCategory(normalizedName);
    }

    setEditingCategory(null);
    setEditingCategoryName("");
    setCategoryMessage("Categoria actualizada.");
  }

  function deleteCategory(type: CategoryType, name: string) {
    const fallback = fallbackCategories[type];

    setCategoryConfig((current) => ({
      ...current,
      [type]: mergeCategories(
        current[type].filter((category) => category.toLowerCase() !== name.toLowerCase()),
        [fallback]
      )
    }));

    setStoredBudget((current) => {
      const nextBudget: StoredBudget = {};

      Object.entries(current).forEach(([monthKey, data]) => {
        nextBudget[monthKey] = {
          incomes:
            type === "income"
              ? data.incomes.map((income) => ({
                  ...income,
                  category:
                    income.category.toLowerCase() === name.toLowerCase() ? fallback : income.category
                }))
              : data.incomes,
          expenses:
            type === "expense"
              ? data.expenses.map((expense) => ({
                  ...expense,
                  category:
                    expense.category.toLowerCase() === name.toLowerCase()
                      ? fallback
                      : expense.category
                }))
              : data.expenses
        };
      });

      return nextBudget;
    });

    if (type === "income" && incomeCategory.toLowerCase() === name.toLowerCase()) {
      setIncomeCategory(fallback);
    }

    if (type === "expense" && expenseCategory.toLowerCase() === name.toLowerCase()) {
      setExpenseCategory(fallback);
    }

    setEditingCategory(null);
    setCategoryMessage(`Movimientos reasignados a ${fallback}.`);
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "summary", label: "Inicio" },
    { id: "income", label: "Ingresos" },
    { id: "expenses", label: "Gastos" },
    { id: "charts", label: "Graficas" }
  ];

  return (
    <main className="min-h-screen bg-paper px-4 pb-32 pt-4">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="rounded-[32px] bg-leaf p-5 text-white shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white/70">Track My Spend</p>
              <h1 className="mt-1 text-3xl font-black">Inicio</h1>
            </div>
            <label className="rounded-2xl bg-white/15 px-3 py-2" htmlFor="month">
              <span className="block text-xs font-bold text-white/70">Mes</span>
              <input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonthKey())}
                className="w-[8.5rem] bg-transparent text-sm font-black text-white outline-none"
              />
            </label>
          </div>

          <div className="mt-8">
            <p className="text-sm font-bold text-white/70">Saldo disponible</p>
            <p className="mt-2 break-words text-5xl font-black leading-tight">
              {formatCurrency(remainingBalance)}
            </p>
            <p className="mt-2 text-sm font-bold capitalize text-white/70">
              {formatMonth(selectedMonth)}
            </p>
          </div>
        </header>

        {selectedTab === "summary" && (
          <>
            <section className="grid grid-cols-2 gap-3">
              <MetricCard label="Ingresos" value={formatCurrency(totalIncome)} tone="income" />
              <MetricCard label="Gastos" value={formatCurrency(totalSpent)} tone="expense" />
            </section>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-ink">Uso del presupuesto</h2>
                  <p className="mt-1 text-sm font-semibold text-ink/50">
                    {usedPercentage.toFixed(0)}% usado este mes
                  </p>
                </div>
                <span className="rounded-full bg-mint px-3 py-2 text-sm font-black text-leaf">
                  {formatCurrency(totalIncome)}
                </span>
              </div>
              <div className="mt-5 h-5 overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full rounded-full bg-coral transition-all"
                  style={{ width: `${usedPercentage}%` }}
                />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-ink">Categorias principales</h2>
                <button
                  type="button"
                  onClick={() => setSelectedTab("charts")}
                  className="rounded-full bg-paper px-3 py-2 text-xs font-black text-leaf"
                >
                  Ver todo
                </button>
              </div>

              {topCategories.length === 0 ? (
                <div className="mt-4">
                  <EmptyState>Agrega gastos para ver un resumen rapido por categoria.</EmptyState>
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {topCategories.map((item) => (
                    <li
                      key={item.category}
                      className="flex items-center justify-between rounded-[22px] bg-paper p-4"
                    >
                      <div>
                        <p className="font-black text-ink">{item.category}</p>
                        <p className="mt-1 text-xs font-bold text-ink/50">
                          {item.percentage.toFixed(0)}% de gastos
                        </p>
                      </div>
                      <p className="text-sm font-black text-ink">{formatCurrency(item.amount)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}

        {selectedTab === "income" && (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-ink">Ingresos</h2>
                <p className="mt-1 text-sm font-semibold text-ink/50">
                  {monthData.incomes.length} registros este mes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("income")}
                className="rounded-full bg-leaf px-4 py-3 text-sm font-black text-white"
              >
                Agregar
              </button>
            </div>

            {monthData.incomes.length === 0 ? (
              <div className="mt-5">
                <EmptyState>Agrega ingresos para calcular el presupuesto mensual.</EmptyState>
              </div>
            ) : (
              <ul className="mt-5 space-y-3">
                {monthData.incomes.map((income) => (
                  <li
                    key={income.id}
                    className="flex items-center justify-between gap-3 rounded-[24px] bg-mint p-4"
                  >
                    <div>
                      <p className="font-black text-ink">{income.category}</p>
                      <p className="mt-1 text-xs font-bold text-ink/50">
                        {income.description || "Sin descripcion"} - {formatDate(income.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-leaf">{formatCurrency(income.amount)}</p>
                      <button
                        type="button"
                        onClick={() => openEditIncome(income)}
                        className="mt-1 text-xs font-black text-leaf"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteIncome(income.id)}
                        className="ml-3 mt-1 text-xs font-black text-coral"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {selectedTab === "expenses" && (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-ink">Gastos</h2>
                <p className="mt-1 text-sm font-semibold text-ink/50">
                  {monthData.expenses.length} registros este mes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("expense")}
                className="rounded-full bg-ink px-4 py-3 text-sm font-black text-white"
              >
                Agregar
              </button>
            </div>

            {monthData.expenses.length === 0 ? (
              <div className="mt-5">
                <EmptyState>Todavia no hay gastos para este mes.</EmptyState>
              </div>
            ) : (
              <ul className="mt-5 space-y-3">
                {monthData.expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center justify-between gap-3 rounded-[24px] bg-paper p-4"
                  >
                    <div>
                      <p className="font-black text-ink">{expense.name}</p>
                      <p className="mt-1 text-xs font-bold text-ink/50">
                        {expense.category} - {formatDate(expense.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-ink">{formatCurrency(expense.amount)}</p>
                      <button
                        type="button"
                        onClick={() => openEditExpense(expense)}
                        className="mt-1 text-xs font-black text-leaf"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteExpense(expense.id)}
                        className="ml-3 mt-1 text-xs font-black text-coral"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {selectedTab === "charts" && (
          <>
            <ChartList
              title="Gastos por categoria"
              data={expenseChartData}
              accent="coral"
              onSelectCategory={(category) => setChartDetail({ type: "expense", category })}
            />
            <ChartList
              title="Ingresos por categoria"
              data={incomeChartData}
              onSelectCategory={(category) => setChartDetail({ type: "income", category })}
            />
          </>
        )}
      </section>

      <button
        type="button"
        onClick={() => setActiveModal("menu")}
        className="fixed bottom-24 left-1/2 z-40 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full bg-leaf text-4xl font-light leading-none text-white shadow-xl shadow-leaf/30"
        aria-label="Agregar movimiento"
      >
        +
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/5 bg-white/95 px-3 pb-4 pt-3 shadow-lg backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTab(tab.id)}
              className={`rounded-[20px] px-2 py-3 text-xs font-black transition ${
                selectedTab === tab.id
                  ? "bg-leaf text-white shadow-sm"
                  : "bg-paper text-ink/55 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {activeModal === "menu" && (
        <Modal title="Agregar movimiento" onClose={() => setActiveModal("none")}>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setActiveModal("income")}
              className="rounded-[24px] bg-mint p-5 text-left"
            >
              <span className="block text-lg font-black text-leaf">Agregar ingreso</span>
              <span className="mt-1 block text-sm font-semibold text-ink/55">
                Salario, extras o ahorros
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("expense")}
              className="rounded-[24px] bg-coral/10 p-5 text-left"
            >
              <span className="block text-lg font-black text-coral">Agregar gasto</span>
              <span className="mt-1 block text-sm font-semibold text-ink/55">
                Comida, transporte, casa y mas
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("categories")}
              className="rounded-[24px] bg-paper p-5 text-left"
            >
              <span className="block text-lg font-black text-ink">Editar categorias</span>
              <span className="mt-1 block text-sm font-semibold text-ink/55">
                Agrega, renombra o elimina categorias
              </span>
            </button>
          </div>
        </Modal>
      )}

      {activeModal === "categories" && (
        <Modal title="Editar categorias" onClose={() => setActiveModal("none")}>
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <form onSubmit={addCategory} className="grid gap-3 rounded-[24px] bg-paper p-4">
              <label className="grid gap-2 text-sm font-black text-ink" htmlFor="category-type">
                Tipo
                <select
                  id="category-type"
                  value={newCategoryType}
                  onChange={(event) => setNewCategoryType(event.target.value as CategoryType)}
                  className="rounded-[18px] border border-ink/10 bg-white px-4 py-3 text-base font-bold outline-none focus:border-leaf"
                >
                  <option value="income">Ingresos</option>
                  <option value="expense">Gastos</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-ink" htmlFor="category-name">
                Nueva categoria
                <input
                  id="category-name"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Ej: Mascotas"
                  className="rounded-[18px] border border-ink/10 bg-white px-4 py-3 text-base font-bold outline-none focus:border-leaf"
                />
              </label>

              <button
                type="submit"
                className="rounded-[20px] bg-leaf px-4 py-3 text-base font-black text-white"
              >
                Agregar categoria
              </button>
            </form>

            {editingCategory && (
              <form
                onSubmit={saveEditedCategory}
                className="mt-4 grid gap-3 rounded-[24px] bg-mint p-4"
              >
                <p className="text-sm font-black text-ink">
                  Editando {editingCategory.name}
                </p>
                <input
                  value={editingCategoryName}
                  onChange={(event) => setEditingCategoryName(event.target.value)}
                  className="rounded-[18px] border border-leaf/20 bg-white px-4 py-3 text-base font-bold outline-none focus:border-leaf"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setEditingCategoryName("");
                    }}
                    className="rounded-[18px] bg-white px-4 py-3 text-sm font-black text-ink"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-[18px] bg-leaf px-4 py-3 text-sm font-black text-white"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}

            {categoryMessage && (
              <p className="mt-4 rounded-[18px] bg-paper px-4 py-3 text-sm font-bold text-ink/70">
                {categoryMessage}
              </p>
            )}

            <div className="mt-5 grid gap-5">
              {([
                ["income", "Ingresos", categoryConfig.income],
                ["expense", "Gastos", categoryConfig.expense]
              ] as Array<[CategoryType, string, string[]]>).map(([type, title, categories]) => (
                <section key={type}>
                  <h3 className="text-base font-black text-ink">{title}</h3>
                  <ul className="mt-3 grid gap-2">
                    {categories.map((category) => (
                      <li
                        key={`${type}-${category}`}
                        className="flex items-center justify-between gap-3 rounded-[20px] bg-paper p-3"
                      >
                        <span className="font-black text-ink">{category}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingCategory(type, category)}
                            className="rounded-full bg-white px-3 py-2 text-xs font-black text-leaf"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCategory(type, category)}
                            className="rounded-full bg-coral/10 px-3 py-2 text-xs font-black text-coral"
                          >
                            Eliminar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {chartDetail && (
        <Modal title={chartDetail.category} onClose={() => setChartDetail(null)}>
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <div
              className={`rounded-[28px] p-5 ${
                chartDetail.type === "income" ? "bg-mint" : "bg-coral/10"
              }`}
            >
              <p
                className={`text-sm font-black uppercase tracking-wide ${
                  chartDetail.type === "income" ? "text-leaf" : "text-coral"
                }`}
              >
                {chartDetail.type === "income" ? "Ingresos" : "Gastos"}
              </p>
              <p className="mt-3 break-words text-4xl font-black text-ink">
                {formatCurrency(chartDetailTotal)}
              </p>
              <p className="mt-2 text-sm font-bold text-ink/60">
                {chartDetailPercentage.toFixed(0)}% del total de{" "}
                {chartDetail.type === "income" ? "ingresos" : "gastos"} del mes
              </p>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-ink">Movimientos</h3>
                <span className="rounded-full bg-paper px-3 py-2 text-xs font-black text-ink/55">
                  {chartDetailRecords.length}
                </span>
              </div>

              {chartDetailRecords.length === 0 ? (
                <div className="mt-3">
                  <EmptyState>No hay movimientos registrados en esta categoria.</EmptyState>
                </div>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {chartDetailRecords.map((record) => {
                    const title =
                      chartDetail.type === "income"
                        ? (record as Income).description || "Ingreso sin descripcion"
                        : (record as Expense).name;

                    return (
                      <li
                        key={record.id}
                        className="flex items-center justify-between gap-3 rounded-[22px] bg-paper p-4"
                      >
                        <div>
                          <p className="font-black text-ink">{title}</p>
                          <p className="mt-1 text-xs font-bold text-ink/50">
                            {record.category} - {formatDate(record.date)}
                          </p>
                        </div>
                        <p
                          className={`text-right font-black ${
                            chartDetail.type === "income" ? "text-leaf" : "text-ink"
                          }`}
                        >
                          {formatCurrency(record.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (chartDetail.type === "income") {
                              openEditIncome(record as Income);
                            } else {
                              openEditExpense(record as Expense);
                            }
                          }}
                          className="rounded-full bg-white px-3 py-2 text-xs font-black text-leaf"
                        >
                          Editar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Modal>
      )}

      {activeModal === "editIncome" && (
        <Modal title="Editar ingreso" onClose={() => setActiveModal("none")}>
          <form onSubmit={saveEditedIncome} className="grid gap-4">
            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="edit-income-category">
              Categoria
              <select
                id="edit-income-category"
                value={editIncomeCategory}
                onChange={(event) => setEditIncomeCategory(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              >
                {categoryConfig.income.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label
              className="grid gap-2 text-sm font-black text-ink"
              htmlFor="edit-income-description"
            >
              Descripcion
              <input
                id="edit-income-description"
                value={editIncomeDescription}
                onChange={(event) => setEditIncomeDescription(event.target.value)}
                placeholder="Ej: Freelance"
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="edit-income-amount">
              Monto
              <input
                id="edit-income-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={editIncomeAmount}
                onChange={(event) => setEditIncomeAmount(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="edit-income-date">
              Fecha
              <input
                id="edit-income-date"
                type="date"
                value={editIncomeDate}
                onChange={(event) => setEditIncomeDate(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <button
              type="submit"
              className="mt-1 rounded-[22px] bg-leaf px-4 py-4 text-base font-black text-white"
            >
              Guardar cambios
            </button>
          </form>
        </Modal>
      )}

      {activeModal === "editExpense" && (
        <Modal title="Editar gasto" onClose={() => setActiveModal("none")}>
          <form onSubmit={saveEditedExpense} className="grid gap-4">
            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="edit-expense-name">
              Nombre
              <input
                id="edit-expense-name"
                value={editExpenseName}
                onChange={(event) => setEditExpenseName(event.target.value)}
                placeholder="Ej: Uber"
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="edit-expense-amount">
              Monto
              <input
                id="edit-expense-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={editExpenseAmount}
                onChange={(event) => setEditExpenseAmount(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <label
              className="grid gap-2 text-sm font-black text-ink"
              htmlFor="edit-expense-category"
            >
              Categoria
              <select
                id="edit-expense-category"
                value={editExpenseCategory}
                onChange={(event) => setEditExpenseCategory(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              >
                {categoryConfig.expense.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="edit-expense-date">
              Fecha
              <input
                id="edit-expense-date"
                type="date"
                value={editExpenseDate}
                onChange={(event) => setEditExpenseDate(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <button
              type="submit"
              className="mt-1 rounded-[22px] bg-ink px-4 py-4 text-base font-black text-white"
            >
              Guardar cambios
            </button>
          </form>
        </Modal>
      )}

      {activeModal === "income" && (
        <Modal title="Nuevo ingreso" onClose={() => setActiveModal("none")}>
          <form onSubmit={addIncome} className="grid gap-4">
            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="income-category">
              Categoria
              <select
                id="income-category"
                value={incomeCategory}
                onChange={(event) => setIncomeCategory(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              >
                {categoryConfig.income.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="income-description">
              Descripcion opcional
              <input
                id="income-description"
                value={incomeDescription}
                onChange={(event) => setIncomeDescription(event.target.value)}
                placeholder="Ej: Pago principal"
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="income-amount">
              Monto
              <input
                id="income-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={incomeAmount}
                onChange={(event) => setIncomeAmount(event.target.value)}
                placeholder="Ej: 1250.75"
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="income-date">
              Fecha
              <input
                id="income-date"
                type="date"
                value={incomeDate}
                onChange={(event) => setIncomeDate(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <button
              type="submit"
              className="mt-1 rounded-[22px] bg-leaf px-4 py-4 text-base font-black text-white"
            >
              Guardar ingreso
            </button>
          </form>
        </Modal>
      )}

      {activeModal === "expense" && (
        <Modal title="Nuevo gasto" onClose={() => setActiveModal("none")}>
          <form onSubmit={addExpense} className="grid gap-4">
            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="expense-name">
              Nombre
              <input
                id="expense-name"
                value={expenseName}
                onChange={(event) => setExpenseName(event.target.value)}
                placeholder="Ej: Mercado"
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="expense-amount">
              Monto
              <input
                id="expense-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="Ej: 85.50"
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="expense-category">
              Categoria
              <select
                id="expense-category"
                value={expenseCategory}
                onChange={(event) => setExpenseCategory(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              >
                {categoryConfig.expense.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-black text-ink" htmlFor="expense-date">
              Fecha
              <input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                className="rounded-[20px] border border-ink/10 bg-paper px-4 py-4 text-base font-bold outline-none focus:border-leaf"
              />
            </label>

            <button
              type="submit"
              className="mt-1 rounded-[22px] bg-ink px-4 py-4 text-base font-black text-white"
            >
              Guardar gasto
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
