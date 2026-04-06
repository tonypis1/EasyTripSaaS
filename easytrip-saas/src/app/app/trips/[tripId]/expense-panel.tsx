"use client";

import { useState, useEffect, useCallback } from "react";
import posthog from "posthog-js";
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

type ExpenseDto = {
  id: string;
  amount: number;
  description: string;
  category: string;
  splitEqually: boolean;
  dayNumber: number | null;
  paidBy: { memberId: string; name: string | null; email: string };
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

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  cibo: { label: "Cibo", emoji: "🍕" },
  trasporti: { label: "Trasporti", emoji: "🚕" },
  attivita: { label: "Attività", emoji: "🎫" },
  alloggio: { label: "Alloggio", emoji: "🏨" },
  altro: { label: "Altro", emoji: "📦" },
};

type Props = {
  tripId: string;
  totalDays: number;
};

export function ExpensePanel({ tripId, totalDays }: Props) {
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

  async function onAdd() {
    const amountNum = parseFloat(amount);
    if (!description.trim() || isNaN(amountNum) || amountNum <= 0) return;

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
        }),
      });

      if (res.ok) {
        posthog.capture("expense_added", { tripId, amount: amountNum, category });
        setDescription("");
        setAmount("");
        setCategory("altro");
        setDayNumber("");
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
      const res = await fetch(
        `/api/trips/${tripId}/expenses/${expenseId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        posthog.capture("expense_deleted", { tripId, expenseId });
        await fetchData();
      }
    } catch {
      /* ignore */
    }
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

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
          <p className="text-sm text-et-ink/55">Totale spese</p>
          <p className="text-2xl font-bold text-et-ink">
            €{totalExpenses.toFixed(2)}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                     bg-blue-600 text-white text-sm font-semibold
                     hover:bg-blue-700 transition-colors cursor-pointer
                     min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          Aggiungi spesa
        </button>
      </div>

      {/* Form nuova spesa */}
      {showForm && (
        <div className="rounded-xl border border-et-border bg-et-bg/40 p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-et-ink/60 uppercase tracking-wide">
              Descrizione
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Es: Cena da Mario"
              className="mt-1 w-full rounded-lg border border-et-border bg-et-card px-3 py-2.5
                         text-sm text-et-ink placeholder:text-et-ink/30
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-et-ink/60 uppercase tracking-wide">
                Importo (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-et-border bg-et-card px-3 py-2.5
                           text-sm text-et-ink placeholder:text-et-ink/30
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-et-ink/60 uppercase tracking-wide">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-et-border bg-et-card px-3 py-2.5
                           text-sm text-et-ink cursor-pointer
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.emoji} {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {totalDays > 0 && (
            <div>
              <label className="text-xs font-medium text-et-ink/60 uppercase tracking-wide">
                Giorno (opzionale)
              </label>
              <select
                value={dayNumber}
                onChange={(e) => setDayNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-et-border bg-et-card px-3 py-2.5
                           text-sm text-et-ink cursor-pointer
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">— Nessuno —</option>
                {Array.from({ length: totalDays }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Giorno {i + 1}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onAdd}
              disabled={adding || !description.trim() || !amount}
              className="flex-1 flex items-center justify-center gap-2 py-2.5
                         bg-green-600 text-white rounded-lg text-sm font-semibold
                         hover:bg-green-700 transition-colors cursor-pointer
                         disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Salva
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-lg text-sm text-et-ink/60
                         hover:bg-et-bg/60 transition-colors cursor-pointer min-h-[44px]"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Lista spese */}
      {expenses.length > 0 && (
        <div className="space-y-2">
          {expenses.map((exp) => {
            const cat = CATEGORY_LABELS[exp.category] ?? CATEGORY_LABELS.altro;
            return (
              <div
                key={exp.id}
                className="flex items-center justify-between rounded-xl bg-et-bg/40
                           border border-et-border px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg">{cat.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-et-ink truncate">
                      {exp.description}
                    </p>
                    <p className="text-xs text-et-ink/50">
                      Pagato da{" "}
                      <strong>
                        {exp.paidBy.name ?? exp.paidBy.email.split("@")[0]}
                      </strong>
                      {exp.dayNumber ? ` · Giorno ${exp.dayNumber}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-sm font-bold text-et-ink">
                    €{exp.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => onDelete(exp.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400
                               cursor-pointer transition-colors min-h-[44px] min-w-[44px]
                               flex items-center justify-center"
                    title="Elimina spesa"
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
        <div className="text-center py-6">
          <Receipt className="h-10 w-10 text-et-ink/20 mx-auto mb-2" />
          <p className="text-sm text-et-ink/40">
            Nessuna spesa registrata ancora.
          </p>
        </div>
      )}

      {/* Bilancio e settlements */}
      {balances.length > 1 && (
        <div className="border-t border-et-border pt-4">
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="flex items-center gap-2 text-sm font-semibold text-et-ink
                       cursor-pointer hover:text-blue-500 transition-colors w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Bilancio del gruppo
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
                    className="flex items-center justify-between rounded-lg bg-et-bg/40 px-4 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-et-ink">
                        {b.name ?? b.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-et-ink/50">
                        Pagato: €{b.totalPaid.toFixed(2)}
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
                  <h4 className="text-xs font-semibold text-et-ink/55 uppercase tracking-wide mb-2">
                    Chi deve cosa a chi
                  </h4>
                  <div className="space-y-2">
                    {settlements.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg bg-amber-500/5
                                   border border-amber-500/10 px-4 py-2.5"
                      >
                        <span className="text-sm font-medium text-et-ink">
                          {s.from.name ?? "?"}
                        </span>
                        <ArrowRight className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-et-ink">
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
