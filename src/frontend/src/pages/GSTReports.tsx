import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Bill } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";

export function GSTReports() {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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

  const filteredBills = useMemo(() => {
    // Date range takes priority if both set
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      return bills.filter((b) => {
        const d = new Date(Number(b.createdAt) / 1_000_000);
        return d >= from && d <= to;
      });
    }
    if (!monthFilter) return bills;
    const [year, month] = monthFilter.split("-").map(Number);
    return bills.filter((b) => {
      const d = new Date(Number(b.createdAt) / 1_000_000);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [bills, monthFilter, fromDate, toDate]);

  const totalTaxable = filteredBills.reduce((s, b) => s + b.subtotal, 0);
  const totalGST = filteredBills.reduce((s, b) => s + b.taxAmount, 0);
  const cgst = totalGST / 2;
  const sgst = totalGST / 2;

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="gst.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-ocid="gst.page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">GST Reports</h2>
          <p className="text-muted-foreground text-sm mt-1">
            CGST 2.5% + SGST 2.5% = 5% GST
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="gst-month" className="text-sm">
              Month
            </Label>
            <Input
              id="gst-month"
              type="month"
              data-ocid="gst.month_input"
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setFromDate("");
                setToDate("");
              }}
              className="w-40"
            />
          </div>
          <Button
            data-ocid="gst.print_button"
            variant="outline"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          Date Range (overrides month):
        </span>
        <div className="flex items-center gap-2">
          <Label htmlFor="gst-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="gst-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="gst.from_date_input"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="gst-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="gst-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-ocid="gst.to_date_input"
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
            data-ocid="gst.clear_date_button"
          >
            ✕ Clear Range
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-ocid="gst.taxable.card">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Total Taxable Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₹{totalTaxable.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card data-ocid="gst.cgst.card">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Total CGST (2.5%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₹{cgst.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card data-ocid="gst.sgst.card">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Total SGST (2.5%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₹{sgst.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card data-ocid="gst.total_gst.card">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Total GST (5%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              ₹{totalGST.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div
        className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        data-ocid="gst.table"
      >
        {filteredBills.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="gst.empty_state"
          >
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>No bills for the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Bill #",
                    "Date",
                    "Table",
                    "Subtotal",
                    "CGST (2.5%)",
                    "SGST (2.5%)",
                    "Total GST",
                    "Grand Total",
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
                {filteredBills.map((b, i) => {
                  const billCgst = b.taxAmount / 2;
                  const billSgst = b.taxAmount / 2;
                  return (
                    <tr
                      key={b.id}
                      data-ocid={`gst.item.${i + 1}`}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        #{Number(b.billNumber)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(
                          Number(b.createdAt) / 1_000_000,
                        ).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {b.tableName}
                      </td>
                      <td className="px-4 py-3">₹{b.subtotal.toFixed(2)}</td>
                      <td className="px-4 py-3">₹{billCgst.toFixed(2)}</td>
                      <td className="px-4 py-3">₹{billSgst.toFixed(2)}</td>
                      <td className="px-4 py-3 font-medium">
                        ₹{b.taxAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        ₹{b.total.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-4 py-3 font-bold" colSpan={3}>
                    Total
                  </td>
                  <td className="px-4 py-3 font-bold">
                    ₹{totalTaxable.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-bold">₹{cgst.toFixed(2)}</td>
                  <td className="px-4 py-3 font-bold">₹{sgst.toFixed(2)}</td>
                  <td className="px-4 py-3 font-bold">
                    ₹{totalGST.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-bold text-primary">
                    ₹{filteredBills.reduce((s, b) => s + b.total, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
