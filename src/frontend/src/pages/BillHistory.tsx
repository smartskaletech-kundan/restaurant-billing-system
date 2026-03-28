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
import { useActorExtended as useActor } from "../hooks/useActorExtended";
import { useCardNames } from "../hooks/useCardNames";
import { formatBillNumber } from "../utils/billFormat";

function formatTime(createdAt: bigint) {
  const ms = Number(createdAt) / 1_000_000;
  return new Date(ms).toLocaleString();
}

const modeIcon: Record<string, string> = {
  Cash: "💵",
  Card: "💳",
  "HDFC Card": "💳",
  "SBI Card": "💳",
  UPI: "📱",
  Split: "🔀",
  Multi: "🔀",
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
  if (mode.startsWith("Multi(")) return "Multi";
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

type SettlementMode = "Cash" | "HDFC Card" | "SBI Card" | "UPI";

interface ResettleAmounts {
  cash: number;
  hdfc: number;
  sbi: number;
  upi: number;
}

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

  // Bill customer map from localStorage
  const [billCustomerMap, setBillCustomerMap] = useState<
    Record<
      string,
      { name: string; mobile: string; company: string; gstin: string }
    >
  >({});

  useEffect(() => {
    try {
      const map = JSON.parse(
        localStorage.getItem(`bill_customer_map_${restaurantId}`) || "{}",
      );
      setBillCustomerMap(map);
    } catch {
      setBillCustomerMap({});
    }
  }, [restaurantId]);

  // Re-settle
  const [resettleTarget, setResettleTarget] = useState<Bill | null>(null);
  const [resettleAmounts, setResettleAmounts] = useState<ResettleAmounts>({
    cash: 0,
    hdfc: 0,
    sbi: 0,
    upi: 0,
  });
  const [resettleEnabledModes, setResettleEnabledModes] = useState<Set<string>>(
    new Set(["cash"]),
  );
  const [resettling, setResettling] = useState(false);

  // Edit
  const [editTarget, setEditTarget] = useState<Bill | null>(null);
  const [editDiscount, setEditDiscount] = useState("");
  const [editMode, setEditMode] = useState<SettlementMode>("Cash");
  const [saving, setSaving] = useState(false);

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
    const bd = new Date(Number(b.createdAt) / 1_000_000);
    if (fromDate) {
      if (bd < new Date(`${fromDate}T00:00:00`)) return false;
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59`);
      if (bd > to) return false;
    }

    return true;
  });

  // Build re-settle mode string from amounts
  function buildResettleModeString(): string {
    const parts: string[] = [];
    if (resettleAmounts.cash > 0)
      parts.push(`Cash:${resettleAmounts.cash.toFixed(2)}`);
    if (resettleAmounts.hdfc > 0)
      parts.push(`HDFC:${resettleAmounts.hdfc.toFixed(2)}`);
    if (resettleAmounts.sbi > 0)
      parts.push(`SBI:${resettleAmounts.sbi.toFixed(2)}`);
    if (resettleAmounts.upi > 0)
      parts.push(`UPI:${resettleAmounts.upi.toFixed(2)}`);
    if (parts.length === 0) return "Cash";
    if (parts.length === 1) return parts[0].split(":")[0];
    return `Multi(${parts.join(",")})`;
  }

  function resettleAmountsTotal() {
    return (
      resettleAmounts.cash +
      resettleAmounts.hdfc +
      resettleAmounts.sbi +
      resettleAmounts.upi
    );
  }

  function toggleResettleMode(key: keyof ResettleAmounts, checked: boolean) {
    setResettleEnabledModes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else {
        next.delete(key);
        setResettleAmounts((p) => ({ ...p, [key]: 0 }));
      }
      return next;
    });
  }

  const handleResettle = async () => {
    if (!actor || !resettleTarget) return;
    const total = resettleAmountsTotal();
    if (total <= 0) {
      toast.error("Please enter at least one payment amount.");
      return;
    }
    const modeString = buildResettleModeString();
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
      setResettleAmounts({ cash: 0, hdfc: 0, sbi: 0, upi: 0 });
      setResettleEnabledModes(new Set(["cash"]));
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
  }

  const handleSaveEdit = async () => {
    if (!actor || !editTarget) return;
    const discount = Number(editDiscount) || 0;
    const newTotal = editTarget.subtotal + editTarget.taxAmount - discount;
    if (newTotal < 0) {
      toast.error("Discount cannot exceed bill total");
      return;
    }
    let modeString = editMode as string;
    if (editMode === "HDFC Card") modeString = "HDFC Card";
    else if (editMode === "SBI Card") modeString = "SBI Card";
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

  const handleClearAll = async () => {
    if (!actor) return;
    setClearing(true);
    try {
      await actor.clearRestaurantBillsAndReset(restaurantId);
      setBills([]);
      setShowClearDialog(false);
      toast.success("All bills cleared. Invoice counter reset to 01.");
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

  const resettleModeRows: Array<{
    key: keyof ResettleAmounts;
    label: string;
    icon: string;
  }> = [
    { key: "cash", label: "Cash", icon: "💵" },
    { key: "hdfc", label: card1Name, icon: "💳" },
    { key: "sbi", label: card2Name, icon: "💳" },
    { key: "upi", label: "UPI", icon: "📱" },
  ];

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
            <p className="text-4xl mb-2">📜</p>
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
                    Customer
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
                  const cust = billCustomerMap[bill.id];
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
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {cust?.name ? (
                          <div>
                            <p className="font-medium text-foreground">
                              {cust.name}
                            </p>
                            {cust.mobile && <p>{cust.mobile}</p>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
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
                          {modeIcon[displayMode] ?? "💰"} {displayMode}
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
                              setResettleAmounts({
                                cash: 0,
                                hdfc: 0,
                                sbi: 0,
                                upi: 0,
                              });
                              setResettleEnabledModes(new Set(["cash"]));
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
                                : "Can only edit bills from current month"
                            }
                            onClick={() => canModify && openEdit(bill)}
                            data-ocid={`history.edit_button.${i + 1}`}
                          >
                            ✏️ Edit
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
          {selected &&
            (() => {
              const cust = billCustomerMap[selected.id];
              return (
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
                          "💰"}{" "}
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

                  {/* Customer details if available */}
                  {cust && (cust.name || cust.mobile) && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                        👤 Customer Details
                      </p>
                      {cust.name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium">{cust.name}</span>
                        </div>
                      )}
                      {cust.mobile && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mobile</span>
                          <span>{cust.mobile}</span>
                        </div>
                      )}
                      {cust.company && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Company</span>
                          <span>{cust.company}</span>
                        </div>
                      )}
                      {cust.gstin && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GSTIN</span>
                          <span className="font-mono text-xs">
                            {cust.gstin}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

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
                    {/* Payment breakdown for Multi/Split */}
                    {(selected.settlementMode.startsWith("Multi(") ||
                      selected.settlementMode.startsWith("Split(")) && (
                      <div className="border-t border-border pt-2 mt-1 space-y-1">
                        <p className="text-xs text-muted-foreground font-semibold">
                          Payment Breakdown
                        </p>
                        {selected.settlementMode
                          .replace(/^(Multi|Split)\(/, "")
                          .replace(/\)$/, "")
                          .split(",")
                          .map((part) => {
                            const [k, v] = part.split(":");
                            return (
                              <div
                                key={k}
                                className="flex justify-between text-xs"
                              >
                                <span className="text-muted-foreground">
                                  {k}
                                </span>
                                <span className="font-medium">
                                  ₹{Number(v).toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                      <span>Total</span>
                      <span className="text-primary">
                        &#x20B9;{selected.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
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
        onOpenChange={() => {
          setResettleTarget(null);
          setResettleAmounts({ cash: 0, hdfc: 0, sbi: 0, upi: 0 });
          setResettleEnabledModes(new Set(["cash"]));
        }}
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
            {resettleTarget && (
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Mode</span>
                  <span className="font-medium">
                    {getDisplayMode(resettleTarget.settlementMode)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Bill Amount</span>
                  <span className="text-primary">
                    ₹{resettleTarget.total.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Select one or more payment modes and enter amounts:
            </p>
            <div className="space-y-2 bg-muted/30 rounded-xl p-3 border border-border">
              {resettleModeRows.map(({ key, label, icon }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`resettle-mode-${key}`}
                    checked={resettleEnabledModes.has(key)}
                    onChange={(e) => toggleResettleMode(key, e.target.checked)}
                    className="h-4 w-4 flex-shrink-0"
                  />
                  <Label
                    htmlFor={`resettle-mode-${key}`}
                    className="w-28 flex-shrink-0 text-sm font-medium cursor-pointer"
                  >
                    {icon} {label}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={resettleAmounts[key] || ""}
                    disabled={!resettleEnabledModes.has(key)}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setResettleAmounts((p) => ({ ...p, [key]: val }));
                      if (val > 0 && !resettleEnabledModes.has(key)) {
                        setResettleEnabledModes(
                          (prev) => new Set([...prev, key]),
                        );
                      }
                    }}
                    className="h-9 flex-1"
                  />
                </div>
              ))}
            </div>

            {/* Running total */}
            <div className="space-y-1 border border-border rounded-lg p-3 bg-card text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Entered</span>
                <span
                  className={`font-semibold ${
                    resettleTarget &&
                    resettleAmountsTotal() >= resettleTarget.total - 0.01
                      ? "text-green-600"
                      : "text-amber-600"
                  }`}
                >
                  ₹{resettleAmountsTotal().toFixed(2)}
                </span>
              </div>
              {resettleTarget &&
                resettleAmountsTotal() < resettleTarget.total - 0.01 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Balance</span>
                    <span>
                      ₹
                      {(resettleTarget.total - resettleAmountsTotal()).toFixed(
                        2,
                      )}
                    </span>
                  </div>
                )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResettleTarget(null);
                setResettleAmounts({ cash: 0, hdfc: 0, sbi: 0, upi: 0 });
                setResettleEnabledModes(new Set(["cash"]));
              }}
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
                    ["Cash", "HDFC Card", "SBI Card", "UPI"] as SettlementMode[]
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
                      {mode === "Cash" && "💵 "}
                      {(mode === "HDFC Card" || mode === "SBI Card") && "💳 "}
                      {mode === "UPI" && "📱 "}
                      {mode === "HDFC Card"
                        ? card1Name
                        : mode === "SBI Card"
                          ? card2Name
                          : mode}
                    </button>
                  ))}
                </div>
              </div>
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

      {/* Clear All Bills Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent data-ocid="history.clear.dialog">
          <DialogHeader>
            <DialogTitle>Clear All Bills</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong>all bills</strong> for this
            restaurant and reset the invoice counter to <strong>01</strong>.
            This cannot be undone.
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
              {clearing ? "Clearing..." : "Yes, Clear All & Reset Counter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
