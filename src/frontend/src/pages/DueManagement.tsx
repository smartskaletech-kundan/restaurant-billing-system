import { Badge } from "@/components/ui/badge";
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
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRestaurant } from "../context/RestaurantContext";
import { useCardNames } from "../hooks/useCardNames";

interface PartialDue {
  id: string;
  billId: string;
  billNumber: number;
  tableName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMode: string;
  customerName: string;
  customerMobile: string;
  customerCompany: string;
  customerGSTIN: string;
  createdAt: string;
  settled: boolean;
}

type SettleMode = "Cash" | "HDFC Card" | "SBI Card" | "UPI" | "Split";

export function DueManagement() {
  const { restaurantId } = useRestaurant();
  const { card1Name, card2Name } = useCardNames();

  const [dues, setDues] = useState<PartialDue[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`partial_dues_${restaurantId}`) || "[]",
      ) as PartialDue[];
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState("");
  const [settlingDue, setSettlingDue] = useState<PartialDue | null>(null);
  const [settleMode, setSettleMode] = useState<SettleMode>("Cash");
  const [settleAmount, setSettleAmount] = useState(0);
  // Split fields
  const [splitCash, setSplitCash] = useState(0);
  const [splitHDFC, setSplitHDFC] = useState(0);
  const [splitSBI, setSplitSBI] = useState(0);
  const [splitUPI, setSplitUPI] = useState(0);
  const [showSettled, setShowSettled] = useState(false);

  const pendingDues = dues.filter((d) => !d.settled);
  const settledDues = dues.filter((d) => d.settled);
  const totalOutstanding = pendingDues.reduce((s, d) => s + d.dueAmount, 0);

  const filtered = (showSettled ? dues : pendingDues).filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.customerName.toLowerCase().includes(q) ||
      d.customerMobile.includes(q) ||
      d.tableName.toLowerCase().includes(q) ||
      d.customerCompany.toLowerCase().includes(q)
    );
  });

  function openSettle(due: PartialDue) {
    setSettlingDue(due);
    setSettleMode("Cash");
    setSettleAmount(due.dueAmount);
    setSplitCash(0);
    setSplitHDFC(0);
    setSplitSBI(0);
    setSplitUPI(0);
  }

  function confirmSettlement() {
    if (!settlingDue) return;

    if (settleMode === "Split") {
      const splitTotal = splitCash + splitHDFC + splitSBI + splitUPI;
      if (splitTotal < settlingDue.dueAmount - 0.01) {
        toast.error(
          `Split total ₹${splitTotal.toFixed(2)} is less than due ₹${settlingDue.dueAmount.toFixed(2)}`,
        );
        return;
      }
    }

    const updated = dues.map((d) =>
      d.id === settlingDue.id
        ? {
            ...d,
            settled: true,
            paidAmount: d.totalAmount,
            dueAmount: 0,
            paymentMode:
              settleMode === "Split"
                ? `Split(Cash:${splitCash},HDFC:${splitHDFC},SBI:${splitSBI},UPI:${splitUPI})`
                : settleMode,
          }
        : d,
    );
    setDues(updated);
    localStorage.setItem(
      `partial_dues_${restaurantId}`,
      JSON.stringify(updated),
    );
    toast.success(
      `Due of ₹${settlingDue.dueAmount.toFixed(2)} for ${settlingDue.customerName || settlingDue.tableName} settled!`,
    );
    setSettlingDue(null);
  }

  const splitTotal = splitCash + splitHDFC + splitSBI + splitUPI;

  return (
    <div className="space-y-5" data-ocid="due.page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Due Management</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Partial payments &amp; outstanding dues
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettled(!showSettled)}
          data-ocid="due.toggle_settled.button"
        >
          {showSettled ? "Hide Settled" : "Show All"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-ocid="due.outstanding.card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">
              ₹{totalOutstanding.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card data-ocid="due.pending_count.card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Dues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {pendingDues.length}
            </p>
          </CardContent>
        </Card>
        <Card data-ocid="due.settled_count.card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Settled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {settledDues.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Input
        data-ocid="due.search_input"
        placeholder="Search by customer name, mobile, table, company..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9"
      />

      {/* Table */}
      <div
        className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        data-ocid="due.table"
      >
        {filtered.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="due.empty_state"
          >
            <AlertCircle className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>
              {pendingDues.length === 0
                ? "No outstanding dues. All settled! 🎉"
                : "No dues match your search."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "Bill #",
                    "Table",
                    "Customer",
                    "Mobile",
                    "Company",
                    "Total Bill",
                    "Paid",
                    "Due Amount",
                    "Date",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-muted-foreground font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr
                    key={d.id}
                    data-ocid={`due.item.${i + 1}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      #{d.billNumber}
                    </td>
                    <td className="px-4 py-3">{d.tableName}</td>
                    <td className="px-4 py-3 font-medium">
                      {d.customerName || (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.customerMobile || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.customerCompany || "—"}
                    </td>
                    <td className="px-4 py-3">₹{d.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">
                      ₹{d.paidAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-destructive">
                      {d.settled ? (
                        <span className="text-green-600">₹0.00</span>
                      ) : (
                        `₹${d.dueAmount.toFixed(2)}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {d.settled ? (
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-600/30 bg-green-50"
                        >
                          Settled
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Pending</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!d.settled && (
                        <Button
                          data-ocid={`due.settle_button.${i + 1}`}
                          size="sm"
                          onClick={() => openSettle(d)}
                        >
                          Settle Due
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settle Due Dialog */}
      <Dialog
        open={!!settlingDue}
        onOpenChange={(open) => !open && setSettlingDue(null)}
      >
        <DialogContent className="max-w-lg" data-ocid="due.settle.dialog">
          <DialogHeader>
            <DialogTitle>
              Settle Due for{" "}
              {settlingDue?.customerName ||
                settlingDue?.tableName ||
                "Customer"}{" "}
              — Due: ₹{settlingDue?.dueAmount.toFixed(2)}
            </DialogTitle>
          </DialogHeader>

          {settlingDue && (
            <div className="space-y-4">
              {/* Customer Info Summary */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
                {settlingDue.customerName && (
                  <p>
                    <span className="text-muted-foreground">Customer:</span>{" "}
                    <span className="font-medium">
                      {settlingDue.customerName}
                    </span>
                  </p>
                )}
                {settlingDue.customerMobile && (
                  <p>
                    <span className="text-muted-foreground">Mobile:</span>{" "}
                    {settlingDue.customerMobile}
                  </p>
                )}
                {settlingDue.customerCompany && (
                  <p>
                    <span className="text-muted-foreground">Company:</span>{" "}
                    {settlingDue.customerCompany}
                  </p>
                )}
                {settlingDue.customerGSTIN && (
                  <p>
                    <span className="text-muted-foreground">GSTIN:</span>{" "}
                    <span className="font-mono">
                      {settlingDue.customerGSTIN}
                    </span>
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">Table:</span>{" "}
                  {settlingDue.tableName}
                </p>
                <p>
                  <span className="text-muted-foreground">Original Bill:</span>{" "}
                  ₹{settlingDue.totalAmount.toFixed(2)} | Already Paid: ₹
                  {settlingDue.paidAmount.toFixed(2)}
                </p>
              </div>

              {/* Amount to Settle */}
              <div className="space-y-1">
                <Label>Amount to Settle</Label>
                <Input
                  type="number"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(Number(e.target.value) || 0)}
                  className="h-9"
                  data-ocid="due.settle_amount.input"
                />
              </div>

              {/* Payment Mode */}
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <div
                  className="flex gap-2 flex-wrap"
                  data-ocid="due.settle_mode.select"
                >
                  {(
                    [
                      "Cash",
                      "HDFC Card",
                      "SBI Card",
                      "UPI",
                      "Split",
                    ] as SettleMode[]
                  ).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSettleMode(mode)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        settleMode === mode
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {mode === "Cash" && "💵 "}
                      {(mode === "HDFC Card" || mode === "SBI Card") && "💳 "}
                      {mode === "UPI" && "📱 "}
                      {mode === "Split" && "🔀 "}
                      {mode === "HDFC Card"
                        ? card1Name
                        : mode === "SBI Card"
                          ? card2Name
                          : mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split breakdown */}
              {settleMode === "Split" && (
                <div className="bg-muted/40 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Split Payment Breakdown
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        💵 Cash
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={splitCash || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          setSplitCash(Number(e.target.value) || 0)
                        }
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        💳 {card1Name}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={splitHDFC || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          setSplitHDFC(Number(e.target.value) || 0)
                        }
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        💳 {card2Name}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={splitSBI || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          setSplitSBI(Number(e.target.value) || 0)
                        }
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        📱 UPI
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={splitUPI || ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          setSplitUPI(Number(e.target.value) || 0)
                        }
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="border-t border-border pt-2 space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Total Entered</span>
                      <span
                        className={
                          splitTotal >= (settlingDue?.dueAmount ?? 0) - 0.01
                            ? "text-green-600"
                            : "text-destructive"
                        }
                      >
                        ₹{splitTotal.toFixed(2)}
                      </span>
                    </div>
                    {splitTotal < (settlingDue?.dueAmount ?? 0) - 0.01 && (
                      <div className="flex justify-between text-xs text-destructive">
                        <span>Remaining</span>
                        <span>
                          ₹
                          {((settlingDue?.dueAmount ?? 0) - splitTotal).toFixed(
                            2,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSettlingDue(null)}
              data-ocid="due.settle.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSettlement}
              data-ocid="due.settle.confirm_button"
            >
              ✅ Confirm Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
