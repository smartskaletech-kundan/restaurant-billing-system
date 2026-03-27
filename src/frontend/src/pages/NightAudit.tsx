import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  FileText,
  History,
  Loader2,
  Moon,
  Printer,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Bill } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";

interface AuditRecord {
  id: string;
  date: string;
  totalSales: number;
  totalBills: number;
  totalExpenses: number;
  totalPurchases: number;
  cashTotal: number;
  cardTotal: number;
  upiTotal: number;
  splitTotal: number;
  note: string;
  closedAt: string;
  restaurantId: string;
  // New reconciliation fields (optional for backward compat)
  cashHandover?: number;
  cashVariance?: number;
  openingCash?: number;
  shiftRemarks?: string;
  closingStaff?: string;
}

interface ExpenseRecord {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: number;
  paidBy: string;
}

interface PurchaseRecord {
  id: string;
  vendorName: string;
  date: number;
  totalAmount: number;
  netTotal: number;
}

function isSameDay(msTimestamp: number, dateStr: string): boolean {
  const d = new Date(msTimestamp);
  const target = new Date(dateStr);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

function VarianceBadge({
  variance,
  currency,
}: {
  variance: number;
  currency: string;
}) {
  if (variance === 0)
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
        Balanced
      </Badge>
    );
  if (variance < 0)
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        Short {currency}
        {Math.abs(variance).toFixed(2)}
      </Badge>
    );
  return (
    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
      Over {currency}
      {variance.toFixed(2)}
    </Badge>
  );
}

export default function NightAudit() {
  const { restaurantId } = useRestaurant();
  const { actor, isFetching } = useActor();

  const currency =
    JSON.parse(
      localStorage.getItem(`smartskale_settings_${restaurantId}`) || "{}",
    ).currency || "₹";

  const todayStr = new Date().toISOString().split("T")[0];

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [audits, setAudits] = useState<AuditRecord[]>([]);

  // Reconciliation form state
  const [openingCash, setOpeningCash] = useState(0);
  const [cashHandover, setCashHandover] = useState(0);
  const [shiftRemarks, setShiftRemarks] = useState("");
  const [closingStaff, setClosingStaff] = useState("");

  // Load bills from backend
  useEffect(() => {
    if (!actor || isFetching) return;
    (async () => {
      try {
        const result = await (actor as any).getBillsByRestaurant(restaurantId);
        setBills(result || []);
      } catch (e) {
        console.error("Failed to load bills", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [actor, isFetching, restaurantId]);

  // Load audit history
  useEffect(() => {
    const stored = localStorage.getItem(
      `smartskale_night_audits_${restaurantId}`,
    );
    if (stored) {
      try {
        setAudits(JSON.parse(stored));
      } catch {}
    }
  }, [restaurantId]);

  // Compute today's data
  const todayBills = bills.filter((b) => {
    const ms = Number(b.createdAt) / 1_000_000;
    return isSameDay(ms, todayStr);
  });

  const totalSales = todayBills.reduce((sum, b) => sum + Number(b.total), 0);
  const totalBillsCount = todayBills.length;

  const cashTotal = todayBills
    .filter((b) => (b.settlementMode || "") === "cash")
    .reduce((s, b) => s + Number(b.total), 0);
  const cardTotal = todayBills
    .filter((b) => (b.settlementMode || "") === "card")
    .reduce((s, b) => s + Number(b.total), 0);
  const upiTotal = todayBills
    .filter((b) => (b.settlementMode || "") === "upi")
    .reduce((s, b) => s + Number(b.total), 0);
  const splitTotal = todayBills
    .filter((b) => (b.settlementMode || "") === "split")
    .reduce((s, b) => s + Number(b.total), 0);

  // Expenses today
  const expenses: ExpenseRecord[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("smartskale_expenses") || "[]");
    } catch {
      return [];
    }
  })();
  const totalExpenses = expenses
    .filter((e) => isSameDay(e.date, todayStr))
    .reduce((s, e) => s + Number(e.amount), 0);

  // Purchases today
  const purchases: PurchaseRecord[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("smartskale_purchases") || "[]");
    } catch {
      return [];
    }
  })();
  const totalPurchases = purchases
    .filter((p) => isSameDay(p.date, todayStr))
    .reduce((s, p) => s + Number(p.netTotal || p.totalAmount || 0), 0);

  // Open tables warning
  const openOrders: any[] = (() => {
    try {
      return JSON.parse(localStorage.getItem("smartskale_orders") || "[]");
    } catch {
      return [];
    }
  })();
  const hasOpenTables = openOrders.some(
    (o) => o.status === "active" || o.status === "running",
  );

  // Cash reconciliation computed values
  const expectedCash = openingCash + cashTotal;
  const cashVariance = cashHandover - expectedCash;

  function handleCloseDay() {
    // Reset form fields
    setOpeningCash(0);
    setCashHandover(0);
    setShiftRemarks("");
    setClosingStaff("");
    setConfirmOpen(true);
  }

  async function confirmClose() {
    setIsClosing(true);
    const audit: AuditRecord = {
      id: `audit_${Date.now()}`,
      date: todayStr,
      totalSales,
      totalBills: totalBillsCount,
      totalExpenses,
      totalPurchases,
      cashTotal,
      cardTotal,
      upiTotal,
      splitTotal,
      note: shiftRemarks,
      closedAt: new Date().toLocaleString(),
      restaurantId,
      cashHandover,
      cashVariance,
      openingCash,
      shiftRemarks,
      closingStaff,
    };
    const updated = [audit, ...audits];
    localStorage.setItem(
      `smartskale_night_audits_${restaurantId}`,
      JSON.stringify(updated),
    );
    setAudits(updated);
    setConfirmOpen(false);
    setIsClosing(false);
    toast.success("Day closed successfully! Night audit record saved.");
  }

  const isTodayAlreadyClosed = audits.some((a) => a.date === todayStr);
  const todayAudit = audits.find((a) => a.date === todayStr);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Moon className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Night Audit</h1>
            <p className="text-sm text-muted-foreground">
              Close restaurant for the day —{" "}
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
        {isTodayAlreadyClosed ? (
          <Badge className="bg-green-500/20 text-green-400 gap-1 px-3 py-1">
            <CheckCircle className="h-4 w-4" /> Day Closed
          </Badge>
        ) : (
          <Button
            data-ocid="night_audit.close_day.button"
            onClick={handleCloseDay}
            className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            disabled={loading}
          >
            <Moon className="h-4 w-4" />
            Close Restaurant for the Day
          </Button>
        )}
      </div>

      {/* Open tables warning */}
      {hasOpenTables && (
        <div
          data-ocid="night_audit.open_tables.error_state"
          className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
        >
          <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-300">
              Open Tables Detected
            </p>
            <p className="text-sm text-yellow-400/80">
              There are active orders running. Please settle all tables before
              closing the day.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary" data-ocid="night_audit.summary.tab">
            Today's Summary
          </TabsTrigger>
          <TabsTrigger value="history" data-ocid="night_audit.history.tab">
            Audit History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-6">
          {loading ? (
            <div
              data-ocid="night_audit.loading_state"
              className="flex items-center gap-3 text-muted-foreground py-12 justify-center"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading today's data...
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card data-ocid="night_audit.total_sales.card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Total Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-primary">
                      {currency}
                      {totalSales.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalBillsCount} bills today
                    </p>
                  </CardContent>
                </Card>

                <Card data-ocid="night_audit.total_bills.card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Total Bills
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-foreground">
                      {totalBillsCount}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avg: {currency}
                      {totalBillsCount > 0
                        ? (totalSales / totalBillsCount).toFixed(2)
                        : "0.00"}
                    </p>
                  </CardContent>
                </Card>

                <Card data-ocid="night_audit.total_expenses.card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-400">
                      {currency}
                      {totalExpenses.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </CardContent>
                </Card>

                <Card data-ocid="night_audit.total_purchases.card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" /> Purchases
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-orange-400">
                      {currency}
                      {totalPurchases.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment mode breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Payment Mode Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-xs text-muted-foreground mb-1">Cash</p>
                      <p className="text-lg font-bold text-green-400">
                        {currency}
                        {cashTotal.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <p className="text-xs text-muted-foreground mb-1">Card</p>
                      <p className="text-lg font-bold text-blue-400">
                        {currency}
                        {cardTotal.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <p className="text-xs text-muted-foreground mb-1">UPI</p>
                      <p className="text-lg font-bold text-purple-400">
                        {currency}
                        {upiTotal.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <p className="text-xs text-muted-foreground mb-1">
                        Split
                      </p>
                      <p className="text-lg font-bold text-orange-400">
                        {currency}
                        {splitTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Today's Handover Status (if already closed) */}
              {isTodayAlreadyClosed &&
                todayAudit &&
                todayAudit.cashHandover !== undefined && (
                  <Card
                    data-ocid="night_audit.handover_status.card"
                    className="border-primary/30"
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        Today's Handover Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Opening Float</p>
                          <p className="font-semibold">
                            {currency}
                            {(todayAudit.openingCash ?? 0).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Actual Handover
                          </p>
                          <p className="font-semibold">
                            {currency}
                            {(todayAudit.cashHandover ?? 0).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Variance</p>
                          <VarianceBadge
                            variance={todayAudit.cashVariance ?? 0}
                            currency={currency}
                          />
                        </div>
                        <div>
                          <p className="text-muted-foreground">Closed By</p>
                          <p className="font-semibold">
                            {todayAudit.closingStaff || "—"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

              {/* Net position */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Net Position (Sales - Expenses - Purchases)
                      </p>
                      <p className="text-3xl font-bold mt-1 text-foreground">
                        {currency}
                        {(
                          totalSales -
                          totalExpenses -
                          totalPurchases
                        ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <ShoppingBag className="h-10 w-10 text-primary/30" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {audits.length === 0 ? (
            <div
              data-ocid="night_audit.history.empty_state"
              className="text-center py-16 text-muted-foreground"
            >
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>
                No audit records yet. Close the day to create your first record.
              </p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Total Sales</TableHead>
                      <TableHead>Bills</TableHead>
                      <TableHead>Expenses</TableHead>
                      <TableHead>Purchases</TableHead>
                      <TableHead>Closed At</TableHead>
                      <TableHead>Reconciliation</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audits.map((a, idx) => (
                      <TableRow
                        key={a.id}
                        data-ocid={`night_audit.history.item.${idx + 1}`}
                      >
                        <TableCell className="font-medium">{a.date}</TableCell>
                        <TableCell className="text-green-400 font-semibold">
                          {currency}
                          {Number(a.totalSales).toFixed(2)}
                        </TableCell>
                        <TableCell>{a.totalBills}</TableCell>
                        <TableCell className="text-red-400">
                          {currency}
                          {Number(a.totalExpenses).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-orange-400">
                          {currency}
                          {Number(a.totalPurchases).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {a.closedAt}
                        </TableCell>
                        <TableCell>
                          {a.cashHandover !== undefined ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  data-ocid={`night_audit.history.reconciliation.${idx + 1}`}
                                  className="text-left text-sm hover:underline cursor-pointer"
                                >
                                  <span className="text-muted-foreground">
                                    Cash: {currency}
                                    {Number(a.cashHandover).toFixed(2)}
                                  </span>
                                  {" | "}
                                  <VarianceBadge
                                    variance={a.cashVariance ?? 0}
                                    currency={currency}
                                  />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-72 text-sm space-y-2 p-4"
                                align="start"
                              >
                                <p className="font-semibold text-base mb-2 flex items-center gap-1">
                                  <Wallet className="h-4 w-4" /> Cash
                                  Reconciliation
                                </p>
                                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                                  <span className="text-muted-foreground">
                                    Opening Float
                                  </span>
                                  <span className="font-medium">
                                    {currency}
                                    {Number(a.openingCash ?? 0).toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    System Cash Sales
                                  </span>
                                  <span className="font-medium">
                                    {currency}
                                    {Number(a.cashTotal).toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    Expected Cash
                                  </span>
                                  <span className="font-medium">
                                    {currency}
                                    {(
                                      Number(a.openingCash ?? 0) +
                                      Number(a.cashTotal)
                                    ).toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    Actual Handover
                                  </span>
                                  <span className="font-medium">
                                    {currency}
                                    {Number(a.cashHandover ?? 0).toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    Variance
                                  </span>
                                  <VarianceBadge
                                    variance={a.cashVariance ?? 0}
                                    currency={currency}
                                  />
                                </div>
                                <div className="border-t pt-2 mt-1 space-y-1">
                                  <p className="font-semibold flex items-center gap-1">
                                    <User className="h-3.5 w-3.5" /> Shift
                                    Details
                                  </p>
                                  <p className="text-muted-foreground">
                                    Staff:{" "}
                                    <span className="text-foreground">
                                      {a.closingStaff || "—"}
                                    </span>
                                  </p>
                                  {a.shiftRemarks && (
                                    <p className="text-muted-foreground">
                                      Remarks:{" "}
                                      <span className="text-foreground">
                                        {a.shiftRemarks}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {a.note || "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            data-ocid={`night_audit.history.print.${idx + 1}`}
                            onClick={() => {
                              const w = window.open("", "_blank");
                              if (!w) return;
                              const hasRecon = a.cashHandover !== undefined;
                              const expectedC =
                                Number(a.openingCash ?? 0) +
                                Number(a.cashTotal);
                              const varAmt = Number(a.cashVariance ?? 0);
                              const varLabel =
                                varAmt === 0
                                  ? "Balanced"
                                  : varAmt > 0
                                    ? "Over"
                                    : "Short";
                              w.document.write(`
                                <html><body style="font-family:monospace;padding:24px;max-width:400px">
                                <h2 style="text-align:center">NIGHT AUDIT REPORT</h2>
                                <p><b>Date:</b> ${a.date}</p>
                                <p><b>Closed At:</b> ${a.closedAt}</p>
                                <hr/>
                                <h3>SALES SUMMARY</h3>
                                <p><b>Total Sales:</b> ${currency}${Number(a.totalSales).toFixed(2)}</p>
                                <p><b>Total Bills:</b> ${a.totalBills}</p>
                                <p><b>Total Expenses:</b> ${currency}${Number(a.totalExpenses).toFixed(2)}</p>
                                <p><b>Total Purchases:</b> ${currency}${Number(a.totalPurchases).toFixed(2)}</p>
                                <hr/>
                                <h3>PAYMENT MODES</h3>
                                <p><b>Cash:</b> ${currency}${Number(a.cashTotal).toFixed(2)}</p>
                                <p><b>Card:</b> ${currency}${Number(a.cardTotal).toFixed(2)}</p>
                                <p><b>UPI:</b> ${currency}${Number(a.upiTotal).toFixed(2)}</p>
                                <p><b>Split:</b> ${currency}${Number(a.splitTotal).toFixed(2)}</p>
                                ${
                                  hasRecon
                                    ? `
                                <hr/>
                                <h3>CASH RECONCILIATION</h3>
                                <p><b>Opening Float:</b> ${currency}${Number(a.openingCash ?? 0).toFixed(2)}</p>
                                <p><b>System Cash Sales:</b> ${currency}${Number(a.cashTotal).toFixed(2)}</p>
                                <p><b>Expected Cash:</b> ${currency}${expectedC.toFixed(2)}</p>
                                <p><b>Actual Handover:</b> ${currency}${Number(a.cashHandover ?? 0).toFixed(2)}</p>
                                <p><b>Variance:</b> ${currency}${Math.abs(varAmt).toFixed(2)} (${varLabel})</p>
                                <hr/>
                                <h3>SHIFT DETAILS</h3>
                                <p><b>Closing Staff:</b> ${a.closingStaff || "—"}</p>
                                <p><b>Remarks:</b> ${a.shiftRemarks || "—"}</p>
                                `
                                    : `<hr/><p><b>Note:</b> ${a.note || "—"}</p>`
                                }
                                </body></html>
                              `);
                              w.document.close();
                              w.print();
                            }}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          data-ocid="night_audit.close_confirm.dialog"
          className="max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-orange-400" />
              Close Restaurant for the Day
            </DialogTitle>
            <DialogDescription>
              Save a night audit record for <b>{todayStr}</b>. You can still
              process bills after closing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto pr-1">
            {/* Summary preview */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2.5 bg-muted rounded-lg">
                <p className="text-muted-foreground">Total Sales</p>
                <p className="font-bold text-primary">
                  {currency}
                  {totalSales.toFixed(2)}
                </p>
              </div>
              <div className="p-2.5 bg-muted rounded-lg">
                <p className="text-muted-foreground">Total Bills</p>
                <p className="font-bold">{totalBillsCount}</p>
              </div>
              <div className="p-2.5 bg-muted rounded-lg">
                <p className="text-muted-foreground">Expenses</p>
                <p className="font-bold text-red-400">
                  {currency}
                  {totalExpenses.toFixed(2)}
                </p>
              </div>
              <div className="p-2.5 bg-muted rounded-lg">
                <p className="text-muted-foreground">Purchases</p>
                <p className="font-bold text-orange-400">
                  {currency}
                  {totalPurchases.toFixed(2)}
                </p>
              </div>
            </div>

            {hasOpenTables && (
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Warning: There are still open/active tables.
              </div>
            )}

            {/* Cash Reconciliation */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/60 px-4 py-2.5 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">
                  Cash Reconciliation
                </span>
              </div>
              <div className="p-4 space-y-3">
                {/* Opening Float */}
                <div className="grid grid-cols-2 items-center gap-3">
                  <Label htmlFor="opening-cash" className="text-sm">
                    Opening Float
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      {currency}
                    </span>
                    <Input
                      id="opening-cash"
                      data-ocid="night_audit.opening_cash.input"
                      type="number"
                      min={0}
                      step={0.01}
                      value={openingCash}
                      onChange={(e) =>
                        setOpeningCash(Math.max(0, Number(e.target.value)))
                      }
                      className="pl-8 h-9"
                    />
                  </div>
                </div>

                {/* System Cash Sales — read-only */}
                <div className="grid grid-cols-2 items-center gap-3">
                  <Label className="text-sm text-muted-foreground">
                    System Cash Sales
                  </Label>
                  <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                    {currency}
                    {cashTotal.toFixed(2)}
                  </div>
                </div>

                {/* Expected Cash — read-only */}
                <div className="grid grid-cols-2 items-center gap-3">
                  <Label className="text-sm text-muted-foreground">
                    Expected Cash (Float + Sales)
                  </Label>
                  <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium text-primary">
                    {currency}
                    {expectedCash.toFixed(2)}
                  </div>
                </div>

                {/* Actual Cash Handover */}
                <div className="grid grid-cols-2 items-center gap-3">
                  <Label htmlFor="cash-handover" className="text-sm">
                    Actual Cash Handover
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      {currency}
                    </span>
                    <Input
                      id="cash-handover"
                      data-ocid="night_audit.cash_handover.input"
                      type="number"
                      min={0}
                      step={0.01}
                      value={cashHandover}
                      onChange={(e) =>
                        setCashHandover(Math.max(0, Number(e.target.value)))
                      }
                      className="pl-8 h-9"
                    />
                  </div>
                </div>

                {/* Cash Variance — auto-calculated */}
                <div className="grid grid-cols-2 items-center gap-3">
                  <Label className="text-sm text-muted-foreground">
                    Cash Variance
                  </Label>
                  <div className="flex items-center">
                    <VarianceBadge
                      variance={cashVariance}
                      currency={currency}
                    />
                    {cashVariance !== 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({cashVariance > 0 ? "+" : ""}
                        {currency}
                        {cashVariance.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Shift Remarks */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/60 px-4 py-2.5 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Shift Details</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="closing-staff">Closing Staff Name</Label>
                  <Input
                    id="closing-staff"
                    data-ocid="night_audit.closing_staff.input"
                    placeholder="Enter staff member name..."
                    value={closingStaff}
                    onChange={(e) => setClosingStaff(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shift-remarks">Shift Remarks</Label>
                  <Textarea
                    id="shift-remarks"
                    data-ocid="night_audit.shift_remarks.textarea"
                    placeholder="Any incidents, issues, or notes for the next shift..."
                    value={shiftRemarks}
                    onChange={(e) => setShiftRemarks(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              data-ocid="night_audit.close_cancel.button"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="night_audit.close_confirm.button"
              onClick={confirmClose}
              disabled={isClosing}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              {isClosing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              Confirm Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { NightAudit };
