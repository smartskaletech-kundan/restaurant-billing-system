import { Button } from "@/components/ui/button";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Bill } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";
import { useCardNames } from "../hooks/useCardNames";
import { formatBillNumber } from "../utils/billFormat";

type SettlementMode = "Cash" | "HDFC Card" | "SBI Card" | "UPI" | "Split";

function formatTime(createdAt: bigint) {
  const ms = Number(createdAt) / 1_000_000;
  return new Date(ms).toLocaleString();
}

const modeIcon: Record<string, string> = {
  Cash: "\uD83D\uDCB5",
  Card: "\uD83D\uDCB3",
  "HDFC Card": "\uD83D\uDCB3",
  "SBI Card": "\uD83D\uDCB3",
  UPI: "\uD83D\uDCF1",
  Split: "\uD83D\uDD00",
};

function unwrapOptional<T>(val: T | null | T[]): T | null {
  if (val == null) return null;
  if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
  return val;
}

function getFYRange(fy: string): { start: Date; end: Date } | null {
  if (fy === "all") return null;
  const match = fy.match(/(\d{4})-(\d{2,4})/);
  if (!match) return null;
  const startYear = Number.parseInt(match[1], 10);
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59),
  };
}

function getDisplayMode(mode: string): string {
  if (mode.startsWith("Split(")) return "Split";
  return mode || "Cash";
}

function isCurrentMonth(createdAt: bigint): boolean {
  const d = new Date(Number(createdAt) / 1_000_000);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

const FY_OPTIONS = [
  { label: "All Years", value: "all" },
  { label: "FY 2023-24", value: "2023-24" },
  { label: "FY 2024-25", value: "2024-25" },
  { label: "FY 2025-26", value: "2025-26" },
  { label: "FY 2026-27", value: "2026-27" },
];

export function BillHistory() {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const { card1Name, card2Name } = useCardNames();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFY, setSelectedFY] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selected, setSelected] = useState<Bill | null>(null);

  // Re-settle
  const [resettleTarget, setResettleTarget] = useState<Bill | null>(null);
  const [newMode, setNewMode] = useState<SettlementMode>("Cash");
  const [splitAmounts, setSplitAmounts] = useState({
    cash: "",
    hdfc: "",
    sbi: "",
    upi: "",
  });
  const [resettling, setResettling] = useState(false);

  // Edit
  const [editTarget, setEditTarget] = useState<Bill | null>(null);
  const [editDiscount, setEditDiscount] = useState("");
  const [editMode, setEditMode] = useState<SettlementMode>("Cash");
  const [editSplit, setEditSplit] = useState({
    cash: "",
    hdfc: "",
    sbi: "",
    upi: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Clear All Bills
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!actor || isFetching) return;
    setLoading(true);
    actor
      .getBillsByRestaurant(restaurantId)
      .then((b) => {
        setBills(b.sort((a, c) => Number(c.createdAt) - Number(a.createdAt)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [actor, isFetching, restaurantId]);

  const filtered = bills.filter((b) => {
    // Search
    const matchSearch =
      b.tableName.toLowerCase().includes(search.toLowerCase()) ||
      Number(b.billNumber).toString().includes(search);
    if (!matchSearch) return false;

    // FY filter
    const fyRange = getFYRange(selectedFY);
    if (fyRange) {
      const d = new Date(Number(b.createdAt) / 1_000_000);
      if (d < fyRange.start || d > fyRange.end) return false;
    }

    // Date range filter
    if (fromDate && toDate) {
      const d = new Date(Number(b.createdAt) / 1_000_000);
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (d < from || d > to) return false;
    }

    return true;
  });

  function buildModeString(
    mode: SettlementMode,
    split: { cash: string; hdfc: string; sbi: string; upi: string },
  ): string {
    if (mode === "Split") {
      return `Split(Cash:${Number(split.cash) || 0},HDFC:${Number(split.hdfc) || 0},SBI:${Number(split.sbi) || 0},UPI:${Number(split.upi) || 0})`;
    }
    return mode;
  }

  const splitTotal = (split: {
    cash: string;
    hdfc: string;
    sbi: string;
    upi: string;
  }) =>
    (Number(split.cash) || 0) +
    (Number(split.hdfc) || 0) +
    (Number(split.sbi) || 0) +
    (Number(split.upi) || 0);

  const handleResettle = async () => {
    if (!actor || !resettleTarget) return;
    const modeString = buildModeString(newMode, splitAmounts);
    if (
      newMode === "Split" &&
      Math.abs(splitTotal(splitAmounts) - resettleTarget.total) > 0.01
    ) {
      toast.error(
        `Split amounts must equal ₹${resettleTarget.total.toFixed(2)}`,
      );
      return;
    }
    setResettling(true);
    const targetId = resettleTarget.id;
    const targetBillNumber = Number(resettleTarget.billNumber);
    try {
      const raw = await actor.resettleBill(targetId, modeString);
      const updatedBill = unwrapOptional(raw as Bill | null | Bill[]);
      setBills((prev) =>
        prev.map((b) =>
          b.id === targetId
            ? (updatedBill ?? { ...b, settlementMode: modeString })
            : b,
        ),
      );
      toast.success(
        `Bill ${formatBillNumber(targetBillNumber)} re-settled as ${getDisplayMode(modeString)}`,
      );
      setResettleTarget(null);
    } catch (err) {
      console.error("Re-settlement error:", err);
      toast.error("Re-settlement failed. Please try again.");
    } finally {
      setResettling(false);
    }
  };

  function openEdit(bill: Bill) {
    setEditTarget(bill);
    setEditDiscount(String(bill.discount || 0));
    const dm = getDisplayMode(bill.settlementMode) as SettlementMode;
    setEditMode(dm);
    if (bill.settlementMode.startsWith("Split(")) {
      const inner = bill.settlementMode.slice(6, -1);
      const parsed: Record<string, string> = {};
      for (const part of inner.split(",")) {
        const [k, v] = part.split(":");
        parsed[k] = v;
      }
      setEditSplit({
        cash: parsed.Cash || "",
        hdfc: parsed.HDFC || "",
        sbi: parsed.SBI || "",
        upi: parsed.UPI || "",
      });
    } else {
      setEditSplit({ cash: "", hdfc: "", sbi: "", upi: "" });
    }
  }

  const handleSaveEdit = async () => {
    if (!actor || !editTarget) return;
    const discount = Number(editDiscount) || 0;
    const newTotal = editTarget.subtotal + editTarget.taxAmount - discount;
    if (newTotal < 0) {
      toast.error("Discount cannot exceed bill total");
      return;
    }
    const modeString = buildModeString(editMode, editSplit);
    if (
      editMode === "Split" &&
      Math.abs(splitTotal(editSplit) - newTotal) > 0.01
    ) {
      toast.error(`Split amounts must equal ₹${newTotal.toFixed(2)}`);
      return;
    }
    setSaving(true);
    try {
      const updatedBill: Bill = {
        ...editTarget,
        discount,
        total: newTotal,
        settlementMode: modeString,
      };
      const raw = await actor.updateBill(updatedBill);
      const result = unwrapOptional(raw as Bill | null | Bill[]);
      setBills((prev) =>
        prev.map((b) => (b.id === editTarget.id ? (result ?? updatedBill) : b)),
      );
      toast.success(
        `Bill ${formatBillNumber(Number(editTarget.billNumber))} updated`,
      );
      setEditTarget(null);
    } catch (err) {
      console.error("Edit error:", err);
      toast.error("Failed to update bill. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!actor || !deleteTarget) return;
    setDeleting(true);
    try {
      await actor.deleteBill(deleteTarget.id);
      setBills((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      toast.success(
        `Bill ${formatBillNumber(Number(deleteTarget.billNumber))} deleted`,
      );
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete bill. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAll = async () => {
    if (!actor) return;
    setClearing(true);
    try {
      await actor.clearRestaurantBills(restaurantId);
      setBills([]);
      setShowClearDialog(false);
      toast.success("All bills cleared successfully");
    } catch (err) {
      console.error("Clear error:", err);
      toast.error("Failed to clear bills. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="history.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-ocid="history.page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bill History</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {bills.length} bills total · {filtered.length} shown
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            data-ocid="history.search_input"
            placeholder="Search by table or bill #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Select value={selectedFY} onValueChange={setSelectedFY}>
            <SelectTrigger className="w-40" data-ocid="history.fy_select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            data-ocid="history.delete_button"
            onClick={() => setShowClearDialog(true)}
          >
            🗑 Clear All Bills
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          Date Range:
        </span>
        <div className="flex items-center gap-2">
          <Label htmlFor="bh-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="bh-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="history.from_date_input"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="bh-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="bh-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="history.to_date_input"
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
            data-ocid="history.clear_date_button"
          >
            ✕ Clear
          </Button>
        )}
      </div>

      <div
        className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        data-ocid="history.table"
      >
        {filtered.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground"
            data-ocid="history.empty_state"
          >
            <p className="text-4xl mb-2">&#x1F4DC;</p>
            <p>
              {search
                ? "No bills match your search"
                : "No bills for this filter"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Bill No.
                  </th>
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Table
                  </th>
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Date &amp; Time
                  </th>
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Mode
                  </th>
                  <th className="px-5 py-3 text-right text-muted-foreground font-medium">
                    Items
                  </th>
                  <th className="px-5 py-3 text-right text-muted-foreground font-medium">
                    Total
                  </th>
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bill, i) => {
                  const canModify = isCurrentMonth(bill.createdAt);
                  const displayMode = getDisplayMode(bill.settlementMode);
                  return (
                    <tr
                      key={bill.id}
                      data-ocid={`history.item.${i + 1}`}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setSelected(bill)}
                      onKeyDown={(e) => e.key === "Enter" && setSelected(bill)}
                      tabIndex={0}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">
                        {formatBillNumber(
                          Number(bill.billNumber),
                          new Date(Number(bill.createdAt) / 1_000_000),
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground">
                        {bill.tableName}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatTime(bill.createdAt)}
                      </td>
                      <td
                        className="px-5 py-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {modeIcon[displayMode] ?? "\uD83D\uDCB0"}{" "}
                          {displayMode}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {bill.items.length}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground">
                        &#x20B9;{bill.total.toFixed(2)}
                      </td>
                      <td
                        className="px-5 py-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setResettleTarget(bill);
                              const dm = getDisplayMode(
                                bill.settlementMode,
                              ) as SettlementMode;
                              setNewMode(dm);
                              if (bill.settlementMode.startsWith("Split(")) {
                                const inner = bill.settlementMode.slice(6, -1);
                                const parsed: Record<string, string> = {};
                                for (const part of inner.split(",")) {
                                  const [k, v] = part.split(":");
                                  parsed[k] = v;
                                }
                                setSplitAmounts({
                                  cash: parsed.Cash || "",
                                  hdfc: parsed.HDFC || "",
                                  sbi: parsed.SBI || "",
                                  upi: parsed.UPI || "",
                                });
                              } else {
                                setSplitAmounts({
                                  cash: "",
                                  hdfc: "",
                                  sbi: "",
                                  upi: "",
                                });
                              }
                            }}
                            data-ocid={`history.resettle.${i + 1}`}
                          >
                            &#x1F504; Re-settle
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canModify}
                            title={
                              canModify
                                ? "Edit bill"
                                : "Can only edit/delete bills from current month"
                            }
                            onClick={() => canModify && openEdit(bill)}
                            data-ocid={`history.edit_button.${i + 1}`}
                          >
                            ✏️ Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!canModify}
                            title={
                              canModify
                                ? "Delete bill"
                                : "Can only edit/delete bills from current month"
                            }
                            onClick={() => canModify && setDeleteTarget(bill)}
                            data-ocid={`history.delete_button.${i + 1}`}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bill Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent
          className="sm:max-w-lg"
          data-ocid="history.bill_detail.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {selected
                ? formatBillNumber(
                    Number(selected.billNumber),
                    new Date(Number(selected.createdAt) / 1_000_000),
                  )
                : ""}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">Table</p>
                  <p className="font-medium">{selected.tableName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {formatTime(selected.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Mode</p>
                  <p className="font-medium">
                    {modeIcon[getDisplayMode(selected.settlementMode)] ??
                      "\uD83D\uDCB0"}{" "}
                    {getDisplayMode(selected.settlementMode)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cashier</p>
                  <p className="font-medium">
                    {selected.cashierName || "Admin"}
                  </p>
                </div>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr
                        key={item.name}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-right">
                          {Number(item.quantity)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          &#x20B9;{item.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1.5 border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>&#x20B9;{selected.subtotal.toFixed(2)}</span>
                </div>
                {selected.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-destructive">
                      -&#x20B9;{selected.discount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>&#x20B9;{selected.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">
                    &#x20B9;{selected.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              data-ocid="history.close_button"
              onClick={() => setSelected(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-settlement Modal */}
      <Dialog
        open={!!resettleTarget}
        onOpenChange={() => setResettleTarget(null)}
      >
        <DialogContent
          className="sm:max-w-md"
          data-ocid="history.resettle.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              Re-settle{" "}
              {resettleTarget
                ? formatBillNumber(Number(resettleTarget.billNumber))
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Current mode:{" "}
              <span className="font-medium text-foreground">
                {resettleTarget
                  ? getDisplayMode(resettleTarget.settlementMode)
                  : "Cash"}
              </span>
              . Select new settlement mode:
            </p>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  "Cash",
                  "HDFC Card",
                  "SBI Card",
                  "UPI",
                  "Split",
                ] as SettlementMode[]
              ).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setNewMode(mode)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    newMode === mode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {modeIcon[mode]}{" "}
                  {mode === "HDFC Card"
                    ? card1Name
                    : mode === "SBI Card"
                      ? card2Name
                      : mode}
                </button>
              ))}
            </div>
            {newMode === "Split" && resettleTarget && (
              <div className="space-y-2 border border-border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Split Amounts (Total: ₹{resettleTarget.total.toFixed(2)})
                </p>
                {(
                  [
                    ["cash", "💵 Cash"],
                    ["hdfc", `💳 ${card1Name}`],
                    ["sbi", `💳 ${card2Name}`],
                    ["upi", "📱 UPI"],
                  ] as [keyof typeof splitAmounts, string][]
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Label className="w-24 text-xs">{label}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={splitAmounts[key]}
                      onChange={(e) =>
                        setSplitAmounts((p) => ({
                          ...p,
                          [key]: e.target.value,
                        }))
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
                <div
                  className={`text-xs font-medium pt-1 ${Math.abs(splitTotal(splitAmounts) - resettleTarget.total) > 0.01 ? "text-destructive" : "text-green-600"}`}
                >
                  Entered: ₹{splitTotal(splitAmounts).toFixed(2)} / Required: ₹
                  {resettleTarget.total.toFixed(2)}
                </div>
              </div>
            )}
            {resettleTarget && (
              <div className="text-sm bg-muted/40 rounded-lg p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Table</span>
                  <span>{resettleTarget.tableName}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Amount</span>
                  <span className="text-primary">
                    &#x20B9;{resettleTarget.total.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setResettleTarget(null)}
              data-ocid="history.resettle.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResettle}
              disabled={resettling}
              data-ocid="history.resettle.confirm_button"
            >
              {resettling ? "Saving..." : "Confirm Re-settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="sm:max-w-md" data-ocid="history.edit.dialog">
          <DialogHeader>
            <DialogTitle>
              Edit{" "}
              {editTarget
                ? formatBillNumber(Number(editTarget.billNumber))
                : ""}
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Discount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-9"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(e.target.value)}
                  data-ocid="history.edit.discount_input"
                />
                <p className="text-xs text-muted-foreground">
                  New Total: ₹
                  {Math.max(
                    0,
                    editTarget.subtotal +
                      editTarget.taxAmount -
                      (Number(editDiscount) || 0),
                  ).toFixed(2)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Settlement Mode</Label>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      "Cash",
                      "HDFC Card",
                      "SBI Card",
                      "UPI",
                      "Split",
                    ] as SettlementMode[]
                  ).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEditMode(mode)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        editMode === mode
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {modeIcon[mode]}{" "}
                      {mode === "HDFC Card"
                        ? card1Name
                        : mode === "SBI Card"
                          ? card2Name
                          : mode}
                    </button>
                  ))}
                </div>
              </div>
              {editMode === "Split" && (
                <div className="space-y-2 border border-border rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Split Amounts (Total: ₹
                    {Math.max(
                      0,
                      editTarget.subtotal +
                        editTarget.taxAmount -
                        (Number(editDiscount) || 0),
                    ).toFixed(2)}
                    )
                  </p>
                  {(
                    [
                      ["cash", "💵 Cash"],
                      ["hdfc", `💳 ${card1Name}`],
                      ["sbi", `💳 ${card2Name}`],
                      ["upi", "📱 UPI"],
                    ] as [keyof typeof editSplit, string][]
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Label className="w-24 text-xs">{label}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={editSplit[key]}
                        onChange={(e) =>
                          setEditSplit((p) => ({ ...p, [key]: e.target.value }))
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              data-ocid="history.edit.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              data-ocid="history.edit.save_button"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm" data-ocid="history.delete.dialog">
          <DialogHeader>
            <DialogTitle>
              Delete{" "}
              {deleteTarget
                ? formatBillNumber(Number(deleteTarget.billNumber))
                : ""}
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete Bill{" "}
                <strong>
                  {formatBillNumber(Number(deleteTarget.billNumber))}
                </strong>{" "}
                for <strong>₹{deleteTarget.total.toFixed(2)}</strong> (
                {deleteTarget.tableName})? This cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              data-ocid="history.delete.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              data-ocid="history.delete.confirm_button"
            >
              {deleting ? "Deleting..." : "Delete Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Bills Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent data-ocid="history.clear.dialog">
          <DialogHeader>
            <DialogTitle>Clear All Bills</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong>all bills</strong> for this
            restaurant. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              data-ocid="history.clear.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearing}
              data-ocid="history.clear.confirm_button"
            >
              {clearing ? "Clearing..." : "Yes, Clear All Bills"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
