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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Bill } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";
import { useCardNames } from "../hooks/useCardNames";

type DateFilter = "today" | "week" | "month" | "all";
type SettlementFilter =
  | "All"
  | "Cash"
  | "HDFC Card"
  | "SBI Card"
  | "UPI"
  | "Split";

const modeIcon: Record<string, string> = {
  Cash: "💵",
  "HDFC Card": "💳",
  "SBI Card": "💳",
  UPI: "📱",
  Split: "🔀",
};

function filterBills(bills: Bill[], filter: DateFilter): Bill[] {
  const now = Date.now();
  return bills.filter((b) => {
    const ms = Number(b.createdAt) / 1_000_000;
    if (filter === "today")
      return new Date(ms).toDateString() === new Date().toDateString();
    if (filter === "week") return now - ms <= 7 * 24 * 60 * 60 * 1000;
    if (filter === "month") {
      const d = new Date(ms);
      const n = new Date();
      return (
        d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
      );
    }
    return true;
  });
}

/** Parse split mode string like Split(Cash:100,HDFC:200,SBI:50,UPI:30) */
function parseSplitMode(mode: string): {
  cash: number;
  hdfc: number;
  sbi: number;
  upi: number;
} {
  const result = { cash: 0, hdfc: 0, sbi: 0, upi: 0 };
  if (!mode.startsWith("Split(")) return result;
  const inner = mode.slice(6, -1);
  for (const part of inner.split(",")) {
    const [key, val] = part.split(":");
    const amount = Number.parseFloat(val) || 0;
    if (key === "Cash") result.cash = amount;
    else if (key === "HDFC") result.hdfc = amount;
    else if (key === "SBI") result.sbi = amount;
    else if (key === "UPI") result.upi = amount;
  }
  return result;
}

/** Get the base mode for filtering (strip split sub-details) */
function baseMode(mode: string): string {
  if (mode.startsWith("Split")) return "Split";
  return mode;
}

const FY_OPTIONS = [
  { label: "All Years", value: "all" },
  { label: "FY 2023-24", value: "2023-24" },
  { label: "FY 2024-25", value: "2024-25" },
  { label: "FY 2025-26", value: "2025-26" },
  { label: "FY 2026-27", value: "2026-27" },
];

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

export function Reports() {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const { card1Name, card2Name } = useCardNames();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedFY, setSelectedFY] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [settlementFilter, setSettlementFilter] =
    useState<SettlementFilter>("All");

  useEffect(() => {
    if (!actor || isFetching) return;
    setLoading(true);
    actor
      .getBillsByRestaurant(restaurantId)
      .then((b) => {
        setBills(b);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [actor, isFetching, restaurantId]);

  const restaurantName: string = useMemo(() => {
    try {
      const s = localStorage.getItem("smartskale_settings");
      if (s) return JSON.parse(s).name || "OUTLET";
    } catch {}
    return "OUTLET";
  }, []);

  const filteredBills = useMemo(() => {
    let base = filterBills(bills, dateFilter);
    const fyRange = getFYRange(selectedFY);
    if (fyRange)
      base = base.filter((b) => {
        const d = new Date(Number(b.createdAt) / 1_000_000);
        return d >= fyRange.start && d <= fyRange.end;
      });
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      base = base.filter((b) => {
        const d = new Date(Number(b.createdAt) / 1_000_000);
        return d >= from && d <= to;
      });
    }
    return base;
  }, [bills, dateFilter, selectedFY, fromDate, toDate]);

  const totalRevenue = filteredBills.reduce((s, b) => s + b.total, 0);
  const totalBills = filteredBills.length;
  const avgBill = totalBills > 0 ? totalRevenue / totalBills : 0;
  const totalTax = filteredBills.reduce((s, b) => s + b.taxAmount, 0);

  const revenueByTable = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of filteredBills) {
      map[b.tableName] = (map[b.tableName] ?? 0) + b.total;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [filteredBills]);

  const topItems = useMemo(() => {
    const map: Record<string, { qty: number; revenue: number }> = {};
    for (const b of filteredBills) {
      for (const item of b.items) {
        if (!map[item.name]) map[item.name] = { qty: 0, revenue: 0 };
        map[item.name].qty += Number(item.quantity);
        map[item.name].revenue += item.subtotal;
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 8);
  }, [filteredBills]);

  const modeSummary = useMemo(() => {
    const acc: Record<string, { count: number; total: number }> = {
      Cash: { count: 0, total: 0 },
      "HDFC Card": { count: 0, total: 0 },
      "SBI Card": { count: 0, total: 0 },
      UPI: { count: 0, total: 0 },
      Split: { count: 0, total: 0 },
    };
    for (const b of filteredBills) {
      const m = b.settlementMode || "Cash";
      if (m.startsWith("Split(")) {
        acc.Split.count += 1;
        acc.Split.total += b.total;
      } else {
        const key = m in acc ? m : "Cash";
        acc[key].count += 1;
        acc[key].total += b.total;
      }
    }
    return Object.entries(acc).map(([mode, data]) => ({ mode, ...data }));
  }, [filteredBills]);

  const splitSubTotals = useMemo(() => {
    const sub = { cash: 0, hdfc: 0, sbi: 0, upi: 0 };
    for (const b of filteredBills) {
      if (b.settlementMode?.startsWith("Split(")) {
        const s = parseSplitMode(b.settlementMode);
        sub.cash += s.cash;
        sub.hdfc += s.hdfc;
        sub.sbi += s.sbi;
        sub.upi += s.upi;
      }
    }
    return sub;
  }, [filteredBills]);

  const hasSplitBills = filteredBills.some((b) =>
    b.settlementMode?.startsWith("Split("),
  );

  const settlementBills = useMemo(() => {
    const withCashier = filteredBills.map((b) => ({
      ...b,
      mode: b.settlementMode || "Cash",
      cashier: b.cashierName || "Admin",
    }));
    if (settlementFilter === "All") return withCashier;
    return withCashier.filter((b) => baseMode(b.mode) === settlementFilter);
  }, [filteredBills, settlementFilter]);

  const settlementTotal = settlementBills.reduce((s, b) => s + b.total, 0);
  const maxRevenue = revenueByTable.length > 0 ? revenueByTable[0][1] : 1;

  const cashierRows = useMemo(() => {
    return filteredBills.map((b) => {
      const mode = b.settlementMode || "Cash";
      const amt = b.total;
      let cash = 0;
      let hdfcCard = 0;
      let sbiCard = 0;
      let upi = 0;
      if (mode === "Cash") cash = amt;
      else if (mode === "HDFC Card") hdfcCard = amt;
      else if (mode === "SBI Card") sbiCard = amt;
      else if (mode === "UPI") upi = amt;
      else if (mode.startsWith("Split(")) {
        const split = parseSplitMode(mode);
        cash = split.cash;
        hdfcCard = split.hdfc;
        sbiCard = split.sbi;
        upi = split.upi;
      }
      return {
        outlet: restaurantName,
        billNo: Number(b.billNumber),
        billAmt: amt,
        narration: b.tableName,
        cash,
        cheque: 0,
        complement: 0,
        companyDues: 0,
        hdfcCard,
        sbiCard,
        upi,
        room: 0,
        staff: b.cashierName || "Admin",
        user: b.cashierName || "Admin",
        companyName: "",
        gstin: "",
        date: Number(b.createdAt) / 1_000_000,
        isSplit: mode.startsWith("Split"),
        modeLabel: mode.startsWith("Split(") ? "Split" : mode,
      };
    });
  }, [filteredBills, restaurantName]);

  // Item-wise sale rows — one row per item per bill
  const itemWiseRows = useMemo(() => {
    const rows: Array<{
      date: string;
      billNo: string;
      billTime: string;
      table: string;
      goodsAmt: number;
      disc: number;
      nonTaxableSale: number;
      taxableSale: number;
      tax: number;
      rndoff: number;
      billAmt: number;
      itemName: string;
      qty: number;
      rate: number;
      amount: number;
      itemDisc: number;
      paymentMode: string;
      company: string;
      gstNo: string;
    }> = [];

    for (const b of filteredBills) {
      const ms = Number(b.createdAt) / 1_000_000;
      const d = new Date(ms);
      const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

      // Look up customer by matching mobile or by any link if stored on bill
      // Bills don't currently carry a customerMobile field, so we do a basic lookup
      // (future: match by b.customerMobile if available)
      let company = "";
      let gstNo = "";
      // Try to find customer — bills don't have a mobile field in current schema
      // so we leave blank unless a match is possible in future

      const taxableSale = b.subtotal - (b.discount ?? 0);
      const rndoffRaw =
        b.total - Math.round(b.subtotal + b.taxAmount - (b.discount ?? 0));
      const rndoff = Math.abs(rndoffRaw) < 0.5 ? rndoffRaw : 0;

      const billNoFormatted = String(b.billNumber);

      for (const item of b.items) {
        rows.push({
          date: dateStr,
          billNo: billNoFormatted,
          billTime: timeStr,
          table: b.tableName,
          goodsAmt: b.subtotal,
          disc: b.discount ?? 0,
          nonTaxableSale: 0,
          taxableSale,
          tax: b.taxAmount,
          rndoff,
          billAmt: b.total,
          itemName: item.name,
          qty: Number(item.quantity),
          rate: item.price,
          amount: item.subtotal,
          itemDisc: 0,
          paymentMode: b.settlementMode?.startsWith("Split")
            ? "Split"
            : b.settlementMode || "Cash",
          company,
          gstNo,
        });
      }
    }
    return rows;
  }, [filteredBills]);

  function exportItemWiseReport() {
    const headers = [
      "Date",
      "Bill No.",
      "Bill Time",
      "Table",
      "Goods Amt",
      "Disc.",
      "Non-Taxable Sale",
      "Taxable Sale",
      "Tax",
      "Rndoff",
      "Bill Amt.",
      "Item Name",
      "Qty",
      "Rate",
      "Amount",
      "ItemDisc",
      "Payment Mode",
      "Company",
      "GSTNO",
    ];
    const rows = itemWiseRows.map((r) => [
      r.date,
      r.billNo,
      r.billTime,
      r.table,
      r.goodsAmt.toFixed(2),
      r.disc.toFixed(2),
      r.nonTaxableSale.toFixed(2),
      r.taxableSale.toFixed(2),
      r.tax.toFixed(2),
      r.rndoff.toFixed(2),
      r.billAmt.toFixed(2),
      r.itemName,
      r.qty,
      r.rate.toFixed(2),
      r.amount.toFixed(2),
      r.itemDisc,
      r.paymentMode,
      r.company,
      r.gstNo,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `item-wise-sale-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCashierReport() {
    const headers = [
      "OUTLET",
      "Bill No",
      "Bill Amt",
      "Narration",
      "CASH",
      "Cheque",
      "Complement",
      "Company DUES",
      card1Name,
      card2Name,
      "UPI",
      "Room",
      "Staff",
      "User",
      "COMPANY NAME",
      "GSTIN",
    ];
    const rows = cashierRows.map((r) => [
      r.outlet,
      r.billNo,
      r.billAmt.toFixed(2),
      r.narration,
      r.cash.toFixed(2),
      r.cheque,
      r.complement,
      r.companyDues,
      r.hdfcCard.toFixed(2),
      r.sbiCard.toFixed(2),
      r.upi.toFixed(2),
      r.room,
      r.staff,
      r.user,
      r.companyName,
      r.gstin,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashier-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="reports.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Item wise summary totals
  const iwTotalGoodsAmt = itemWiseRows.reduce((s, r) => s + r.goodsAmt, 0);
  const iwTotalDisc = itemWiseRows.reduce((s, r) => s + r.disc, 0);
  const iwTotalTaxableSale = itemWiseRows.reduce(
    (s, r) => s + r.taxableSale,
    0,
  );
  const iwTotalTax = itemWiseRows.reduce((s, r) => s + r.tax, 0);
  const iwTotalBillAmt = itemWiseRows.reduce((s, r) => s + r.billAmt, 0);
  const iwTotalQty = itemWiseRows.reduce((s, r) => s + r.qty, 0);
  const iwTotalAmount = itemWiseRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6" data-ocid="reports.page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reports</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Sales analytics &amp; settlement reports
          </p>
        </div>
        <div className="flex gap-2">
          {(["today", "week", "month", "all"] as DateFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={dateFilter === f ? "default" : "outline"}
              data-ocid={`reports.${f}.tab`}
              onClick={() => setDateFilter(f)}
              className="capitalize"
            >
              {f === "today"
                ? "Today"
                : f === "week"
                  ? "This Week"
                  : f === "month"
                    ? "This Month"
                    : "All Time"}
            </Button>
          ))}
        </div>
      </div>

      {/* FY + Date Range Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-muted/30 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Financial Year:
          </span>
          <Select value={selectedFY} onValueChange={setSelectedFY}>
            <SelectTrigger className="w-40" data-ocid="reports.fy_select">
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
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="rep-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="rep-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="reports.from_date_input"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="rep-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="rep-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="reports.to_date_input"
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
            data-ocid="reports.clear_date_button"
          >
            ✕ Clear
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-ocid="reports.revenue.card">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              ₹{totalRevenue.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card data-ocid="reports.bills.card">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Total Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{totalBills}</p>
          </CardContent>
        </Card>
        <Card data-ocid="reports.avg.card">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Avg Bill Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              ₹{avgBill.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card data-ocid="reports.tax.card">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Total Tax Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              ₹{totalTax.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settlement">Settlement Report</TabsTrigger>
          <TabsTrigger value="cashier">Cashier Report</TabsTrigger>
          <TabsTrigger value="itemwise" data-ocid="reports.itemwise.tab">
            Item Wise Sale
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-ocid="reports.table_revenue.card">
              <CardHeader>
                <CardTitle className="text-base">Revenue by Table</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueByTable.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    <p className="text-sm">No data for this period</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {revenueByTable.map(([table, rev]) => (
                      <div key={table}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{table}</span>
                          <span className="text-muted-foreground">
                            ₹{rev.toFixed(2)}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(rev / maxRevenue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-ocid="reports.top_items.card">
              <CardHeader>
                <CardTitle className="text-base">Top Selling Items</CardTitle>
              </CardHeader>
              <CardContent>
                {topItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No data for this period</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topItems.map(([name, data], i) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {data.qty} orders · ₹{data.revenue.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settlement" className="mt-4 space-y-4">
          {/* Mode-wise Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {modeSummary.map(({ mode, count, total }) => (
              <Card
                key={mode}
                className={`cursor-pointer transition-all border-2 ${
                  settlementFilter === mode ? "border-primary" : "border-border"
                }`}
                onClick={() =>
                  setSettlementFilter(
                    settlementFilter === mode
                      ? "All"
                      : (mode as SettlementFilter),
                  )
                }
                data-ocid={`reports.mode_summary.${mode.toLowerCase()}`}
              >
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    {modeIcon[mode]} {mode}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <p className="text-xl font-bold text-foreground">
                    ₹{total.toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {count} bill{count !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {hasSplitBills && (
            <Card className="border-dashed border-muted-foreground/30">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">
                  🔀 Split Payment Sub-Totals
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {splitSubTotals.cash > 0 && (
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-green-600 font-medium">
                        💵 Cash
                      </p>
                      <p className="text-base font-bold text-green-700">
                        ₹{splitSubTotals.cash.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {splitSubTotals.hdfc > 0 && (
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-blue-600 font-medium">
                        💳 {card1Name}
                      </p>
                      <p className="text-base font-bold text-blue-700">
                        ₹{splitSubTotals.hdfc.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {splitSubTotals.sbi > 0 && (
                    <div className="bg-indigo-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-indigo-600 font-medium">
                        💳 {card2Name}
                      </p>
                      <p className="text-base font-bold text-indigo-700">
                        ₹{splitSubTotals.sbi.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {splitSubTotals.upi > 0 && (
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-purple-600 font-medium">
                        📱 UPI
                      </p>
                      <p className="text-base font-bold text-purple-700">
                        ₹{splitSubTotals.upi.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              Bill Settlement Report — Cashier: Admin
            </h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(
              [
                "All",
                "Cash",
                "HDFC Card",
                "SBI Card",
                "UPI",
                "Split",
              ] as SettlementFilter[]
            ).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={settlementFilter === f ? "default" : "outline"}
                onClick={() => setSettlementFilter(f)}
                data-ocid={`reports.settlement.${f.toLowerCase()}.tab`}
              >
                {f !== "All" && modeIcon[f]}{" "}
                {f === "HDFC Card"
                  ? card1Name
                  : f === "SBI Card"
                    ? card2Name
                    : f}
              </Button>
            ))}
          </div>

          <Card data-ocid="reports.settlement.table">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill No</TableHead>
                    <TableHead>Table Name</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead>Settlement Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlementBills.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-10 text-muted-foreground"
                        data-ocid="reports.settlement.empty_state"
                      >
                        No bills found for this settlement mode
                      </TableCell>
                    </TableRow>
                  ) : (
                    settlementBills.map((b, i) => (
                      <TableRow
                        key={String(b.id)}
                        data-ocid={`reports.settlement.item.${i + 1}`}
                      >
                        <TableCell className="font-mono">
                          #{Number(b.billNumber)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {b.tableName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {b.cashier}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              {modeIcon[baseMode(b.mode)] ?? "💰"}{" "}
                              {baseMode(b.mode)}
                            </span>
                            {b.mode.startsWith("Split(") &&
                              (() => {
                                const s = parseSplitMode(b.mode);
                                return (
                                  <div className="flex gap-1 flex-wrap mt-1">
                                    {s.cash > 0 && (
                                      <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                                        💵 ₹{s.cash.toFixed(0)}
                                      </span>
                                    )}
                                    {s.hdfc > 0 && (
                                      <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                        HDFC ₹{s.hdfc.toFixed(0)}
                                      </span>
                                    )}
                                    {s.sbi > 0 && (
                                      <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                                        SBI ₹{s.sbi.toFixed(0)}
                                      </span>
                                    )}
                                    {s.upi > 0 && (
                                      <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                                        📱 ₹{s.upi.toFixed(0)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ₹{b.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(
                            Number(b.createdAt) / 1_000_000,
                          ).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {settlementBills.length > 0 && (
            <div className="flex justify-end">
              <div className="bg-card border border-border rounded-lg px-6 py-3 flex items-center gap-4">
                <span className="text-muted-foreground text-sm">
                  {settlementBills.length} bills
                </span>
                <div className="w-px h-4 bg-border" />
                <span className="font-bold text-lg text-foreground">
                  Total: ₹{settlementTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* CASHIER REPORT TAB */}
        <TabsContent value="cashier" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Cashier Report</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bill-wise settlement breakdown by payment mode
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportCashierReport}
              className="gap-2"
              data-ocid="reports.cashier.export_button"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {[
                    "OUTLET",
                    "Bill No",
                    "Bill Amt",
                    "Narration",
                    "CASH",
                    "Cheque",
                    "Complement",
                    "Company DUES",
                    card1Name,
                    card2Name,
                    "UPI",
                    "Room",
                    "Staff",
                    "User",
                    "COMPANY NAME",
                    "GSTIN",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left font-semibold text-muted-foreground border-r border-border last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cashierRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={16}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No bills found for this period
                    </td>
                  </tr>
                ) : (
                  cashierRows.map((r) => (
                    <tr
                      key={`${r.billNo}-${r.date}`}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                        r.isSplit ? "bg-amber-50/30" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-foreground border-r border-border">
                        {r.outlet}
                      </td>
                      <td className="px-3 py-2 font-mono border-r border-border">
                        #{r.billNo}
                      </td>
                      <td className="px-3 py-2 font-semibold text-foreground border-r border-border">
                        ₹{r.billAmt.toFixed(2)}
                        {r.isSplit && (
                          <span className="ml-1 text-amber-600 text-xs">
                            [Split]
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        {r.narration}
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        {r.cash > 0 ? (
                          <span className="text-green-600 font-medium">
                            ₹{r.cash.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        —
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        —
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        —
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        {r.hdfcCard > 0 ? (
                          <span className="text-blue-600 font-medium">
                            ₹{r.hdfcCard.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        {r.sbiCard > 0 ? (
                          <span className="text-indigo-600 font-medium">
                            ₹{r.sbiCard.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        {r.upi > 0 ? (
                          <span className="text-purple-600 font-medium">
                            ₹{r.upi.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        —
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        {r.staff}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        {r.user}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        {r.companyName || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.gstin || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {cashierRows.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/60 border-t-2 border-border font-semibold text-sm">
                    <td
                      className="px-3 py-2 border-r border-border"
                      colSpan={2}
                    >
                      TOTAL ({cashierRows.length} bills)
                    </td>
                    <td className="px-3 py-2 border-r border-border">
                      ₹
                      {cashierRows
                        .reduce((s, r) => s + r.billAmt, 0)
                        .toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-r border-border" />
                    <td className="px-3 py-2 text-green-600 border-r border-border">
                      ₹{cashierRows.reduce((s, r) => s + r.cash, 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-r border-border">—</td>
                    <td className="px-3 py-2 border-r border-border">—</td>
                    <td className="px-3 py-2 border-r border-border">—</td>
                    <td className="px-3 py-2 text-blue-600 border-r border-border">
                      ₹
                      {cashierRows
                        .reduce((s, r) => s + r.hdfcCard, 0)
                        .toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-indigo-600 border-r border-border">
                      ₹
                      {cashierRows
                        .reduce((s, r) => s + r.sbiCard, 0)
                        .toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-purple-600 border-r border-border">
                      ₹{cashierRows.reduce((s, r) => s + r.upi, 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-r border-border">—</td>
                    <td
                      className="px-3 py-2 border-r border-border"
                      colSpan={5}
                    />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>

        {/* ITEM WISE SALE TAB */}
        <TabsContent
          value="itemwise"
          className="mt-4 space-y-4"
          data-ocid="reports.itemwise.panel"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">
                Item Wise Detail Sale Report
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                One row per item per bill — {itemWiseRows.length} line items
                across {filteredBills.length} bills
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportItemWiseReport}
              className="gap-2"
              data-ocid="reports.itemwise.export_button"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>

          <div
            className="overflow-x-auto rounded-xl border border-border shadow-sm"
            data-ocid="reports.itemwise.table"
          >
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {[
                    "Date",
                    "Bill No.",
                    "Bill Time",
                    "Table",
                    "Goods Amt",
                    "Disc.",
                    "Non-Taxable Sale",
                    "Taxable Sale",
                    "Tax",
                    "Rndoff",
                    "Bill Amt.",
                    "Item Name",
                    "Qty",
                    "Rate",
                    "Amount",
                    "ItemDisc",
                    "Payment Mode",
                    "Company",
                    "GSTNO",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left font-semibold text-muted-foreground border-r border-border last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemWiseRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={19}
                      className="text-center py-12 text-muted-foreground"
                      data-ocid="reports.itemwise.empty_state"
                    >
                      No bills found for this period
                    </td>
                  </tr>
                ) : (
                  itemWiseRows.map((r, i) => (
                    <tr
                      key={`${r.billNo}-${r.itemName}-${i}`}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      data-ocid={`reports.itemwise.item.${i + 1}`}
                    >
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        {r.date}
                      </td>
                      <td className="px-3 py-2 font-mono border-r border-border">
                        {r.billNo}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        {r.billTime}
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        {r.table}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        {r.goodsAmt.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        {r.disc > 0 ? (
                          <span className="text-orange-600">
                            {r.disc.toFixed(2)}
                          </span>
                        ) : (
                          "0.00"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        0.00
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        {r.taxableSale.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        {r.tax.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        {r.rndoff.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold border-r border-border">
                        {r.billAmt.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 font-medium border-r border-border">
                        {r.itemName}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        {r.qty}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        {r.rate.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        {r.amount.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        0.00
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">
                          {r.paymentMode}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground border-r border-border">
                        {r.company || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.gstNo || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {itemWiseRows.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/60 border-t-2 border-border font-semibold text-xs">
                    <td
                      className="px-3 py-2 border-r border-border"
                      colSpan={4}
                    >
                      TOTAL ({itemWiseRows.length} items)
                    </td>
                    <td className="px-3 py-2 text-right border-r border-border">
                      {iwTotalGoodsAmt.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-orange-600 border-r border-border">
                      {iwTotalDisc.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-border">
                      0.00
                    </td>
                    <td className="px-3 py-2 text-right border-r border-border">
                      {iwTotalTaxableSale.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-border">
                      {iwTotalTax.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-border">
                      —
                    </td>
                    <td className="px-3 py-2 text-right border-r border-border">
                      {iwTotalBillAmt.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 border-r border-border" />
                    <td className="px-3 py-2 text-right border-r border-border">
                      {iwTotalQty}
                    </td>
                    <td className="px-3 py-2 border-r border-border" />
                    <td className="px-3 py-2 text-right border-r border-border">
                      {iwTotalAmount.toFixed(2)}
                    </td>
                    <td
                      className="px-3 py-2 border-r border-border"
                      colSpan={4}
                    />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
