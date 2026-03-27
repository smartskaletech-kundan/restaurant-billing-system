import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  BarChart2,
  CheckCircle,
  ExternalLink,
  Loader2,
  MessageSquare,
  Plus,
  Printer,
  Send,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Bill } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";

interface Template {
  id: number;
  name: string;
  message: string;
  usageCount: number;
  active: boolean;
}

interface MessageLog {
  id: number;
  to: string;
  customer: string;
  template: string;
  sentAt: string;
  status: "Sent" | "Delivered" | "Failed";
}

const INITIAL_TEMPLATES: Template[] = [
  {
    id: 1,
    name: "Bill Receipt",
    message:
      "Dear {name}, your bill of ₹{amount} has been generated. Thank you for dining with us!",
    usageCount: 142,
    active: true,
  },
  {
    id: 2,
    name: "Order Confirmation",
    message:
      "Hi {name}! Your order #{order_id} is confirmed and will be ready in {time} minutes.",
    usageCount: 89,
    active: true,
  },
  {
    id: 3,
    name: "Promotional Offer",
    message: "Hi {name}! 🎉 Special offer: {offer_details}. Valid till {date}.",
    usageCount: 34,
    active: false,
  },
  {
    id: 4,
    name: "Booking Confirmation",
    message:
      "Dear {name}, your table for {guests} guests is confirmed for {date} at {time}.",
    usageCount: 67,
    active: true,
  },
];

const INITIAL_LOGS: MessageLog[] = [
  {
    id: 1,
    to: "9812345678",
    customer: "Anita Gupta",
    template: "Bill Receipt",
    sentAt: "2026-03-27 14:32",
    status: "Delivered",
  },
  {
    id: 2,
    to: "9876543210",
    customer: "Rajesh Kumar",
    template: "Order Confirmation",
    sentAt: "2026-03-27 14:15",
    status: "Delivered",
  },
  {
    id: 3,
    to: "9845671234",
    customer: "Sunita Sharma",
    template: "Promotional Offer",
    sentAt: "2026-03-27 12:00",
    status: "Sent",
  },
  {
    id: 4,
    to: "9901234567",
    customer: "Mohan Das",
    template: "Bill Receipt",
    sentAt: "2026-03-27 11:45",
    status: "Delivered",
  },
  {
    id: 5,
    to: "9765432109",
    customer: "Kavita Patel",
    template: "Booking Confirmation",
    sentAt: "2026-03-26 19:30",
    status: "Failed",
  },
  {
    id: 6,
    to: "9812349999",
    customer: "Suresh Nair",
    template: "Bill Receipt",
    sentAt: "2026-03-26 18:10",
    status: "Delivered",
  },
  {
    id: 7,
    to: "9999012345",
    customer: "Pooja Verma",
    template: "Promotional Offer",
    sentAt: "2026-03-26 10:00",
    status: "Sent",
  },
  {
    id: 8,
    to: "9811122233",
    customer: "Arun Pillai",
    template: "Order Confirmation",
    sentAt: "2026-03-25 20:45",
    status: "Delivered",
  },
];

const statusColor: Record<string, string> = {
  Sent: "bg-blue-500/20 text-blue-400",
  Delivered: "bg-green-500/20 text-green-400",
  Failed: "bg-red-500/20 text-red-400",
};

// ---- Summary Report Tab ----

type PeriodType = "daily" | "monthly" | "between";

interface SalesSummary {
  totalSales: number;
  totalBills: number;
  avgBill: number;
  cash: number;
  card: number;
  upi: number;
  split: number;
}

interface ReceiptSummary {
  total: number;
  items: { billNo: string; amount: number; mode: string; date: string }[];
}

interface ExpenseSummary {
  total: number;
  byCategory: Record<string, number>;
}

interface PurchaseSummary {
  total: number;
  byVendor: Record<string, number>;
}

function isInRange(ms: number, from: Date, to: Date): boolean {
  const d = new Date(ms);
  return d >= from && d <= to;
}

function SummaryReport() {
  const { restaurantId } = useRestaurant();
  const { actor, isFetching } = useActor();

  const currency =
    JSON.parse(
      localStorage.getItem(`smartskale_settings_${restaurantId}`) || "{}",
    ).currency || "₹";

  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [period, setPeriod] = useState<PeriodType>("daily");
  const [dailyDate, setDailyDate] = useState(today);
  const [monthlyYear, setMonthlyYear] = useState(String(currentYear));
  const [monthlyMonth, setMonthlyMonth] = useState(
    String(currentMonth).padStart(2, "0"),
  );
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [bills, setBills] = useState<Bill[]>([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [generated, setGenerated] = useState(false);

  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [receiptSummary, setReceiptSummary] = useState<ReceiptSummary | null>(
    null,
  );
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(
    null,
  );
  const [purchaseSummary, setPurchaseSummary] =
    useState<PurchaseSummary | null>(null);
  const [reconciliationData, setReconciliationData] = useState<any | null>(
    null,
  );

  useEffect(() => {
    if (!actor || isFetching) return;
    (async () => {
      try {
        const result = await (actor as any).getBillsByRestaurant(restaurantId);
        setBills(result || []);
      } catch (e) {
        console.error("Failed to load bills", e);
      } finally {
        setLoadingBills(false);
      }
    })();
  }, [actor, isFetching, restaurantId]);

  function getDateRange(): [Date, Date] {
    if (period === "daily") {
      const d = new Date(dailyDate);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      return [start, end];
    }
    if (period === "monthly") {
      const start = new Date(
        Number(monthlyYear),
        Number(monthlyMonth) - 1,
        1,
        0,
        0,
        0,
        0,
      );
      const end = new Date(
        Number(monthlyYear),
        Number(monthlyMonth),
        0,
        23,
        59,
        59,
        999,
      );
      return [start, end];
    }
    // between
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    return [start, end];
  }

  function generateReport() {
    const [start, end] = getDateRange();

    // Bills
    const filteredBills = bills.filter((b) => {
      const ms = Number(b.createdAt) / 1_000_000;
      return isInRange(ms, start, end);
    });

    const totalSales = filteredBills.reduce((s, b) => s + Number(b.total), 0);
    const totalBills = filteredBills.length;
    const avgBill = totalBills > 0 ? totalSales / totalBills : 0;
    const cash = filteredBills
      .filter((b) => (b.settlementMode || "") === "cash")
      .reduce((s, b) => s + Number(b.total), 0);
    const card = filteredBills
      .filter((b) => (b.settlementMode || "") === "card")
      .reduce((s, b) => s + Number(b.total), 0);
    const upi = filteredBills
      .filter((b) => (b.settlementMode || "") === "upi")
      .reduce((s, b) => s + Number(b.total), 0);
    const split = filteredBills
      .filter((b) => (b.settlementMode || "") === "split")
      .reduce((s, b) => s + Number(b.total), 0);

    setSalesSummary({
      totalSales,
      totalBills,
      avgBill,
      cash,
      card,
      upi,
      split,
    });

    setReceiptSummary({
      total: totalSales,
      items: filteredBills.map((b) => ({
        billNo: String(b.billNumber || b.id || ""),
        amount: Number(b.total),
        mode: String(b.settlementMode || "cash"),
        date: new Date(Number(b.createdAt) / 1_000_000).toLocaleDateString(
          "en-IN",
        ),
      })),
    });

    // Expenses
    const expenses: any[] = (() => {
      try {
        return JSON.parse(localStorage.getItem("smartskale_expenses") || "[]");
      } catch {
        return [];
      }
    })();
    const filteredExpenses = expenses.filter((e) =>
      isInRange(e.date, start, end),
    );
    const expTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const byCat: Record<string, number> = {};
    for (const e of filteredExpenses) {
      byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
    }
    setExpenseSummary({ total: expTotal, byCategory: byCat });

    // Purchases
    const purchases: any[] = (() => {
      try {
        return JSON.parse(localStorage.getItem("smartskale_purchases") || "[]");
      } catch {
        return [];
      }
    })();
    const filteredPurchases = purchases.filter((p) =>
      isInRange(p.date, start, end),
    );
    const purTotal = filteredPurchases.reduce(
      (s, p) => s + Number(p.netTotal || p.totalAmount || 0),
      0,
    );
    const byVendor: Record<string, number> = {};
    for (const p of filteredPurchases) {
      byVendor[p.vendorName] =
        (byVendor[p.vendorName] || 0) +
        Number(p.netTotal || p.totalAmount || 0);
    }
    setPurchaseSummary({ total: purTotal, byVendor });

    // Night Audit Reconciliation
    const audits: any[] = (() => {
      try {
        return JSON.parse(
          localStorage.getItem("smartskale_night_audits") || "[]",
        );
      } catch {
        return [];
      }
    })();
    if (period === "daily") {
      const rec = audits.find((a) => a.date === dailyDate) || null;
      setReconciliationData(rec ? [rec] : []);
    } else {
      const filtered = audits.filter((a) => {
        const d = new Date(a.date);
        d.setHours(12, 0, 0, 0);
        return d >= start && d <= end;
      });
      setReconciliationData(filtered);
    }

    setGenerated(true);
    toast.success("Report generated successfully");
  }

  function buildWhatsAppMessage(): string {
    if (!salesSummary || !receiptSummary || !expenseSummary || !purchaseSummary)
      return "";

    const periodLabel =
      period === "daily"
        ? `Date: ${dailyDate}`
        : period === "monthly"
          ? `Month: ${monthlyMonth}/${monthlyYear}`
          : `Period: ${fromDate} to ${toDate}`;

    let msg = `🏪 *Restaurant Summary Report*\n${periodLabel}\n\n`;

    msg += "💰 *SALE REPORT*\n";
    msg += `Total Sales: ${currency}${salesSummary.totalSales.toFixed(2)}\n`;
    msg += `Total Bills: ${salesSummary.totalBills}\n`;
    msg += `Avg Bill Value: ${currency}${salesSummary.avgBill.toFixed(2)}\n`;
    msg += `Cash: ${currency}${salesSummary.cash.toFixed(2)} | Card: ${currency}${salesSummary.card.toFixed(2)} | UPI: ${currency}${salesSummary.upi.toFixed(2)} | Split: ${currency}${salesSummary.split.toFixed(2)}\n\n`;

    msg += "🧾 *RECEIPT REPORT*\n";
    msg += `Total Receipts: ${currency}${receiptSummary.total.toFixed(2)}\n\n`;

    msg += "💸 *EXPENSE REPORT*\n";
    msg += `Total Expenses: ${currency}${expenseSummary.total.toFixed(2)}\n`;
    for (const [cat, amt] of Object.entries(expenseSummary.byCategory)) {
      msg += `  ${cat}: ${currency}${Number(amt).toFixed(2)}\n`;
    }
    msg += "\n";

    msg += "🛋️ *PURCHASE REPORT*\n";
    msg += `Total Purchases: ${currency}${purchaseSummary.total.toFixed(2)}\n`;
    for (const [vendor, amt] of Object.entries(purchaseSummary.byVendor)) {
      msg += `  ${vendor}: ${currency}${Number(amt).toFixed(2)}\n`;
    }

    if (reconciliationData && reconciliationData.length > 0) {
      msg += "\n💵 *CASH HANDOVER / RECONCILIATION*\n";
      if (period === "daily" || reconciliationData.length === 1) {
        const r = reconciliationData[0];
        msg += `Date: ${r.date}\n`;
        if (r.openingFloat !== undefined)
          msg += `Opening Float: ${currency}${Number(r.openingFloat).toFixed(2)}\n`;
        if (r.expectedCash !== undefined)
          msg += `Expected Cash: ${currency}${Number(r.expectedCash).toFixed(2)}\n`;
        if (r.cashHandover !== undefined)
          msg += `Actual Handover: ${currency}${Number(r.cashHandover).toFixed(2)}\n`;
        if (r.cashVariance !== undefined) {
          const v = Number(r.cashVariance);
          const varLabel =
            v === 0
              ? "BALANCED"
              : v < 0
                ? `SHORT ${currency}${Math.abs(v).toFixed(2)}`
                : `OVER ${currency}${v.toFixed(2)}`;
          msg += `Variance: ${varLabel}\n`;
        }
        if (r.closingStaff) msg += `Closing Staff: ${r.closingStaff}\n`;
        if (r.shiftRemarks) msg += `Shift Remarks: ${r.shiftRemarks}\n`;
      } else {
        msg += "Date | Handover | Variance\n";
        for (const r of reconciliationData) {
          const v =
            r.cashVariance !== undefined ? Number(r.cashVariance) : null;
          const varLabel =
            v === null
              ? "-"
              : v === 0
                ? "BALANCED"
                : v < 0
                  ? `SHORT ${currency}${Math.abs(v).toFixed(2)}`
                  : `OVER ${currency}${v.toFixed(2)}`;
          msg += `${r.date} | ${currency}${Number(r.cashHandover || 0).toFixed(2)} | ${varLabel}\n`;
        }
      }
    }

    return msg;
  }

  function sendViaWhatsApp() {
    if (!generated) {
      toast.error("Please generate the report first");
      return;
    }
    const msg = buildWhatsAppMessage();
    const ownerPhone =
      localStorage.getItem(`${restaurantId}_owner_whatsapp_number`) || "";
    const cleanPhone = ownerPhone.replace(/\D/g, "");
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];
  const years = Array.from({ length: 5 }, (_, i) =>
    String(currentYear - 2 + i),
  );

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4" /> Report Period
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(["daily", "monthly", "between"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? "default" : "outline"}
                data-ocid={`wa_report.period_${p}.button`}
                onClick={() => {
                  setPeriod(p);
                  setGenerated(false);
                }}
                className="capitalize"
              >
                {p === "between"
                  ? "Between Dates"
                  : p.charAt(0).toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </div>

          {period === "daily" && (
            <div className="flex items-center gap-3">
              <Label>Date</Label>
              <Input
                type="date"
                value={dailyDate}
                onChange={(e) => {
                  setDailyDate(e.target.value);
                  setGenerated(false);
                }}
                className="w-48 h-9"
                data-ocid="wa_report.daily_date.input"
              />
            </div>
          )}

          {period === "monthly" && (
            <div className="flex items-center gap-3 flex-wrap">
              <Label>Month</Label>
              <Select
                value={monthlyMonth}
                onValueChange={(v) => {
                  setMonthlyMonth(v);
                  setGenerated(false);
                }}
              >
                <SelectTrigger
                  className="w-40 h-9"
                  data-ocid="wa_report.monthly_month.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={monthlyYear}
                onValueChange={(v) => {
                  setMonthlyYear(v);
                  setGenerated(false);
                }}
              >
                <SelectTrigger
                  className="w-28 h-9"
                  data-ocid="wa_report.monthly_year.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {period === "between" && (
            <div className="flex items-center gap-3 flex-wrap">
              <Label>From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setGenerated(false);
                }}
                className="w-44 h-9"
                data-ocid="wa_report.from_date.input"
              />
              <Label>To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setGenerated(false);
                }}
                className="w-44 h-9"
                data-ocid="wa_report.to_date.input"
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button
              data-ocid="wa_report.generate.button"
              onClick={generateReport}
              disabled={loadingBills}
              className="gap-2"
            >
              {loadingBills ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BarChart2 className="h-4 w-4" />
              )}
              Generate Report
            </Button>
            {generated && (
              <>
                <Button
                  variant="outline"
                  data-ocid="wa_report.whatsapp.button"
                  onClick={sendViaWhatsApp}
                  className="gap-2 border-green-500/40 text-green-400 hover:bg-green-500/10"
                >
                  <Send className="h-4 w-4" />
                  Send via WhatsApp
                </Button>
                <Button
                  variant="outline"
                  data-ocid="wa_report.print.button"
                  onClick={() => window.print()}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Report
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report sections */}
      {generated &&
        salesSummary &&
        receiptSummary &&
        expenseSummary &&
        purchaseSummary && (
          <div className="space-y-4">
            {/* Sale Report */}
            <Card data-ocid="wa_report.sale_report.card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">💰 Sale Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Sales</p>
                    <p className="font-bold text-primary">
                      {currency}
                      {salesSummary.totalSales.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Bills</p>
                    <p className="font-bold">{salesSummary.totalBills}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Avg Bill Value
                    </p>
                    <p className="font-bold">
                      {currency}
                      {salesSummary.avgBill.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <p className="text-xs text-muted-foreground">Cash</p>
                    <p className="font-semibold text-green-400">
                      {currency}
                      {salesSummary.cash.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <p className="text-xs text-muted-foreground">Card</p>
                    <p className="font-semibold text-blue-400">
                      {currency}
                      {salesSummary.card.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <p className="text-xs text-muted-foreground">UPI</p>
                    <p className="font-semibold text-purple-400">
                      {currency}
                      {salesSummary.upi.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <p className="text-xs text-muted-foreground">Split</p>
                    <p className="font-semibold text-orange-400">
                      {currency}
                      {salesSummary.split.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Receipt Report */}
            <Card data-ocid="wa_report.receipt_report.card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">🧾 Receipt Report</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Total Receipts Collected:{" "}
                  <span className="font-bold text-foreground">
                    {currency}
                    {receiptSummary.total.toFixed(2)}
                  </span>
                </p>
                {receiptSummary.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill No.</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Mode</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receiptSummary.items.slice(0, 20).map((item, i) => (
                          <TableRow key={`receipt-${item.billNo}-${i}`}>
                            <TableCell className="font-mono text-sm">
                              {item.billNo}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.date}
                            </TableCell>
                            <TableCell className="font-medium">
                              {currency}
                              {item.amount.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="capitalize text-xs"
                              >
                                {item.mode}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {receiptSummary.items.length > 20 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Showing 20 of {receiptSummary.items.length} receipts
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No receipts in this period.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Expense Report */}
            <Card data-ocid="wa_report.expense_report.card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">💸 Expense Report</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Total Expenses:{" "}
                  <span className="font-bold text-red-400">
                    {currency}
                    {expenseSummary.total.toFixed(2)}
                  </span>
                </p>
                {Object.keys(expenseSummary.byCategory).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(expenseSummary.byCategory).map(
                      ([cat, amt]) => (
                        <div
                          key={cat}
                          className="flex items-center justify-between p-2.5 bg-muted rounded-lg"
                        >
                          <span className="text-sm">{cat}</span>
                          <span className="font-semibold text-red-400">
                            {currency}
                            {Number(amt).toFixed(2)}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No expenses in this period.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Purchase Report */}
            <Card data-ocid="wa_report.purchase_report.card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">🛋️ Purchase Report</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Total Purchases:{" "}
                  <span className="font-bold text-orange-400">
                    {currency}
                    {purchaseSummary.total.toFixed(2)}
                  </span>
                </p>
                {Object.keys(purchaseSummary.byVendor).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(purchaseSummary.byVendor).map(
                      ([vendor, amt]) => (
                        <div
                          key={vendor}
                          className="flex items-center justify-between p-2.5 bg-muted rounded-lg"
                        >
                          <span className="text-sm">{vendor}</span>
                          <span className="font-semibold text-orange-400">
                            {currency}
                            {Number(amt).toFixed(2)}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No purchases in this period.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Cash Handover / Reconciliation */}
            <Card data-ocid="wa_report.reconciliation.card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  💵 Cash Handover / Reconciliation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reconciliationData && reconciliationData.length > 0 ? (
                  period === "daily" || reconciliationData.length === 1 ? (
                    (() => {
                      const r = reconciliationData[0];
                      const variance =
                        r.cashVariance !== undefined
                          ? Number(r.cashVariance)
                          : null;
                      const varColor =
                        variance === null
                          ? ""
                          : variance === 0
                            ? "text-green-400"
                            : variance < 0
                              ? "text-red-400"
                              : "text-amber-400";
                      const varLabel =
                        variance === null
                          ? "-"
                          : variance === 0
                            ? "BALANCED"
                            : variance < 0
                              ? `SHORT ${currency}${Math.abs(variance).toFixed(2)}`
                              : `OVER ${currency}${variance.toFixed(2)}`;
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {r.openingFloat !== undefined && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground">
                                Opening Float
                              </p>
                              <p className="font-semibold">
                                {currency}
                                {Number(r.openingFloat).toFixed(2)}
                              </p>
                            </div>
                          )}
                          {r.expectedCash !== undefined && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground">
                                Expected Cash
                              </p>
                              <p className="font-semibold">
                                {currency}
                                {Number(r.expectedCash).toFixed(2)}
                              </p>
                            </div>
                          )}
                          {r.cashHandover !== undefined && (
                            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                              <p className="text-xs text-muted-foreground">
                                Actual Handover
                              </p>
                              <p className="font-semibold text-blue-400">
                                {currency}
                                {Number(r.cashHandover).toFixed(2)}
                              </p>
                            </div>
                          )}
                          {variance !== null && (
                            <div
                              className={`p-3 rounded-lg border ${variance === 0 ? "bg-green-500/10 border-green-500/20" : variance < 0 ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"}`}
                            >
                              <p className="text-xs text-muted-foreground">
                                Variance
                              </p>
                              <p className={`font-bold ${varColor}`}>
                                {varLabel}
                              </p>
                            </div>
                          )}
                          {r.closingStaff && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground">
                                Closing Staff
                              </p>
                              <p className="font-semibold">{r.closingStaff}</p>
                            </div>
                          )}
                          {r.shiftRemarks && (
                            <div className="p-3 bg-muted rounded-lg col-span-2 md:col-span-3">
                              <p className="text-xs text-muted-foreground">
                                Shift Remarks
                              </p>
                              <p className="text-sm">{r.shiftRemarks}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Opening Float</TableHead>
                            <TableHead>Expected Cash</TableHead>
                            <TableHead>Actual Handover</TableHead>
                            <TableHead>Variance</TableHead>
                            <TableHead>Closing Staff</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconciliationData.map((r: any, _i: number) => {
                            const v =
                              r.cashVariance !== undefined
                                ? Number(r.cashVariance)
                                : null;
                            const varColor =
                              v === null
                                ? ""
                                : v === 0
                                  ? "text-green-400"
                                  : v < 0
                                    ? "text-red-400"
                                    : "text-amber-400";
                            const varLabel =
                              v === null
                                ? "-"
                                : v === 0
                                  ? "BALANCED"
                                  : v < 0
                                    ? `SHORT ${currency}${Math.abs(v).toFixed(2)}`
                                    : `OVER ${currency}${v.toFixed(2)}`;
                            return (
                              <TableRow key={`recon-${r.date}`}>
                                <TableCell className="font-mono text-sm">
                                  {r.date}
                                </TableCell>
                                <TableCell>
                                  {r.openingFloat !== undefined
                                    ? `${currency}${Number(r.openingFloat).toFixed(2)}`
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {r.expectedCash !== undefined
                                    ? `${currency}${Number(r.expectedCash).toFixed(2)}`
                                    : "-"}
                                </TableCell>
                                <TableCell className="font-medium text-blue-400">
                                  {r.cashHandover !== undefined
                                    ? `${currency}${Number(r.cashHandover).toFixed(2)}`
                                    : "-"}
                                </TableCell>
                                <TableCell
                                  className={`font-semibold ${varColor}`}
                                >
                                  {varLabel}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {r.closingStaff || "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No night audit recorded for this period.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

      {loadingBills && !generated && (
        <div
          data-ocid="wa_report.loading_state"
          className="flex items-center gap-3 text-muted-foreground py-8 justify-center"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading billing data...
        </div>
      )}
    </div>
  );
}

// ---- Main Component ----

export default function WhatsAppIntegration() {
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [logs] = useState<MessageLog[]>(INITIAL_LOGS);
  const [connected, setConnected] = useState(false);
  const [settings, setSettings] = useState({ phone: "", apiKey: "" });
  const [testPhone, setTestPhone] = useState("");
  const [testTemplate, setTestTemplate] = useState("");
  const [logFilter, setLogFilter] = useState<
    "All" | "Sent" | "Delivered" | "Failed"
  >("All");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplMessage, setNewTplMessage] = useState("");

  const webhookUrl =
    `https://api.smartskale.com/webhook/whatsapp/${settings.phone || "<your-number>"}`.replace(
      /\s/g,
      "",
    );

  function saveSettings() {
    if (!settings.phone || !settings.apiKey) {
      toast.error("Fill all fields");
      return;
    }
    setConnected(true);
    toast.success("WhatsApp settings saved. Connected!");
  }

  function sendTest() {
    if (!testPhone || !testTemplate) {
      toast.error("Select phone and template");
      return;
    }
    toast.success(`Test message sent to ${testPhone}`);
  }

  function saveEdit(id: number) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, message: editMessage } : t)),
    );
    setEditingId(null);
    toast.success("Template updated");
  }

  function saveNewTemplate() {
    if (!newTplName.trim() || !newTplMessage.trim()) {
      toast.error("Fill template name and message");
      return;
    }
    const newTpl: Template = {
      id: Date.now(),
      name: newTplName.trim(),
      message: newTplMessage.trim(),
      usageCount: 0,
      active: true,
    };
    setTemplates((prev) => [...prev, newTpl]);
    setShowNewTemplate(false);
    setNewTplName("");
    setNewTplMessage("");
    toast.success("New template created");
  }

  const filteredLogs =
    logFilter === "All" ? logs : logs.filter((l) => l.status === logFilter);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-7 w-7 text-green-400" />
        <h1 className="text-2xl font-bold text-foreground">
          WhatsApp Integration
        </h1>
        {connected ? (
          <Badge className="bg-green-500/20 text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Connected
          </Badge>
        ) : (
          <Badge className="bg-red-500/20 text-red-400 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Disconnected
          </Badge>
        )}
      </div>

      <Tabs defaultValue="setup">
        <TabsList>
          <TabsTrigger value="setup" data-ocid="whatsapp.setup.tab">
            Setup
          </TabsTrigger>
          <TabsTrigger value="templates" data-ocid="whatsapp.templates.tab">
            Templates
          </TabsTrigger>
          <TabsTrigger value="log" data-ocid="whatsapp.log.tab">
            Message Log
          </TabsTrigger>
          <TabsTrigger
            value="summary-report"
            data-ocid="whatsapp.summary_report.tab"
          >
            Summary Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4 space-y-6">
          {/* Web WhatsApp button */}
          <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div>
              <p className="font-semibold text-foreground">Open Web WhatsApp</p>
              <p className="text-sm text-muted-foreground">
                Send messages directly from your browser via WhatsApp Web
              </p>
            </div>
            <Button
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={() => window.open("https://web.whatsapp.com", "_blank")}
            >
              <ExternalLink className="h-4 w-4" />🌐 Open Web WhatsApp
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Business API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Business Phone Number</Label>
                  <Input
                    placeholder="+91 98xxx xxxxx"
                    value={settings.phone}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>WhatsApp Business API Key</Label>
                  <Input
                    type="password"
                    placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                    value={settings.apiKey}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, apiKey: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Webhook URL (Read-only)</Label>
                <Input
                  readOnly
                  className="bg-muted font-mono text-xs"
                  value={webhookUrl}
                />
              </div>
              <Button onClick={saveSettings}>Save &amp; Connect</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send Test Message</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="+91 98xxx xxxxx"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
                <div className="w-48">
                  <Label>Template</Label>
                  <Select value={testTemplate} onValueChange={setTestTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates
                        .filter((t) => t.active)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.name}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={sendTest}>Send Test</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setShowNewTemplate((v) => !v)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </div>

          {showNewTemplate && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-sm">Create New Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Template Name</Label>
                  <Input
                    placeholder="e.g. Loyalty Points"
                    value={newTplName}
                    onChange={(e) => setNewTplName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Use {name}, {amount}, {date} as variables..."
                    value={newTplMessage}
                    onChange={(e) => setNewTplMessage(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNewTemplate}>
                    Save Template
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNewTemplate(false);
                      setNewTplName("");
                      setNewTplMessage("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{t.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {t.usageCount} uses
                      </Badge>
                      <Badge
                        className={
                          t.active
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        }
                      >
                        {t.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {editingId === t.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(t.id)}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                        {t.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end shrink-0">
                    <Switch
                      checked={t.active}
                      onCheckedChange={(v) =>
                        setTemplates((prev) =>
                          prev.map((x) =>
                            x.id === t.id ? { ...x, active: v } : x,
                          ),
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(t.id);
                        setEditMessage(t.message);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <div className="flex gap-2 mb-4">
            {(["All", "Sent", "Delivered", "Failed"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={logFilter === f ? "default" : "outline"}
                onClick={() => setLogFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>To</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-sm">
                        {l.to}
                      </TableCell>
                      <TableCell>{l.customer}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.template}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.sentAt}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor[l.status]}>
                          {l.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary-report" className="mt-4">
          <SummaryReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { WhatsAppIntegration };
