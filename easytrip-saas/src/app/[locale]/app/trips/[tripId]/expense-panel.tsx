"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import posthog from "posthog-js";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Loader2,
  Receipt,
  ArrowRight,
  Wallet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { allocateByWeights, toCents } from "@/lib/expense-split";
import { summarizeBudget } from "@/lib/expense-budget";

type ExpenseDto = {
  id: string;
  amount: number;
  description: string;
  category: string;
  splitEqually: boolean;
  dayNumber: number | null;
  paidBy: { memberId: string; name: string | null; email: string };
  /** null = divisa in parti uguali tra tutti i membri. */
  participants:
    | { memberId: string; name: string | null; email: string; weight: number }[]
    | null;
  createdAt: string;
};

type BalanceEntry = {
  memberId: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  totalPaid: number;
  balance: number;
};

type Settlement = {
  from: { memberId: string; name: string | null };
  to: { memberId: string; name: string | null };
  amount: number;
};

// Chiavi delle categorie (valori persistiti lato DB); label/emoji sono localizzati runtime.
const CATEGORY_KEYS = [
  "cibo",
  "trasporti",
  "attivita",
  "alloggio",
  "altro",
] as const;
const CATEGORY_EMOJI: Record<string, string> = {
  cibo: "🍕",
  trasporti: "🚕",
  attivita: "🎫",
  alloggio: "🏨",
  altro: "📦",
};

type Props = {
  tripId: string;
  totalDays: number;
  budgetLevel: string;
};

/** Barra di avanzamento del budget: verde sotto l'80%, ambra fino al 100%, rossa oltre. */
const BUDGET_BAR_COLOR = {
  ok: "bg-green-500",
  warning: "bg-amber-500",
  over: "bg-red-500",
} as const;

type ShareInput = { included: boolean; weight: string };

function displayName(m: { name: string | null; email: string }) {
  return m.name ?? m.email.split("@")[0];
}

export function ExpensePanel({ tripId, totalDays, budgetLevel }: Props) {
  const t = useTranslations("app.trips.expenses");
  const tDetail = useTranslations("app.trips.detail");
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBalances, setShowBalances] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("altro");
  const [dayNumber, setDayNumber] = useState<string>("");
  const [splitMode, setSplitMode] = useState<"all" | "custom">("all");
  const [shares, setShares] = useState<Record<string, ShareInput>>({});
  const [showBudget, setShowBudget] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [expRes, balRes] = await Promise.all([
        fetch(`/api/trips/${tripId}/expenses`),
        fetch(`/api/trips/${tripId}/balances`),
      ]);
      const expJson = await expRes.json();
      const balJson = await balRes.json();
      if (expRes.ok && expJson.data) setExpenses(expJson.data);
      if (balRes.ok && balJson.data) {
        setBalances(balJson.data.members ?? []);
        setSettlements(balJson.data.settlements ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openForm() {
    setShares(
      Object.fromEntries(
        balances.map((b) => [b.memberId, { included: true, weight: "1" }]),
      ),
    );
    setSplitMode("all");
    setShowForm(true);
  }

  function updateShare(memberId: string, patch: Partial<ShareInput>) {
    setShares((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], ...patch },
    }));
  }

  /** Partecipanti scelti nella modalità "Personalizza" (solo quelli inclusi), con il peso digitato. */
  const customParticipants = useMemo(
    () =>
      balances
        .filter((b) => shares[b.memberId]?.included)
        .map((b) => ({
          member: b,
          weight: parseFloat(shares[b.memberId].weight),
        })),
    [balances, shares],
  );
  const customValid =
    customParticipants.length > 0 &&
    customParticipants.every((p) => p.weight >= 0.01 && p.weight <= 100);

  /** Anteprima della ripartizione, calcolata con la stessa funzione usata dal server. */
  const preview = useMemo(() => {
    const amountNum = parseFloat(amount);
    if (splitMode !== "custom" || !customValid || !(amountNum > 0)) return [];
    const cents = allocateByWeights(
      toCents(amountNum),
      customParticipants.map((p) => p.weight),
    );
    return customParticipants.map((p, i) => ({
      name: displayName(p.member),
      amount: cents[i] / 100,
    }));
  }, [amount, splitMode, customValid, customParticipants]);

  async function onAdd() {
    const amountNum = parseFloat(amount);
    if (!description.trim() || isNaN(amountNum) || amountNum <= 0) return;
    if (splitMode === "custom" && !customValid) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: amountNum,
          category,
          splitEqually: true,
          dayNumber: dayNumber ? parseInt(dayNumber, 10) : null,
          ...(splitMode === "custom"
            ? {
                participants: customParticipants.map((p) => ({
                  memberId: p.member.memberId,
                  weight: p.weight,
                })),
              }
            : {}),
        }),
      });

      if (res.ok) {
        posthog.capture("expense_added", {
          tripId,
          amount: amountNum,
          category,
          split_mode: splitMode,
          participants:
            splitMode === "custom" ? customParticipants.length : null,
        });
        setDescription("");
        setAmount("");
        setCategory("altro");
        setDayNumber("");
        setSplitMode("all");
        setShowForm(false);
        await fetchData();
      }
    } catch {
      /* ignore */
    } finally {
      setAdding(false);
    }
  }

  async function onDelete(expenseId: string) {
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses/${expenseId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        posthog.capture("expense_deleted", { tripId, expenseId });
        await fetchData();
      }
    } catch {
      /* ignore */
    }
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const budget = summarizeBudget({
    expenses,
    budgetLevel,
    memberCount: balances.length,
    totalDays,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con totale */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-et-ink/55 text-sm">{t("totalLabel")}</p>
          <p className="text-et-ink text-2xl font-bold">
            €{totalExpenses.toFixed(2)}
          </p>
        </div>
        <button
          onClick={() => (showForm ? setShowForm(false) : openForm())}
          className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t("addButton")}
        </button>
      </div>

      {/* Budget indicativo vs speso */}
      {budget.indicativeBudget > 0 && (
        <div className="space-y-1.5" data-testid="expense-budget">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-et-ink/70 font-medium">
              {t("budgetSpent", {
                spent: budget.totalSpent.toFixed(2),
                budget: budget.indicativeBudget.toFixed(0),
              })}
            </span>
            <span
              className={
                budget.status === "over"
                  ? "font-semibold text-red-400"
                  : "text-et-ink/50"
              }
            >
              {Math.round(budget.ratio * 100)}%
            </span>
          </div>
          <div
            className="bg-et-border/60 h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(budget.ratio * 100))}
            aria-label={t("budgetTitle")}
          >
            <div
              className={`h-full rounded-full transition-all ${BUDGET_BAR_COLOR[budget.status]}`}
              style={{ width: `${Math.min(100, budget.ratio * 100)}%` }}
            />
          </div>
          <p className="text-et-ink/45 text-xs">
            {budget.status === "over" ? `${t("budgetOver")} · ` : ""}
            {t("budgetHint", {
              level: tDetail(`budget.${budget.level}`),
              people: balances.length,
              days: totalDays,
            })}
          </p>

          {budget.totalSpent > 0 && (
            <div>
              <button
                onClick={() => setShowBudget(!showBudget)}
                className="text-et-ink/60 flex cursor-pointer items-center gap-1 text-xs font-medium transition-colors hover:text-blue-500"
              >
                {t("budgetDetailToggle")}
                {showBudget ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              {showBudget && (
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <h4 className="text-et-ink/55 text-xs font-semibold tracking-wide uppercase">
                      {t("budgetByCategory")}
                    </h4>
                    {budget.byCategory.map((c) => (
                      <div key={c.category} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-et-ink/70">
                            {CATEGORY_EMOJI[c.category] ?? CATEGORY_EMOJI.altro}{" "}
                            {t(`categories.${c.category}`)}
                          </span>
                          <span className="text-et-ink font-medium">
                            €{c.amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-et-border/60 h-1.5 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full bg-blue-500/70"
                            style={{ width: `${Math.round(c.share * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-et-ink/55 text-xs font-semibold tracking-wide uppercase">
                      {t("budgetByDay")}
                    </h4>
                    {budget.byDay.map((d) => (
                      <div
                        key={d.dayNumber ?? "none"}
                        className="flex justify-between text-xs"
                      >
                        <span className="text-et-ink/70">
                          {d.dayNumber === null
                            ? t("budgetNoDay")
                            : t("dayOption", { day: d.dayNumber })}
                        </span>
                        <span className="text-et-ink font-medium">
                          €{d.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form nuova spesa */}
      {showForm && (
        <div className="border-et-border bg-et-bg/40 space-y-3 rounded-xl border p-4">
          <div>
            <label className="text-et-ink/60 text-xs font-medium tracking-wide uppercase">
              {t("descriptionLabel")}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              className="border-et-border bg-et-card text-et-ink placeholder:text-et-ink/30 mt-1 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-et-ink/60 text-xs font-medium tracking-wide uppercase">
                {t("amountLabel")}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t("amountPlaceholder")}
                className="border-et-border bg-et-card text-et-ink placeholder:text-et-ink/30 mt-1 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-et-ink/60 text-xs font-medium tracking-wide uppercase">
                {t("categoryLabel")}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border-et-border bg-et-card text-et-ink mt-1 w-full cursor-pointer rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
              >
                {CATEGORY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {CATEGORY_EMOJI[k]} {t(`categories.${k}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {totalDays > 0 && (
            <div>
              <label className="text-et-ink/60 text-xs font-medium tracking-wide uppercase">
                {t("dayLabel")}
              </label>
              <select
                value={dayNumber}
                onChange={(e) => setDayNumber(e.target.value)}
                className="border-et-border bg-et-card text-et-ink mt-1 w-full cursor-pointer rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
              >
                <option value="">{t("dayNone")}</option>
                {Array.from({ length: totalDays }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {t("dayOption", { day: i + 1 })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Divisione: tra tutti (equa) o personalizzata (partecipanti + quote) */}
          {balances.length > 1 && (
            <div data-testid="expense-split">
              <label className="text-et-ink/60 text-xs font-medium tracking-wide uppercase">
                {t("splitLabel")}
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(["all", "custom"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSplitMode(mode)}
                    aria-pressed={splitMode === mode}
                    className={`min-h-[44px] cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      splitMode === mode
                        ? "border-blue-500 bg-blue-500/10 text-blue-500"
                        : "border-et-border bg-et-card text-et-ink/70 hover:border-blue-500/50"
                    }`}
                  >
                    {mode === "all" ? t("splitAll") : t("splitCustom")}
                  </button>
                ))}
              </div>

              {splitMode === "custom" && (
                <div className="mt-3 space-y-2">
                  <p className="text-et-ink/50 text-xs">
                    {t("splitCustomHint")}
                  </p>
                  {balances.map((b) => {
                    const share = shares[b.memberId] ?? {
                      included: true,
                      weight: "1",
                    };
                    return (
                      <div
                        key={b.memberId}
                        className="border-et-border bg-et-card flex items-center gap-3 rounded-lg border px-3 py-2"
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={share.included}
                            onChange={(e) =>
                              updateShare(b.memberId, {
                                included: e.target.checked,
                              })
                            }
                            className="h-4 w-4 cursor-pointer accent-blue-600"
                          />
                          <span className="text-et-ink truncate text-sm">
                            {displayName(b)}
                          </span>
                        </label>
                        <label className="text-et-ink/50 flex items-center gap-1.5 text-xs">
                          {t("splitWeightLabel")}
                          <input
                            type="number"
                            step="0.5"
                            min="0.01"
                            max="100"
                            value={share.weight}
                            disabled={!share.included}
                            onChange={(e) =>
                              updateShare(b.memberId, {
                                weight: e.target.value,
                              })
                            }
                            aria-label={`${t("splitWeightLabel")} ${displayName(b)}`}
                            className="border-et-border bg-et-bg text-et-ink w-16 rounded-md border px-2 py-1 text-sm disabled:opacity-40"
                          />
                        </label>
                      </div>
                    );
                  })}

                  {!customValid && (
                    <p className="text-xs text-amber-500">
                      {t("splitNeedOne")}
                    </p>
                  )}

                  {preview.length > 0 && (
                    <div
                      className="rounded-lg bg-blue-500/5 px-3 py-2"
                      data-testid="expense-split-preview"
                    >
                      <p className="text-et-ink/55 mb-1 text-xs font-semibold tracking-wide uppercase">
                        {t("splitPreviewTitle")}
                      </p>
                      {preview.map((p) => (
                        <div
                          key={p.name}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-et-ink/80">{p.name}</span>
                          <span className="text-et-ink font-medium">
                            €{p.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onAdd}
              disabled={
                adding ||
                !description.trim() ||
                !amount ||
                (splitMode === "custom" && !customValid)
              }
              className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t("saveButton")}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-et-ink/60 hover:bg-et-bg/60 min-h-[44px] cursor-pointer rounded-lg px-4 py-2.5 text-sm transition-colors"
            >
              {t("cancelButton")}
            </button>
          </div>
        </div>
      )}

      {/* Lista spese */}
      {expenses.length > 0 && (
        <div className="space-y-2">
          {expenses.map((exp) => {
            const emoji = CATEGORY_EMOJI[exp.category] ?? CATEGORY_EMOJI.altro;
            return (
              <div
                key={exp.id}
                className="bg-et-bg/40 border-et-border flex items-center justify-between rounded-xl border px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-lg">{emoji}</span>
                  <div className="min-w-0">
                    <p className="text-et-ink truncate text-sm font-medium">
                      {exp.description}
                    </p>
                    <p className="text-et-ink/50 text-xs">
                      {t("paidBy")}{" "}
                      <strong>
                        {exp.paidBy.name ?? exp.paidBy.email.split("@")[0]}
                      </strong>
                      {exp.dayNumber
                        ? ` · ${t("dayPrefix")} ${exp.dayNumber}`
                        : ""}
                    </p>
                    {exp.participants && (
                      <p className="text-et-ink/50 text-xs">
                        {t("splitAmong", {
                          names: exp.participants
                            .map((p) =>
                              p.weight === 1
                                ? displayName(p)
                                : `${displayName(p)} ×${p.weight}`,
                            )
                            .join(", "),
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <span className="text-et-ink text-sm font-bold">
                    €{exp.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => onDelete(exp.id)}
                    className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/10"
                    title={t("deleteTooltip")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expenses.length === 0 && !showForm && (
        <div className="py-6 text-center">
          <Receipt className="text-et-ink/20 mx-auto mb-2 h-10 w-10" />
          <p className="text-et-ink/40 text-sm">{t("emptyState")}</p>
        </div>
      )}

      {/* Bilancio e settlements */}
      {balances.length > 1 && (
        <div className="border-et-border border-t pt-4">
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="text-et-ink flex w-full cursor-pointer items-center justify-between gap-2 text-sm font-semibold transition-colors hover:text-blue-500"
          >
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("groupBalance")}
            </span>
            {showBalances ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showBalances && (
            <div className="mt-3 space-y-4">
              {/* Balance per membro */}
              <div className="space-y-2">
                {balances.map((b) => (
                  <div
                    key={b.memberId}
                    className="bg-et-bg/40 flex items-center justify-between rounded-lg px-4 py-2.5"
                  >
                    <div>
                      <p className="text-et-ink text-sm font-medium">
                        {b.name ?? b.email.split("@")[0]}
                      </p>
                      <p className="text-et-ink/50 text-xs">
                        {t("paidTotal", { amount: b.totalPaid.toFixed(2) })}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        b.balance > 0.01
                          ? "text-green-500"
                          : b.balance < -0.01
                            ? "text-red-400"
                            : "text-et-ink/50"
                      }`}
                    >
                      {b.balance > 0.01
                        ? `+€${b.balance.toFixed(2)}`
                        : b.balance < -0.01
                          ? `-€${Math.abs(b.balance).toFixed(2)}`
                          : "€0,00"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Chi deve cosa a chi */}
              {settlements.length > 0 && (
                <div>
                  <h4 className="text-et-ink/55 mb-2 text-xs font-semibold tracking-wide uppercase">
                    {t("whoOwesWho")}
                  </h4>
                  <div className="space-y-2">
                    {settlements.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-amber-500/10 bg-amber-500/5 px-4 py-2.5"
                      >
                        <span className="text-et-ink text-sm font-medium">
                          {s.from.name ?? "?"}
                        </span>
                        <ArrowRight className="h-4 w-4 flex-shrink-0 text-amber-500" />
                        <span className="text-et-ink text-sm font-medium">
                          {s.to.name ?? "?"}
                        </span>
                        <span className="ml-auto text-sm font-bold text-amber-600">
                          €{s.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
