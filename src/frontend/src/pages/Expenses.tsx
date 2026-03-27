import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: number;
  paidBy: string;
}

const STORAGE_KEY = "smartskale_expenses";
const CATEGORIES = [
  "Food & Beverage",
  "Utilities",
  "Salary",
  "Maintenance",
  "Other",
];

function load(): Expense[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(list: Expense[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    description: "",
    amount: "",
    paidBy: "",
  });

  useEffect(() => {
    setExpenses(load());
  }, []);

  const filtered = expenses.filter((e) => {
    if (!fromDate || !toDate) return true;
    const d = new Date(e.date);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    return d >= from && d <= to;
  });

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  function handleAdd() {
    if (!form.description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (!Number(form.amount) || Number(form.amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const newE: Expense = {
      id: Date.now().toString(),
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      date: Date.now(),
      paidBy: form.paidBy,
    };
    const updated = [newE, ...expenses];
    setExpenses(updated);
    save(updated);
    setDialogOpen(false);
    setForm({
      category: CATEGORIES[0],
      description: "",
      amount: "",
      paidBy: "",
    });
    toast.success("Expense added");
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const updated = expenses.filter((e) => e.id !== deleteTarget.id);
    setExpenses(updated);
    save(updated);
    setDeleteTarget(null);
    toast.success("Expense deleted");
  }

  return (
    <div className="space-y-5" data-ocid="expenses.page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Expenses</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {expenses.length} expense records
          </p>
        </div>
        <Button
          data-ocid="expenses.add_button"
          onClick={() => setDialogOpen(true)}
        >
          + Add Expense
        </Button>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          Date Range:
        </span>
        <div className="flex items-center gap-2">
          <Label htmlFor="exp-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="exp-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="expenses.from_date_input"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="exp-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="exp-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="expenses.to_date_input"
          />
        </div>
        {(fromDate || toDate) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            data-ocid="expenses.clear_date_button"
          >
            ✕ Clear
          </Button>
        )}
      </div>

      {/* Summary */}
      <Card data-ocid="expenses.summary.card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {fromDate && toDate ? "Filtered" : "Total"} Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-foreground">
            ₹{total.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <div
        className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        data-ocid="expenses.table"
      >
        {filtered.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="expenses.empty_state"
          >
            <CreditCard className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>
              {expenses.length > 0
                ? "No expenses in this date range."
                : "No expenses recorded yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Category",
                    "Description",
                    "Amount (₹)",
                    "Date",
                    "Paid By",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-muted-foreground font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr
                    key={e.id}
                    data-ocid={`expenses.item.${i + 1}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {e.description}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      ₹{e.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(e.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.paidBy || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        data-ocid={`expenses.delete_button.${i + 1}`}
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(e)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" data-ocid="expenses.dialog">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger
                  className="h-9"
                  data-ocid="expenses.category_select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-desc">Description</Label>
              <Input
                id="exp-desc"
                className="h-9"
                data-ocid="expenses.description_input"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Expense description"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-amt">Amount (₹)</Label>
              <Input
                id="exp-amt"
                className="h-9"
                data-ocid="expenses.amount_input"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="exp-paid">Paid By</Label>
              <Input
                id="exp-paid"
                className="h-9"
                data-ocid="expenses.paid_by_input"
                value={form.paidBy}
                onChange={(e) =>
                  setForm((p) => ({ ...p, paidBy: e.target.value }))
                }
                placeholder="Name or department"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-ocid="expenses.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} data-ocid="expenses.submit_button">
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent data-ocid="expenses.delete.dialog">
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete this expense record? This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              data-ocid="expenses.delete.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              data-ocid="expenses.delete.confirm_button"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
