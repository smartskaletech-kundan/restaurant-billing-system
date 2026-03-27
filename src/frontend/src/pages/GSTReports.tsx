import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileSpreadsheet, Printer, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Bill } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";

interface CustomerRecord {
  mobile?: string;
  companyName?: string;
  gstin?: string;
  name?: string;
}

interface PurchaseItem {
  name?: string;
  qty?: number;
  unitPrice?: number;
  gstPercent?: number;
  gstAmount?: number;
  amount?: number;
}

interface Gstr2aRecord {
  gstin: string;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  rate: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

interface Purchase {
  vendorName?: string;
  invoiceNo?: string;
  date?: string;
  total?: number;
  items?: PurchaseItem[];
  vendorGstin?: string;
}

function exportCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][][],
) {
  const flat = rows.flat();
  const csv = [headers, ...flat].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

  const purchases: Purchase[] = useMemo(() => {
    try {
      const raw = localStorage.getItem(`purchases_${restaurantId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }, [restaurantId]);

  // Filter purchases by same date range as bills
  const [importedGSTR2A, setImportedGSTR2A] = useState<Gstr2aRecord[]>([]);
  const gstr2aFileInputRef = useRef<HTMLInputElement>(null);

  const filteredPurchases = useMemo(() => {
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      return purchases.filter((p) => {
        if (!p.date) return true;
        const d = new Date(p.date);
        return d >= from && d <= to;
      });
    }
    if (!monthFilter) return purchases;
    const [year, month] = monthFilter.split("-").map(Number);
    return purchases.filter((p) => {
      if (!p.date) return true;
      const d = new Date(p.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [purchases, monthFilter, fromDate, toDate]);

  // GSTR-1: B2B bills (customer has GSTIN — bills don't store customer mobile yet, so always empty)
  // Future: match by b.customerMobile when that field is available
  const b2bBills: Array<{ bill: Bill; customer: CustomerRecord | null }> = [];

  // GSTR-1: Non-B2B bills (all bills, since no customer GSTIN matching yet)
  const nonB2BBills = filteredBills;

  // B2CL: >250000 without GSTIN
  const b2clBills = nonB2BBills.filter((b) => b.total > 250000);
  // B2CS: <=250000 without GSTIN
  const b2csBills = nonB2BBills.filter((b) => b.total <= 250000);

  // B2CS grouped by tax rate (all 5% for restaurant)
  const b2csSummary = useMemo(() => {
    const taxableVal = b2csBills.reduce(
      (s, b) => s + b.subtotal - (b.discount ?? 0),
      0,
    );
    const totalTax2 = b2csBills.reduce((s, b) => s + b.taxAmount, 0);
    return [
      {
        rate: 5,
        taxableValue: taxableVal,
        cgst: totalTax2 / 2,
        sgst: totalTax2 / 2,
        igst: 0,
      },
    ];
  }, [b2csBills]);

  // HSN Summary grouped by item name
  const hsnSummary = useMemo(() => {
    const map: Record<
      string,
      {
        qty: number;
        totalValue: number;
        taxableValue: number;
        cgst: number;
        sgst: number;
      }
    > = {};
    for (const b of filteredBills) {
      const taxRatio = b.subtotal > 0 ? b.taxAmount / b.subtotal : 0;
      for (const item of b.items) {
        if (!map[item.name])
          map[item.name] = {
            qty: 0,
            totalValue: 0,
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
          };
        const rec = map[item.name];
        rec.qty += Number(item.quantity);
        rec.taxableValue += item.subtotal;
        const itemTax = item.subtotal * taxRatio;
        rec.cgst += itemTax / 2;
        rec.sgst += itemTax / 2;
        rec.totalValue += item.subtotal + itemTax;
      }
    }
    return Object.entries(map).map(([name, data]) => ({ name, ...data }));
  }, [filteredBills]);

  // GSTR-2A: ITC from purchases
  const itcCgst = filteredPurchases.reduce((s, p) => {
    const gst = (p.items || []).reduce((ps, i) => ps + (i.gstAmount ?? 0), 0);
    return s + gst / 2;
  }, 0);
  const itcSgst = itcCgst;
  const itcIgst = 0;
  const itcTotal = itcCgst + itcSgst;

  // GSTR-3B net payable
  const outCgst = cgst;
  const outSgst = sgst;
  const netCgst = Math.max(0, outCgst - itcCgst);
  const netSgst = Math.max(0, outSgst - itcSgst);

  function fmtDate(ms: bigint | number): string {
    const d = new Date(Number(ms) / 1_000_000);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

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

  function normalizeKey(k: string): string {
    return k.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function parseGstr2aRows(rows: Record<string, string>[]): Gstr2aRecord[] {
    return rows.map((row) => {
      const get = (keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(row).find((rk) => normalizeKey(rk) === k);
          if (found !== undefined) return row[found] ?? "";
        }
        return "";
      };
      return {
        gstin: get(["gstin"]),
        supplierName: get(["suppliername", "supplier_name"]),
        invoiceNo: get(["invoiceno", "invoice_no"]),
        invoiceDate: get(["invoicedate", "invoice_date"]),
        invoiceValue:
          Number.parseFloat(get(["invoicevalue", "invoice_value"])) || 0,
        placeOfSupply: get(["placeofsupply", "place_of_supply"]),
        rate: get(["rate"]),
        taxableValue:
          Number.parseFloat(get(["taxablevalue", "taxable_value"])) || 0,
        cgst: Number.parseFloat(get(["cgst"])) || 0,
        sgst: Number.parseFloat(get(["sgst"])) || 0,
        igst: Number.parseFloat(get(["igst"])) || 0,
      };
    });
  }

  function handleGstr2aImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();
    if (ext === "json") {
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          const records = parseGstr2aRows(arr);
          setImportedGSTR2A((prev) => [...prev, ...records]);
          toast.success(`Imported ${records.length} GSTR-2A records.`);
        } catch {
          toast.error("Import failed: invalid format.");
        }
      };
      reader.readAsText(file);
    } else if (ext === "csv") {
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          const headers = lines[0].split(",").map((h) => h.trim());
          const rows = lines.slice(1).map((line) => {
            const vals = line.split(",").map((v) => v.trim());
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
              obj[h] = vals[i] ?? "";
            });
            return obj;
          });
          const records = parseGstr2aRows(rows);
          setImportedGSTR2A((prev) => [...prev, ...records]);
          toast.success(`Imported ${records.length} GSTR-2A records.`);
        } catch {
          toast.error("Import failed: invalid format.");
        }
      };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      toast.error("Excel import not available. Please use JSON or CSV format.");
    } else {
      toast.error("Import failed: invalid format.");
    }
    e.target.value = "";
  }

  function downloadGstr2aTemplate() {
    const headers = [
      "gstin",
      "supplierName",
      "invoiceNo",
      "invoiceDate",
      "invoiceValue",
      "placeOfSupply",
      "rate",
      "taxableValue",
      "cgst",
      "sgst",
      "igst",
    ];
    const sample = [
      "27AABCU9603R1ZX",
      "Sample Supplier Pvt Ltd",
      "INV/2025-26/001",
      "2025-04-01",
      "11800",
      "Within State",
      "18%",
      "10000",
      "900",
      "900",
      "0",
    ];
    const csv = [headers.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gstr2a-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5" data-ocid="gst.page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">GST Reports</h2>
          <p className="text-muted-foreground text-sm mt-1">
            GSTR-1 | GSTR-2A | GSTR-3B — as per Govt of India GST law
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
            <Printer className="h-4 w-4 mr-2" /> Print
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

      {/* Main GSTR Tabs */}
      <Tabs defaultValue="gstr1" data-ocid="gst.tabs">
        <TabsList>
          <TabsTrigger value="gstr1" data-ocid="gst.gstr1.tab">
            GSTR-1
          </TabsTrigger>
          <TabsTrigger value="gstr2a" data-ocid="gst.gstr2a.tab">
            GSTR-2A
          </TabsTrigger>
          <TabsTrigger value="gstr3b" data-ocid="gst.gstr3b.tab">
            GSTR-3B
          </TabsTrigger>
        </TabsList>

        {/* ===== GSTR-1 ===== */}
        <TabsContent value="gstr1" className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">
                GSTR-1 — Outward Supplies
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Statement of outward supplies of goods or services
              </p>
            </div>
          </div>

          <Tabs defaultValue="b2b">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="b2b" data-ocid="gst.gstr1.b2b.tab">
                B2B
              </TabsTrigger>
              <TabsTrigger value="b2cl" data-ocid="gst.gstr1.b2cl.tab">
                B2CL
              </TabsTrigger>
              <TabsTrigger value="b2cs" data-ocid="gst.gstr1.b2cs.tab">
                B2CS
              </TabsTrigger>
              <TabsTrigger value="hsn" data-ocid="gst.gstr1.hsn.tab">
                HSN Summary
              </TabsTrigger>
            </TabsList>

            {/* B2B */}
            <TabsContent value="b2b" className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">
                    4A, 4B, 4C, 6B, 6C — B2B Invoices
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bills with registered GSTIN customers
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  data-ocid="gst.gstr1.b2b.export_button"
                  className="gap-2"
                  onClick={() => {
                    const headers = [
                      "GSTIN of Recipient",
                      "Receiver Name",
                      "Invoice No.",
                      "Invoice Date",
                      "Invoice Type",
                      "Invoice Value",
                      "Place of Supply",
                      "Reverse Charge",
                      "Rate",
                      "Taxable Value",
                      "CGST Amt",
                      "SGST Amt",
                      "IGST Amt",
                    ];
                    const rows = b2bBills.map(({ bill: b, customer: c }) => [
                      [
                        c?.gstin ?? "",
                        c?.name ?? c?.companyName ?? "",
                        String(b.billNumber),
                        fmtDate(b.createdAt),
                        "Regular",
                        b.total.toFixed(2),
                        "Within State",
                        "No",
                        "5%",
                        (b.subtotal - (b.discount ?? 0)).toFixed(2),
                        (b.taxAmount / 2).toFixed(2),
                        (b.taxAmount / 2).toFixed(2),
                        "0.00",
                      ],
                    ]);
                    exportCSV(`gstr1-b2b-${monthFilter}.csv`, headers, rows);
                  }}
                >
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>
              <div
                className="overflow-x-auto rounded-xl border border-border"
                data-ocid="gst.gstr1.b2b.table"
              >
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      {[
                        "GSTIN of Recipient",
                        "Receiver Name",
                        "Invoice No.",
                        "Invoice Date",
                        "Invoice Type",
                        "Invoice Value",
                        "Place of Supply",
                        "Rev. Charge",
                        "Rate",
                        "Taxable Value",
                        "CGST Amt",
                        "SGST Amt",
                        "IGST Amt",
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
                    {b2bBills.length === 0 ? (
                      <tr>
                        <td
                          colSpan={13}
                          className="text-center py-10 text-muted-foreground"
                          data-ocid="gst.gstr1.b2b.empty_state"
                        >
                          <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 opacity-30" />
                          No B2B invoices found. Add customers with GSTIN to see
                          B2B bills here.
                        </td>
                      </tr>
                    ) : (
                      b2bBills.map(({ bill: b, customer: c }, i) => (
                        <tr
                          key={String(b.id)}
                          className="border-b border-border last:border-0 hover:bg-muted/30"
                          data-ocid={`gst.gstr1.b2b.item.${i + 1}`}
                        >
                          <td className="px-3 py-2 font-mono border-r border-border">
                            {c?.gstin ?? "—"}
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            {c?.name ?? c?.companyName ?? "—"}
                          </td>
                          <td className="px-3 py-2 font-mono border-r border-border">
                            {String(b.billNumber)}
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            {fmtDate(b.createdAt)}
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            Regular
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{b.total.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            Within State
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            No
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            5%
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{(b.subtotal - (b.discount ?? 0)).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{(b.taxAmount / 2).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{(b.taxAmount / 2).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">₹0.00</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* B2CL */}
            <TabsContent value="b2cl" className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">
                    5A, 5B — B2C Large Invoices (&gt;₹2,50,000)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Unregistered buyers with invoice value &gt; ₹2,50,000
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-ocid="gst.gstr1.b2cl.export_button"
                  onClick={() => {
                    const headers = [
                      "Invoice No.",
                      "Invoice Date",
                      "Invoice Value",
                      "Place of Supply",
                      "Rate",
                      "Taxable Value",
                      "CGST Amt",
                      "SGST Amt",
                      "IGST Amt",
                    ];
                    const rows = b2clBills.map((b) => [
                      [
                        String(b.billNumber),
                        fmtDate(b.createdAt),
                        b.total.toFixed(2),
                        "Within State",
                        "5%",
                        (b.subtotal - (b.discount ?? 0)).toFixed(2),
                        (b.taxAmount / 2).toFixed(2),
                        (b.taxAmount / 2).toFixed(2),
                        "0.00",
                      ],
                    ]);
                    exportCSV(`gstr1-b2cl-${monthFilter}.csv`, headers, rows);
                  }}
                >
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>
              <div
                className="overflow-x-auto rounded-xl border border-border"
                data-ocid="gst.gstr1.b2cl.table"
              >
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      {[
                        "Invoice No.",
                        "Invoice Date",
                        "Invoice Value",
                        "Place of Supply",
                        "Rate",
                        "Taxable Value",
                        "CGST Amt",
                        "SGST Amt",
                        "IGST Amt",
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
                    {b2clBills.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-center py-10 text-muted-foreground"
                          data-ocid="gst.gstr1.b2cl.empty_state"
                        >
                          No B2CL invoices (no unregistered invoices above
                          ₹2,50,000)
                        </td>
                      </tr>
                    ) : (
                      b2clBills.map((b, i) => (
                        <tr
                          key={String(b.id)}
                          className="border-b border-border last:border-0 hover:bg-muted/30"
                          data-ocid={`gst.gstr1.b2cl.item.${i + 1}`}
                        >
                          <td className="px-3 py-2 font-mono border-r border-border">
                            {String(b.billNumber)}
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            {fmtDate(b.createdAt)}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{b.total.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            Within State
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            5%
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{(b.subtotal - (b.discount ?? 0)).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{(b.taxAmount / 2).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{(b.taxAmount / 2).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">₹0.00</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* B2CS */}
            <TabsContent value="b2cs" className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">
                    7 — B2C Small (Consolidated, ≤₹2,50,000)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Aggregated summary grouped by tax rate
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-ocid="gst.gstr1.b2cs.export_button"
                  onClick={() => {
                    const headers = [
                      "Type",
                      "Place of Supply",
                      "Rate",
                      "Taxable Value",
                      "CGST",
                      "SGST",
                      "IGST",
                    ];
                    const rows = b2csSummary.map((r) => [
                      [
                        "OE",
                        "Within State",
                        `${r.rate}%`,
                        r.taxableValue.toFixed(2),
                        r.cgst.toFixed(2),
                        r.sgst.toFixed(2),
                        r.igst.toFixed(2),
                      ],
                    ]);
                    exportCSV(`gstr1-b2cs-${monthFilter}.csv`, headers, rows);
                  }}
                >
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>
              <div
                className="overflow-x-auto rounded-xl border border-border"
                data-ocid="gst.gstr1.b2cs.table"
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      {[
                        "Type",
                        "Place of Supply",
                        "Rate",
                        "Taxable Value",
                        "CGST",
                        "SGST",
                        "IGST",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-semibold text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b2csBills.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-10 text-muted-foreground"
                          data-ocid="gst.gstr1.b2cs.empty_state"
                        >
                          No B2CS invoices for this period
                        </td>
                      </tr>
                    ) : (
                      b2csSummary.map((r) => (
                        <tr
                          key={r.rate}
                          className="border-b border-border last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">OE</td>
                          <td className="px-4 py-3">Within State</td>
                          <td className="px-4 py-3 font-medium">{r.rate}%</td>
                          <td className="px-4 py-3 text-right font-semibold">
                            ₹{r.taxableValue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            ₹{r.cgst.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            ₹{r.sgst.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            ₹{r.igst.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* HSN Summary */}
            <TabsContent value="hsn" className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">
                    12 — HSN/SAC Wise Summary
                  </p>
                  <p className="text-xs text-muted-foreground">
                    HSN 996331 — Restaurant services (SAC code)
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-ocid="gst.gstr1.hsn.export_button"
                  onClick={() => {
                    const headers = [
                      "HSN/SAC",
                      "Description",
                      "UOM",
                      "Total Qty",
                      "Total Value",
                      "Taxable Value",
                      "CGST",
                      "SGST",
                      "IGST",
                    ];
                    const rows = hsnSummary.map((r) => [
                      [
                        "996331",
                        r.name,
                        "NOS",
                        r.qty.toString(),
                        r.totalValue.toFixed(2),
                        r.taxableValue.toFixed(2),
                        r.cgst.toFixed(2),
                        r.sgst.toFixed(2),
                        "0.00",
                      ],
                    ]);
                    exportCSV(`gstr1-hsn-${monthFilter}.csv`, headers, rows);
                  }}
                >
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>
              <div
                className="overflow-x-auto rounded-xl border border-border"
                data-ocid="gst.gstr1.hsn.table"
              >
                <table className="w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      {[
                        "HSN/SAC",
                        "Description",
                        "UOM",
                        "Total Qty",
                        "Total Value",
                        "Taxable Value",
                        "CGST",
                        "SGST",
                        "IGST",
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
                    {hsnSummary.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-center py-10 text-muted-foreground"
                          data-ocid="gst.gstr1.hsn.empty_state"
                        >
                          No item data for HSN summary
                        </td>
                      </tr>
                    ) : (
                      hsnSummary.map((r, i) => (
                        <tr
                          key={r.name}
                          className="border-b border-border last:border-0 hover:bg-muted/30"
                          data-ocid={`gst.gstr1.hsn.item.${i + 1}`}
                        >
                          <td className="px-3 py-2 font-mono border-r border-border">
                            996331
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            {r.name}
                          </td>
                          <td className="px-3 py-2 border-r border-border">
                            NOS
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            {r.qty}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{r.totalValue.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{r.taxableValue.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{r.cgst.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right border-r border-border">
                            ₹{r.sgst.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">₹0.00</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {hsnSummary.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/60 border-t-2 border-border font-semibold text-xs">
                        <td
                          className="px-3 py-2 border-r border-border"
                          colSpan={3}
                        >
                          TOTAL
                        </td>
                        <td className="px-3 py-2 text-right border-r border-border">
                          {hsnSummary.reduce((s, r) => s + r.qty, 0)}
                        </td>
                        <td className="px-3 py-2 text-right border-r border-border">
                          ₹
                          {hsnSummary
                            .reduce((s, r) => s + r.totalValue, 0)
                            .toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right border-r border-border">
                          ₹
                          {hsnSummary
                            .reduce((s, r) => s + r.taxableValue, 0)
                            .toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right border-r border-border">
                          ₹
                          {hsnSummary
                            .reduce((s, r) => s + r.cgst, 0)
                            .toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right border-r border-border">
                          ₹
                          {hsnSummary
                            .reduce((s, r) => s + r.sgst, 0)
                            .toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">₹0.00</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ===== GSTR-2A ===== */}
        <TabsContent value="gstr2a" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">
                GSTR-2A — Inward Supplies (Auto-populated)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auto-populated from your suppliers&apos; GSTR-1 filings on the
                GST portal
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {importedGSTR2A.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    {importedGSTR2A.length} imported
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Clear imported records"
                    data-ocid="gst.gstr2a.clear_imported_button"
                    onClick={() => setImportedGSTR2A([])}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <button
                type="button"
                className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800"
                onClick={downloadGstr2aTemplate}
                data-ocid="gst.gstr2a.template_button"
              >
                Download Template
              </button>
              <input
                ref={gstr2aFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                className="hidden"
                onChange={handleGstr2aImport}
                data-ocid="gst.gstr2a.upload_button"
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                data-ocid="gst.gstr2a.import_button"
                onClick={() => gstr2aFileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Import
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                data-ocid="gst.gstr2a.export_button"
                onClick={() => {
                  const headers = [
                    "GSTIN of Supplier",
                    "Supplier Name",
                    "Invoice No.",
                    "Invoice Date",
                    "Invoice Value",
                    "Place of Supply",
                    "Rate",
                    "Taxable Value",
                    "CGST",
                    "SGST",
                    "IGST",
                  ];
                  const purchaseRows = filteredPurchases.map((p) => [
                    [
                      p.vendorGstin ?? "",
                      p.vendorName ?? "",
                      p.invoiceNo ?? "",
                      p.date ?? "",
                      (p.total ?? 0).toFixed(2),
                      "Within State",
                      "5%",
                      (
                        (p.total ?? 0) -
                        (p.items || []).reduce(
                          (s, i) => s + (i.gstAmount ?? 0),
                          0,
                        )
                      ).toFixed(2),
                      (
                        (p.items || []).reduce(
                          (s, i) => s + (i.gstAmount ?? 0),
                          0,
                        ) / 2
                      ).toFixed(2),
                      (
                        (p.items || []).reduce(
                          (s, i) => s + (i.gstAmount ?? 0),
                          0,
                        ) / 2
                      ).toFixed(2),
                      "0.00",
                    ],
                  ]);
                  const importedRows = importedGSTR2A.map((r) => [
                    [
                      r.gstin,
                      r.supplierName,
                      r.invoiceNo,
                      r.invoiceDate,
                      r.invoiceValue.toFixed(2),
                      r.placeOfSupply,
                      r.rate,
                      r.taxableValue.toFixed(2),
                      r.cgst.toFixed(2),
                      r.sgst.toFixed(2),
                      r.igst.toFixed(2),
                    ],
                  ]);
                  exportCSV(`gstr2a-${monthFilter}.csv`, headers, [
                    ...purchaseRows,
                    ...importedRows,
                  ]);
                }}
              >
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
            <strong>ℹ️ Note:</strong> GSTR-2A is auto-populated by the GST portal
            from your suppliers' GSTR-1 filings. Data shown here is from your
            recorded purchases. Always verify on the official GST portal
            (gst.gov.in).
          </div>

          <div
            className="overflow-x-auto rounded-xl border border-border"
            data-ocid="gst.gstr2a.table"
          >
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {[
                    "GSTIN of Supplier",
                    "Supplier Name",
                    "Invoice No.",
                    "Invoice Date",
                    "Invoice Value",
                    "Place of Supply",
                    "Rate",
                    "Taxable Value",
                    "CGST",
                    "SGST",
                    "IGST",
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
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="text-center py-12 text-muted-foreground"
                      data-ocid="gst.gstr2a.empty_state"
                    >
                      <FileSpreadsheet className="mx-auto mb-3 h-8 w-8 opacity-30" />
                      <p>No purchase records found.</p>
                      <p className="text-xs mt-1">
                        Add purchases in the Purchases module to populate this
                        report.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p, i) => {
                    const pGst = (p.items || []).reduce(
                      (s, it) => s + (it.gstAmount ?? 0),
                      0,
                    );
                    const pTaxable = (p.total ?? 0) - pGst;
                    return (
                      <tr
                        key={`purchase-${p.invoiceNo ?? ""}-${i}`}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                        data-ocid={`gst.gstr2a.item.${i + 1}`}
                      >
                        <td className="px-3 py-2 font-mono border-r border-border">
                          {p.vendorGstin ?? "—"}
                        </td>
                        <td className="px-3 py-2 border-r border-border">
                          {p.vendorName ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono border-r border-border">
                          {p.invoiceNo ?? "—"}
                        </td>
                        <td className="px-3 py-2 border-r border-border">
                          {p.date ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right border-r border-border">
                          ₹{(p.total ?? 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 border-r border-border">
                          Within State
                        </td>
                        <td className="px-3 py-2 border-r border-border">5%</td>
                        <td className="px-3 py-2 text-right border-r border-border">
                          ₹{pTaxable.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right border-r border-border">
                          ₹{(pGst / 2).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right border-r border-border">
                          ₹{(pGst / 2).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">₹0.00</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {importedGSTR2A.length > 0 && (
                <tbody>
                  <tr className="bg-blue-50/40">
                    <td
                      colSpan={11}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-700 border-b border-blue-100"
                    >
                      Imported Records ({importedGSTR2A.length})
                    </td>
                  </tr>
                  {importedGSTR2A.map((r, i) => (
                    <tr
                      key={`imported-${r.gstin}-${r.invoiceNo}-${i}`}
                      className="border-b border-border last:border-0 hover:bg-blue-50/20 bg-blue-50/10"
                      data-ocid={`gst.gstr2a.imported.item.${i + 1}`}
                    >
                      <td className="px-3 py-2 font-mono border-r border-border">
                        {r.gstin || "—"}
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        {r.supplierName || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono border-r border-border">
                        {r.invoiceNo || "—"}
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        {r.invoiceDate || "—"}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        ₹{r.invoiceValue.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        {r.placeOfSupply || "—"}
                      </td>
                      <td className="px-3 py-2 border-r border-border">
                        {r.rate || "—"}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        ₹{r.taxableValue.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        ₹{r.cgst.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right border-r border-border">
                        ₹{r.sgst.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        ₹{r.igst.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
              {(filteredPurchases.length > 0 || importedGSTR2A.length > 0) && (
                <tfoot>
                  <tr className="bg-muted/60 border-t-2 border-border font-semibold text-xs">
                    <td
                      className="px-3 py-2 border-r border-border"
                      colSpan={4}
                    >
                      TOTAL ({filteredPurchases.length + importedGSTR2A.length}{" "}
                      invoices)
                    </td>
                    <td className="px-3 py-2 text-right border-r border-border">
                      ₹
                      {(
                        filteredPurchases.reduce(
                          (s, p) => s + (p.total ?? 0),
                          0,
                        ) +
                        importedGSTR2A.reduce((s, r) => s + r.invoiceValue, 0)
                      ).toFixed(2)}
                    </td>
                    <td
                      className="px-3 py-2 border-r border-border"
                      colSpan={2}
                    />
                    <td className="px-3 py-2 text-right border-r border-border">
                      ₹
                      {(
                        filteredPurchases.reduce((s, p) => {
                          const pGst = (p.items || []).reduce(
                            (sg, it) => sg + (it.gstAmount ?? 0),
                            0,
                          );
                          return s + (p.total ?? 0) - pGst;
                        }, 0) +
                        importedGSTR2A.reduce((s, r) => s + r.taxableValue, 0)
                      ).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-border">
                      ₹
                      {(
                        itcCgst + importedGSTR2A.reduce((s, r) => s + r.cgst, 0)
                      ).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-border">
                      ₹
                      {(
                        itcSgst + importedGSTR2A.reduce((s, r) => s + r.sgst, 0)
                      ).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      ₹
                      {importedGSTR2A
                        .reduce((s, r) => s + r.igst, 0)
                        .toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>

        {/* ===== GSTR-3B ===== */}
        <TabsContent
          value="gstr3b"
          className="mt-4 space-y-6"
          data-ocid="gst.gstr3b.panel"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">
                GSTR-3B — Monthly Summary Return
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Summary of outward supplies, ITC, and net tax payable
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              data-ocid="gst.gstr3b.export_button"
              onClick={() => {
                const headers = [
                  "Section",
                  "Description",
                  "Taxable Value",
                  "CGST",
                  "SGST",
                  "IGST",
                ];
                const rows: (string | number)[][][] = [
                  [
                    [
                      "3.1",
                      "Taxable Supplies (B2B+B2C)",
                      totalTaxable.toFixed(2),
                      outCgst.toFixed(2),
                      outSgst.toFixed(2),
                      "0.00",
                    ],
                  ],
                  [["3.1", "Zero Rated", "0.00", "0.00", "0.00", "0.00"]],
                  [
                    [
                      "3.1",
                      "Nil Rated / Exempt",
                      "0.00",
                      "0.00",
                      "0.00",
                      "0.00",
                    ],
                  ],
                  [
                    [
                      "4",
                      "ITC Available",
                      itcTotal.toFixed(2),
                      itcCgst.toFixed(2),
                      itcSgst.toFixed(2),
                      itcIgst.toFixed(2),
                    ],
                  ],
                  [
                    [
                      "NET",
                      "Net Tax Payable",
                      "",
                      netCgst.toFixed(2),
                      netSgst.toFixed(2),
                      "0.00",
                    ],
                  ],
                ];
                exportCSV(`gstr3b-${monthFilter}.csv`, headers, rows);
              }}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
            <strong>⚠️ Note:</strong> This is a summary for reference only. File
            actual GSTR-3B on the GST portal (gst.gov.in) before the due date.
          </div>

          {/* 3.1 Outward Supplies */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">
              3.1 — Details of Outward Supplies and Inward Supplies Liable to
              Reverse Charge
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card
                className="border-green-200"
                data-ocid="gst.gstr3b.taxable.card"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-medium">
                    Taxable Supplies (B2B + B2C)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Taxable Value</span>
                    <span className="font-semibold">
                      ₹{totalTaxable.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">CGST</span>
                    <span className="font-semibold">₹{outCgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">SGST</span>
                    <span className="font-semibold">₹{outSgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">IGST</span>
                    <span className="font-semibold">₹0.00</span>
                  </div>
                </CardContent>
              </Card>
              <Card data-ocid="gst.gstr3b.zero_rated.card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-medium">
                    Zero Rated (Exports)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Taxable Value: ₹0.00
                  </p>
                  <p className="text-xs text-muted-foreground">IGST: ₹0.00</p>
                </CardContent>
              </Card>
              <Card data-ocid="gst.gstr3b.nil_rated.card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-medium">
                    Nil Rated / Exempt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Taxable Value: ₹0.00
                  </p>
                </CardContent>
              </Card>
              <Card data-ocid="gst.gstr3b.total_output.card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium">
                    Total Output Tax
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-primary">
                    ₹{totalGST.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CGST ₹{outCgst.toFixed(2)} + SGST ₹{outSgst.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 4. ITC */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">
              4 — Eligible ITC (Input Tax Credit from Purchases)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card
                className="border-blue-200"
                data-ocid="gst.gstr3b.itc_total.card"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-medium">
                    ITC Available (Total)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-blue-600">
                    ₹{itcTotal.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {filteredPurchases.length} purchase invoice(s)
                  </p>
                </CardContent>
              </Card>
              <Card data-ocid="gst.gstr3b.itc_cgst.card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-medium">
                    CGST ITC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">₹{itcCgst.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card data-ocid="gst.gstr3b.itc_sgst.card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-medium">
                    SGST ITC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">₹{itcSgst.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card data-ocid="gst.gstr3b.itc_igst.card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-medium">
                    IGST ITC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">₹{itcIgst.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Net Tax Payable */}
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">
              Net Tax Payable (Output Tax − ITC)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card
                className={`border-2 ${netCgst > 0 ? "border-red-300" : "border-green-300"}`}
                data-ocid="gst.gstr3b.net_cgst.card"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Net CGST Payable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className={`text-2xl font-bold ${netCgst > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    ₹{netCgst.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Output ₹{outCgst.toFixed(2)} − ITC ₹{itcCgst.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              <Card
                className={`border-2 ${netSgst > 0 ? "border-red-300" : "border-green-300"}`}
                data-ocid="gst.gstr3b.net_sgst.card"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Net SGST Payable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className={`text-2xl font-bold ${netSgst > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    ₹{netSgst.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Output ₹{outSgst.toFixed(2)} − ITC ₹{itcSgst.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              <Card
                className="border-2 border-muted"
                data-ocid="gst.gstr3b.net_igst.card"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Net IGST Payable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-muted-foreground">
                    ₹0.00
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No inter-state supplies
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
