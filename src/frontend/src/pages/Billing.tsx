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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Page, SelectedOrder, SelectedTable } from "../App";
import type { Order, RestaurantSettings, Table } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";
import { useCardNames } from "../hooks/useCardNames";
import { formatBillNumber } from "../utils/billFormat";

type SettlementMode = "Cash" | "HDFC Card" | "SBI Card" | "UPI" | "Split";

interface Props {
  navigateTo: (page: Page) => void;
  selectedTable: SelectedTable | null;
  selectedOrder: SelectedOrder | null;
}

export function Billing({ navigateTo, selectedTable, selectedOrder }: Props) {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const { card1Name, card2Name } = useCardNames();
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [savedBillNumber, setSavedBillNumber] = useState<number | null>(null);
  const [settlementMode, setSettlementMode] = useState<SettlementMode>("Cash");
  const [splitCash, setSplitCash] = useState(0);
  const [splitHDFCCard, setSplitHDFCCard] = useState(0);
  const [splitSBICard, setSplitSBICard] = useState(0);
  const [splitUPI, setSplitUPI] = useState(0);

  // Running tables selector
  const [runningTables, setRunningTables] = useState<Table[]>([]);
  const [pickedTable, setPickedTable] = useState<Table | null>(null);
  const [pickedOrder, setPickedOrder] = useState<Order | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);

  // Effective table/order: either from props or from user selection
  const effectiveTable: SelectedTable | null =
    selectedTable ||
    (pickedTable ? { id: pickedTable.id, name: pickedTable.name } : null);

  // Load running tables when no table is selected from props
  useEffect(() => {
    if (!actor || isFetching || selectedTable) return;
    setLoadingTables(true);
    actor
      .getTables()
      .then((tables) => {
        const running = tables.filter(
          (t) =>
            t.status === "occupied" ||
            t.status === "ordered" ||
            t.status === "active" ||
            t.status === "kotSent",
        );
        setRunningTables(running);
        setLoadingTables(false);
      })
      .catch(() => setLoadingTables(false));
  }, [actor, isFetching, selectedTable]);

  // Load order for a selected running table
  const handlePickTable = async (table: Table) => {
    if (!actor) return;
    setPickedTable(table);
    setPickedOrder(null);
    try {
      const oRaw = await actor.getOrderByTable(table.id);
      let o: Order | null = null;
      if (oRaw != null) {
        if (Array.isArray(oRaw)) {
          o = oRaw.length > 0 ? (oRaw[0] as Order) : null;
        } else {
          o = oRaw as Order;
        }
      }
      if (!o) {
        toast.error(`No active order found for ${table.name}`);
        setPickedTable(null);
        return;
      }
      setPickedOrder(o);
    } catch {
      toast.error(`Failed to load order for ${table.name}`);
      setPickedTable(null);
    }
  };

  useEffect(() => {
    if (!actor || isFetching) return;
    if (!selectedTable) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      selectedOrder
        ? actor.getOrderByTable(selectedTable.id)
        : Promise.resolve(null),
      actor.getSettings(),
    ])
      .then(([oRaw, s]) => {
        let o: Order | null = null;
        if (oRaw != null) {
          if (Array.isArray(oRaw)) {
            o = oRaw.length > 0 ? (oRaw[0] as Order) : null;
          } else {
            o = oRaw as Order;
          }
        }
        setOrder(o);
        setSettings(s as RestaurantSettings);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Billing load error:", err);
        setLoading(false);
      });
  }, [actor, isFetching, selectedTable, selectedOrder]);

  // Load settings when using picked table path
  useEffect(() => {
    if (!actor || isFetching || selectedTable || !pickedOrder) return;
    actor
      .getSettings()
      .then((s) => setSettings(s as RestaurantSettings))
      .catch(() => {});
  }, [actor, isFetching, selectedTable, pickedOrder]);

  const activeOrder = selectedOrder ? order : pickedOrder;

  const subtotal = activeOrder
    ? activeOrder.items.reduce((s, i) => s + i.price * Number(i.quantity), 0)
    : 0;
  const taxRate = settings?.taxRate ?? 0;
  const taxAmount = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + taxAmount;

  // Split total entered
  const splitTotal = splitCash + splitHDFCCard + splitSBICard + splitUPI;
  const splitRemaining = Math.max(0, total - splitTotal);

  const handleFinalize = async () => {
    if (!actor || !activeOrder || !effectiveTable) return;

    // Validate split payment covers the total
    if (settlementMode === "Split" && splitTotal < total - 0.01) {
      toast.error(
        `Split total ₹${splitTotal.toFixed(2)} is less than bill total ₹${total.toFixed(2)}`,
      );
      return;
    }

    setSaving(true);
    try {
      const billItems = activeOrder.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        subtotal: i.price * Number(i.quantity),
      }));

      // Build settlement mode string — for Split include breakdown
      let modeString = settlementMode as string;
      if (settlementMode === "Split") {
        const parts: string[] = [];
        if (splitCash > 0) parts.push(`Cash:${splitCash.toFixed(2)}`);
        if (splitHDFCCard > 0) parts.push(`HDFC:${splitHDFCCard.toFixed(2)}`);
        if (splitSBICard > 0) parts.push(`SBI:${splitSBICard.toFixed(2)}`);
        if (splitUPI > 0) parts.push(`UPI:${splitUPI.toFixed(2)}`);
        modeString = `Split(${parts.join(",")})`;
      }

      const bill = await actor.createBill(
        activeOrder.id,
        effectiveTable.id,
        effectiveTable.name,
        billItems,
        subtotal,
        taxAmount,
        discount,
        total,
        modeString,
        "Admin",
        restaurantId,
      );
      await Promise.all([
        actor.updateOrderStatus(activeOrder.id, "billed"),
        actor.updateTableStatus(effectiveTable.id, "available"),
      ]);
      setSavedBillNumber(Number(bill.billNumber));
      toast.success("Bill saved successfully!");
      setShowPrint(true);
    } catch (err) {
      console.error("Bill generation error:", err);
      toast.error("Failed to generate bill. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  function sendBillOnWhatsApp() {
    const restaurantName = settings?.name || "Restaurant";
    const billNum = savedBillNumber ? formatBillNumber(savedBillNumber) : "—";
    const msg = `Dear Customer, your bill of ₹${total.toFixed(2)} at ${restaurantName} (Bill ${billNum}) via ${settlementMode} is attached. Thank you for dining with us!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // Show running tables picker when no table selected from nav
  if (!selectedTable && !selectedOrder && !pickedOrder) {
    if (loadingTables) {
      return (
        <div
          className="flex items-center justify-center h-64"
          data-ocid="billing.loading_tables"
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    return (
      <div className="space-y-5" data-ocid="billing.table_select">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Billing</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Select a running table to generate bill
          </p>
        </div>

        {runningTables.length === 0 ? (
          <div
            className="bg-card border border-border rounded-xl text-center py-16"
            data-ocid="billing.no_running_tables"
          >
            <p className="text-4xl mb-3">💰</p>
            <p className="text-muted-foreground">
              No tables with active orders right now.
            </p>
            <Button className="mt-4" onClick={() => navigateTo("orders")}>
              Go to Orders
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              {runningTables.length} running table(s)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {runningTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => handlePickTable(table)}
                  data-ocid={`billing.table_pick.${table.id}`}
                  className="bg-card border-2 border-primary/40 hover:border-primary rounded-xl p-5 text-left transition-all hover:shadow-md group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">👨‍🍳</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        table.status === "occupied"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {table.status}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{table.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Number(table.seats)} seats
                  </p>
                  <p className="text-xs text-primary mt-2 font-medium group-hover:underline">
                    Click to bill →
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading && selectedTable) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="billing.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!activeOrder) {
    return (
      <div
        className="bg-card border border-border rounded-xl text-center py-16"
        data-ocid="billing.no_order.empty_state"
      >
        <p className="text-muted-foreground">
          No active order for {effectiveTable?.name ?? "selected table"}
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            setPickedTable(null);
            setPickedOrder(null);
          }}
        >
          ← Back to Table Selection
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5" data-ocid="billing.page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Generate Bill</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {effectiveTable?.name} · Order #{activeOrder.id.slice(-6)}
          </p>
        </div>
        {!selectedTable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPickedTable(null);
              setPickedOrder(null);
            }}
          >
            ← Change Table
          </Button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Order Items</h3>
        </div>
        <table className="w-full text-sm" data-ocid="billing.table">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                Item
              </th>
              <th className="px-5 py-3 text-right text-muted-foreground font-medium">
                Qty
              </th>
              <th className="px-5 py-3 text-right text-muted-foreground font-medium">
                Rate
              </th>
              <th className="px-5 py-3 text-right text-muted-foreground font-medium">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {activeOrder.items.map((item, i) => (
              <tr
                key={item.menuItemId}
                data-ocid={`billing.item.${i + 1}`}
                className="border-b border-border last:border-0"
              >
                <td className="px-5 py-3 text-foreground">{item.name}</td>
                <td className="px-5 py-3 text-right text-foreground">
                  {Number(item.quantity)}
                </td>
                <td className="px-5 py-3 text-right text-foreground">
                  ₹{item.price.toFixed(2)}
                </td>
                <td className="px-5 py-3 text-right font-medium text-foreground">
                  ₹{(item.price * Number(item.quantity)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
        <div className="flex items-center gap-3">
          <Label className="w-32 flex-shrink-0">Discount (₹)</Label>
          <Input
            data-ocid="billing.discount.input"
            type="number"
            value={discount}
            onChange={(e) =>
              setDiscount(Number.parseFloat(e.target.value) || 0)
            }
            min="0"
            className="w-32"
          />
        </div>

        {/* Settlement Mode */}
        <div className="flex items-start gap-3">
          <Label className="w-32 flex-shrink-0 pt-2">Payment Mode</Label>
          <div className="space-y-3 flex-1">
            <div
              className="flex gap-2 flex-wrap"
              data-ocid="billing.settlement.select"
            >
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
                  onClick={() => setSettlementMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    settlementMode === mode
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

            {settlementMode === "Split" && (
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
                      value={splitHDFCCard || ""}
                      placeholder="0.00"
                      onChange={(e) =>
                        setSplitHDFCCard(Number(e.target.value) || 0)
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
                      value={splitSBICard || ""}
                      placeholder="0.00"
                      onChange={(e) =>
                        setSplitSBICard(Number(e.target.value) || 0)
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
                      onChange={(e) => setSplitUPI(Number(e.target.value) || 0)}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
                {/* Sub-totals summary */}
                <div className="border-t border-border pt-2 space-y-1">
                  {splitCash > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">💵 Cash</span>
                      <span className="font-medium text-green-600">
                        ₹{splitCash.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {splitHDFCCard > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        💳 {card1Name}
                      </span>
                      <span className="font-medium text-blue-600">
                        ₹{splitHDFCCard.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {splitSBICard > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        💳 {card2Name}
                      </span>
                      <span className="font-medium text-indigo-600">
                        ₹{splitSBICard.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {splitUPI > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">📱 UPI</span>
                      <span className="font-medium text-purple-600">
                        ₹{splitUPI.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-border pt-1 font-semibold">
                    <span>Total Entered</span>
                    <span
                      className={
                        splitTotal >= total - 0.01
                          ? "text-green-600"
                          : "text-destructive"
                      }
                    >
                      ₹{splitTotal.toFixed(2)}
                    </span>
                  </div>
                  {splitTotal < total - 0.01 && (
                    <div className="flex justify-between text-xs text-destructive">
                      <span>Remaining</span>
                      <span>₹{splitRemaining.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">₹{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-destructive">−₹{discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({taxRate}%)</span>
            <span className="text-foreground">₹{taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment Mode</span>
            <span className="font-medium text-foreground">
              {settlementMode}
            </span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>Grand Total</span>
            <span className="text-primary">₹{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <Button
        data-ocid="billing.finalize.button"
        className="w-full"
        size="lg"
        onClick={handleFinalize}
        disabled={saving}
      >
        {saving ? "Processing..." : "✅ Finalize & Save Bill"}
      </Button>

      {/* Print Modal */}
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent className="max-w-sm" data-ocid="billing.print.dialog">
          <DialogHeader>
            <DialogTitle>Bill Receipt</DialogTitle>
          </DialogHeader>
          <div className="print-bill font-mono text-xs space-y-2 py-2 border border-dashed rounded p-4">
            <div className="text-center space-y-0.5">
              <p className="font-bold text-sm">
                {settings?.name || "Restaurant"}
              </p>
              <p>{settings?.address}</p>
              {settings?.phone && <p>Tel: {settings.phone}</p>}
            </div>
            <div className="border-t border-dashed my-2 pt-2 space-y-1">
              {savedBillNumber && (
                <p>Bill No: {formatBillNumber(savedBillNumber)}</p>
              )}
              <p>Table: {effectiveTable?.name}</p>
              <p>Date: {new Date().toLocaleString()}</p>
              <p>Payment: {settlementMode}</p>
              {settlementMode === "Split" && (
                <div className="pl-2 space-y-0.5 mt-1">
                  {splitCash > 0 && <p> Cash: ₹{splitCash.toFixed(2)}</p>}
                  {splitHDFCCard > 0 && (
                    <p>
                      {" "}
                      {card1Name}: ₹{splitHDFCCard.toFixed(2)}
                    </p>
                  )}
                  {splitSBICard > 0 && (
                    <p>
                      {" "}
                      {card2Name}: ₹{splitSBICard.toFixed(2)}
                    </p>
                  )}
                  {splitUPI > 0 && <p> UPI: ₹{splitUPI.toFixed(2)}</p>}
                </div>
              )}
            </div>
            <div className="border-t border-dashed my-2 pt-2 space-y-1">
              <div className="flex justify-between font-bold border-b border-dashed pb-1">
                <span>Item</span>
                <span>Amt</span>
              </div>
              {activeOrder.items.map((item) => (
                <div key={item.menuItemId} className="flex justify-between">
                  <span>
                    {item.name} ×{Number(item.quantity)}
                  </span>
                  <span>
                    ₹{(item.price * Number(item.quantity)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax ({taxRate}%)</span>
                <span>₹{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
            {settings?.footerMessage && (
              <p className="text-center border-t border-dashed pt-2">
                {settings.footerMessage}
              </p>
            )}
          </div>
          <DialogFooter className="flex gap-2 flex-wrap">
            <Button
              data-ocid="billing.whatsapp.button"
              variant="outline"
              className="gap-1 text-green-600 border-green-600/30 hover:bg-green-600/10"
              onClick={sendBillOnWhatsApp}
            >
              📱 Send on WhatsApp
            </Button>
            <Button
              data-ocid="billing.print.button"
              variant="outline"
              onClick={() => window.print()}
            >
              🖨 Print Bill
            </Button>
            <Button
              data-ocid="billing.close.button"
              onClick={() => {
                setShowPrint(false);
                navigateTo("history");
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
