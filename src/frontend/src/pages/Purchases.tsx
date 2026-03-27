import { Badge } from "@/components/ui/badge";
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
import { ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PurchaseItem {
  lineId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  subtotal: number;
}

interface StoredPurchaseItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  subtotal: number;
}

interface Purchase {
  id: string;
  vendorId: string;
  vendorName: string;
  items: StoredPurchaseItem[];
  totalAmount: number;
  totalGST: number;
  date: number;
  paymentStatus: string;
  notes: string;
}

interface Vendor {
  id: string;
  name: string;
}

const STORAGE_KEY = "smartskale_purchases";
const VENDOR_KEY = "smartskale_vendors";
const PAYMENT_STATUSES = ["Paid", "Pending", "Partial"];
const UNITS = ["kg", "L", "pcs", "box"];
const GST_RATES = [0, 5, 12, 18, 28];

function loadPurchases(): Purchase[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadVendors(): Vendor[] {
  try {
    return JSON.parse(localStorage.getItem(VENDOR_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePurchases(list: Purchase[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function newLine(): PurchaseItem {
  return {
    lineId: Date.now().toString() + Math.random(),
    name: "",
    quantity: 1,
    unit: "pcs",
    unitPrice: 0,
    gstRate: 0,
    gstAmount: 0,
    subtotal: 0,
  };
}

function paymentBadgeVariant(status: string) {
  if (status === "Paid") return "default";
  if (status === "Partial") return "secondary";
  return "outline" as const;
}

export function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusDialogTarget, setStatusDialogTarget] = useState<Purchase | null>(
    null,
  );
  const [newStatus, setNewStatus] = useState("Paid");
  const [form, setForm] = useState({
    vendorId: "",
    vendorName: "",
    notes: "",
    paymentStatus: "Pending",
  });
  const [lineItems, setLineItems] = useState<PurchaseItem[]>([newLine()]);
  // Discount state for Add Purchase dialog
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [discountInput, setDiscountInput] = useState(0);

  useEffect(() => {
    setPurchases(loadPurchases());
    setVendors(loadVendors());
  }, []);

  const filteredPurchases = purchases.filter((p) => {
    if (!fromDate || !toDate) return true;
    const d = new Date(p.date);
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    return d >= from && d <= to;
  });

  const handleOpenDialog = () => {
    setVendors(loadVendors());
    setDiscountType("flat");
    setDiscountInput(0);
    setDialogOpen(true);
  };

  function updateLine(
    lineId: string,
    field: keyof PurchaseItem,
    value: string | number,
  ) {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.lineId !== lineId) return item;
        const next = { ...item, [field]: value };
        const baseAmt = next.quantity * next.unitPrice;
        next.gstAmount = baseAmt * (next.gstRate / 100);
        next.subtotal = baseAmt + next.gstAmount;
        return next;
      }),
    );
  }

  const totalAmount = lineItems.reduce((s, it) => s + it.subtotal, 0);
  const totalGST = lineItems.reduce((s, it) => s + it.gstAmount, 0);
  const discountAmount =
    discountType === "percent"
      ? (totalAmount * discountInput) / 100
      : discountInput;
  const netAmount = totalAmount - discountAmount;

  function handleAdd() {
    if (!form.vendorId || form.vendorId === "_") {
      toast.error("Select a vendor");
      return;
    }
    if (lineItems.some((it) => !it.name.trim())) {
      toast.error("All line items need a name");
      return;
    }
    const discountNote =
      discountAmount > 0
        ? `Discount: ${discountType === "percent" ? `${discountInput}%` : `₹${discountInput}`} (₹${discountAmount.toFixed(2)}) | `
        : "";
    const newP: Purchase = {
      id: Date.now().toString(),
      vendorId: form.vendorId,
      vendorName: form.vendorName,
      items: lineItems.map(({ lineId: _l, ...rest }) => rest),
      totalAmount: netAmount,
      totalGST,
      date: Date.now(),
      paymentStatus: form.paymentStatus,
      notes: discountNote + form.notes,
    };
    const updated = [newP, ...purchases];
    setPurchases(updated);
    savePurchases(updated);
    setDialogOpen(false);
    setForm({
      vendorId: "",
      vendorName: "",
      notes: "",
      paymentStatus: "Pending",
    });
    setLineItems([newLine()]);
    setDiscountInput(0);
    toast.success("Purchase added");
  }

  function handleUpdateStatus() {
    if (!statusDialogTarget) return;
    const updated = purchases.map((p) =>
      p.id === statusDialogTarget.id ? { ...p, paymentStatus: newStatus } : p,
    );
    setPurchases(updated);
    savePurchases(updated);
    setStatusDialogTarget(null);
    toast.success("Payment status updated");
  }

  return (
    <div className="space-y-5" data-ocid="purchases.page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Purchases</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {purchases.length} purchase records
          </p>
        </div>
        <Button data-ocid="purchases.add_button" onClick={handleOpenDialog}>
          + Add Purchase
        </Button>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          Date Range:
        </span>
        <div className="flex items-center gap-2">
          <Label htmlFor="pur-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="pur-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="purchases.from_date_input"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="pur-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="pur-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="purchases.to_date_input"
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
            data-ocid="purchases.clear_date_button"
          >
            ✕ Clear
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {purchases.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Total Purchases</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {purchases.length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-xl font-bold text-foreground mt-1">
              ₹{purchases.reduce((s, p) => s + p.totalAmount, 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Total GST Paid</p>
            <p className="text-xl font-bold text-primary mt-1">
              ₹{purchases.reduce((s, p) => s + (p.totalGST ?? 0), 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Purchases Table */}
      <div>
        {filteredPurchases.length === 0 ? (
          <div
            className="bg-card border border-border rounded-xl text-center py-16"
            data-ocid="purchases.empty_state"
          >
            <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No purchases yet</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm" data-ocid="purchases.table">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                    Items
                  </th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                    GST
                  </th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                    Net Amount
                  </th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                    Notes
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((p, i) => {
                  return (
                    <tr
                      key={p.id}
                      data-ocid={`purchases.row.${i + 1}`}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {p.vendorName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.items.length} item(s)
                      </td>
                      <td className="px-4 py-3 text-primary font-medium">
                        ₹{(p.totalGST ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        ₹{p.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(p.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={paymentBadgeVariant(p.paymentStatus)}>
                          {p.paymentStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.notes || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          data-ocid={`purchases.status_button.${i + 1}`}
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setStatusDialogTarget(p);
                            setNewStatus(p.paymentStatus);
                          }}
                        >
                          Update Status
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Purchase Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl" data-ocid="purchases.dialog">
          <DialogHeader>
            <DialogTitle>Add Purchase</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Vendor</Label>
                <Select
                  value={form.vendorId}
                  onValueChange={(v) => {
                    if (v === "_") return;
                    const vendor = vendors.find((vd) => vd.id === v);
                    setForm((p) => ({
                      ...p,
                      vendorId: v,
                      vendorName: vendor?.name ?? "",
                    }));
                  }}
                >
                  <SelectTrigger data-ocid="purchases.vendor_select">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.length === 0 ? (
                      <SelectItem value="_" disabled>
                        No vendors — add vendors first
                      </SelectItem>
                    ) : (
                      vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {vendors.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Go to Vendors page to add vendors first.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Payment Status</Label>
                <Select
                  value={form.paymentStatus}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, paymentStatus: v }))
                  }
                >
                  <SelectTrigger data-ocid="purchases.payment_status_select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-ocid="purchases.add_line_button"
                  onClick={() => setLineItems((p) => [...p, newLine()])}
                >
                  + Add Line
                </Button>
              </div>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Qty
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Unit
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Unit Price
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        GST %
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        GST Amt
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Subtotal
                      </th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr
                        key={item.lineId}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-2 py-2 min-w-[160px]">
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              updateLine(item.lineId, "name", e.target.value)
                            }
                            placeholder="Item name"
                            className="h-9 min-w-[150px]"
                          />
                        </td>
                        <td className="px-2 py-2 w-20">
                          <Input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={(e) =>
                              updateLine(
                                item.lineId,
                                "quantity",
                                Number(e.target.value) || 0,
                              )
                            }
                            className="h-9"
                          />
                        </td>
                        <td className="px-2 py-2 w-24">
                          <Select
                            value={item.unit}
                            onValueChange={(v) =>
                              updateLine(item.lineId, "unit", v)
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => (
                                <SelectItem key={u} value={u}>
                                  {u}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2 w-28">
                          <Input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateLine(
                                item.lineId,
                                "unitPrice",
                                Number(e.target.value) || 0,
                              )
                            }
                            className="h-9"
                          />
                        </td>
                        <td className="px-2 py-2 w-24">
                          <Select
                            value={String(item.gstRate)}
                            onValueChange={(v) =>
                              updateLine(item.lineId, "gstRate", Number(v))
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GST_RATES.map((r) => (
                                <SelectItem key={r} value={String(r)}>
                                  {r}%
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2 text-sm text-primary font-semibold whitespace-nowrap">
                          ₹{item.gstAmount.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-sm font-semibold whitespace-nowrap">
                          ₹{item.subtotal.toFixed(2)}
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() =>
                              setLineItems((p) =>
                                p.filter((it) => it.lineId !== item.lineId),
                              )
                            }
                            disabled={lineItems.length === 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Discount row */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
                  Discount:
                </span>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDiscountType("flat")}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      discountType === "flat"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Flat (₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={`px-2.5 py-1 text-xs font-medium border-l border-border transition-colors ${
                      discountType === "percent"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    %
                  </button>
                </div>
                <div className="relative w-28">
                  <Input
                    data-ocid="purchases.discount_input"
                    type="number"
                    min="0"
                    max={discountType === "percent" ? 100 : undefined}
                    value={discountInput}
                    onChange={(e) =>
                      setDiscountInput(Number.parseFloat(e.target.value) || 0)
                    }
                    className="h-9 pr-7 text-sm"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {discountType === "percent" ? "%" : "₹"}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <span className="text-xs text-green-600 font-medium">
                    = ₹{discountAmount.toFixed(2)} off
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-6 text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">
                  Total GST:{" "}
                  <span className="text-primary font-semibold">
                    ₹{totalGST.toFixed(2)}
                  </span>
                </span>
                {discountAmount > 0 && (
                  <span className="text-muted-foreground">
                    Gross Total:{" "}
                    <span className="line-through">
                      ₹{totalAmount.toFixed(2)}
                    </span>{" "}
                    <span className="text-destructive text-xs">
                      -₹{discountAmount.toFixed(2)}
                    </span>
                  </span>
                )}
                <span className="font-semibold">
                  Net Total: ₹{netAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                data-ocid="purchases.notes_input"
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-ocid="purchases.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} data-ocid="purchases.submit_button">
              Add Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog
        open={!!statusDialogTarget}
        onOpenChange={() => setStatusDialogTarget(null)}
      >
        <DialogContent data-ocid="purchases.status.dialog">
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vendor: <strong>{statusDialogTarget?.vendorName}</strong>
            </p>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger data-ocid="purchases.new_status_select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogTarget(null)}
              data-ocid="purchases.status.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStatus}
              data-ocid="purchases.status.confirm_button"
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
