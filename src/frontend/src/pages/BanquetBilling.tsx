import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
  Building2,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRestaurant } from "../context/RestaurantContext";

// Defaults (used as fallback when no Settings data exists)
const DEFAULT_HALLS = [
  { id: "hall-1", name: "Main Banquet Hall", defaultCharge: 0 },
  { id: "hall-2", name: "Garden Lawn", defaultCharge: 0 },
  { id: "hall-3", name: "Rooftop Terrace", defaultCharge: 0 },
  { id: "hall-4", name: "Conference Room", defaultCharge: 0 },
  { id: "hall-5", name: "Private Dining Room", defaultCharge: 0 },
];

const DEFAULT_VEG_ITEMS = [
  { id: "bv-1", name: "Veg Starter Platter", rate: 250 },
  { id: "bv-2", name: "Paneer Tikka", rate: 180 },
  { id: "bv-3", name: "Veg Biryani", rate: 220 },
  { id: "bv-4", name: "Dal Makhani", rate: 120 },
  { id: "bv-5", name: "Shahi Paneer", rate: 160 },
  { id: "bv-6", name: "Mix Veg Curry", rate: 130 },
  { id: "bv-7", name: "Steamed Rice", rate: 80 },
  { id: "bv-8", name: "Butter Naan", rate: 60 },
  { id: "bv-9", name: "Veg Soup", rate: 90 },
  { id: "bv-10", name: "Veg Welcome Drink", rate: 50 },
];

const DEFAULT_NON_VEG_ITEMS = [
  { id: "bnv-1", name: "Non-Veg Starter Platter", rate: 350 },
  { id: "bnv-2", name: "Chicken Tikka", rate: 280 },
  { id: "bnv-3", name: "Mutton Seekh Kebab", rate: 320 },
  { id: "bnv-4", name: "Chicken Biryani", rate: 300 },
  { id: "bnv-5", name: "Mutton Curry", rate: 350 },
  { id: "bnv-6", name: "Fish Fry", rate: 280 },
  { id: "bnv-7", name: "Egg Curry", rate: 150 },
  { id: "bnv-8", name: "Chicken Soup", rate: 120 },
  { id: "bnv-9", name: "Non-Veg Welcome Drink", rate: 70 },
];

const EXTRA_SERVICES = [
  "Photography",
  "Videography",
  "Security",
  "Valet Parking",
  "Sound System",
  "Ice Sculpture",
  "Photo Booth",
  "Caricature Artist",
  "Live Music",
];

interface Extra {
  service: string;
  amount: number;
}

interface BanquetBill {
  id: string;
  invoiceNo: string;
  eventName: string;
  eventDate: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  companyName: string;
  companyGst: string;
  guestCount: number;
  hall: string;
  hallCharge: number;
  eventNotes: string;
  vegPax: number;
  selectedVeg: string[];
  vegTotal: number;
  nonVegPax: number;
  selectedNonVeg: string[];
  nonVegTotal: number;
  djCharge: number;
  decorCharge: number;
  extras: Extra[];
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
  advancePaid: number;
  discount: number;
  balanceDue: number;
  paymentMode: string;
  createdAt: string;
}

function getFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const year = now.getFullYear();
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

function formatCurrency(amount: number, currency = "₹"): string {
  return `${currency}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getNextInvoiceNo(restaurantId: string): string {
  const key = `${restaurantId}_banquet_bill_counter`;
  const current = Number.parseInt(localStorage.getItem(key) || "0", 10);
  const next = current + 1;
  localStorage.setItem(key, String(next));
  const fy = getFinancialYear();
  const prefix =
    localStorage.getItem(`${restaurantId}_banquet_prefix`) || "BANQ";
  return `${prefix}/${fy}/${String(next).padStart(3, "0")}`;
}

function loadBills(restaurantId: string): BanquetBill[] {
  try {
    const raw = localStorage.getItem(`${restaurantId}_banquet_bills`);
    return raw ? (JSON.parse(raw) as BanquetBill[]) : [];
  } catch {
    return [];
  }
}

function saveBills(restaurantId: string, bills: BanquetBill[]): void {
  localStorage.setItem(`${restaurantId}_banquet_bills`, JSON.stringify(bills));
}

function getSettings(restaurantId: string) {
  try {
    const raw = localStorage.getItem(`${restaurantId}_settings`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function BanquetBilling() {
  const { restaurantId } = useRestaurant();
  const [activeTab, setActiveTab] = useState("new-bill");

  // Load halls and menu items from localStorage (set in Settings → Banquet Settings)
  const halls = useMemo(() => {
    try {
      const raw = localStorage.getItem(`${restaurantId}_banquet_halls`);
      if (raw)
        return JSON.parse(raw) as {
          id: string;
          name: string;
          defaultCharge: number;
        }[];
    } catch {
      /* ignore */
    }
    return DEFAULT_HALLS;
  }, [restaurantId]);

  const vegItems = useMemo(() => {
    try {
      const raw = localStorage.getItem(`${restaurantId}_banquet_veg_menu`);
      if (raw)
        return JSON.parse(raw) as { id: string; name: string; rate: number }[];
    } catch {
      /* ignore */
    }
    return DEFAULT_VEG_ITEMS;
  }, [restaurantId]);

  const nonVegItems = useMemo(() => {
    try {
      const raw = localStorage.getItem(`${restaurantId}_banquet_nonveg_menu`);
      if (raw)
        return JSON.parse(raw) as { id: string; name: string; rate: number }[];
    } catch {
      /* ignore */
    }
    return DEFAULT_NON_VEG_ITEMS;
  }, [restaurantId]);

  // Form state
  const today = new Date().toISOString().split("T")[0];
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(today);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyGst, setCompanyGst] = useState("");
  const [guestCount, setGuestCount] = useState<number>(0);
  const [hall, setHall] = useState("");
  const [hallCharge, setHallCharge] = useState<number>(0);
  const [eventNotes, setEventNotes] = useState("");

  const [vegPax, setVegPax] = useState<number>(0);
  const [selectedVeg, setSelectedVeg] = useState<string[]>([]);

  const [nonVegPax, setNonVegPax] = useState<number>(0);
  const [selectedNonVeg, setSelectedNonVeg] = useState<string[]>([]);

  const [djCharge, setDjCharge] = useState<number>(0);
  const [decorCharge, setDecorCharge] = useState<number>(0);

  const [extras, setExtras] = useState<Extra[]>([]);
  const [extraService, setExtraService] = useState("");
  const [extraAmount, setExtraAmount] = useState<number>(0);

  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState("Cash");

  const [isGenerating, setIsGenerating] = useState(false);

  // Calculations
  const vegItemTotal = vegItems
    .filter((i) => selectedVeg.includes(i.name))
    .reduce((sum, i) => sum + i.rate, 0);
  const vegTotal = vegItemTotal * vegPax;

  const nonVegItemTotal = nonVegItems
    .filter((i) => selectedNonVeg.includes(i.name))
    .reduce((sum, i) => sum + i.rate, 0);
  const nonVegTotal = nonVegItemTotal * nonVegPax;

  const extrasTotal = extras.reduce((s, e) => s + e.amount, 0);
  const subtotal =
    hallCharge + vegTotal + nonVegTotal + djCharge + decorCharge + extrasTotal;
  const discountAmount = (subtotal * discount) / 100;
  const taxableAmount = subtotal - discountAmount;
  const cgst = taxableAmount * 0.025;
  const sgst = taxableAmount * 0.025;
  const total = taxableAmount + cgst + sgst;
  const balanceDue = total - advancePaid;

  const settings = getSettings(restaurantId);
  const currency = settings.currency || "₹";

  function resetForm() {
    setEventName("");
    setEventDate(today);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setCompanyName("");
    setCompanyGst("");
    setGuestCount(0);
    setHall("");
    setHallCharge(0);
    setEventNotes("");
    setVegPax(0);
    setSelectedVeg([]);
    setNonVegPax(0);
    setSelectedNonVeg([]);
    setDjCharge(0);
    setDecorCharge(0);
    setExtras([]);
    setExtraService("");
    setExtraAmount(0);
    setAdvancePaid(0);
    setDiscount(0);
    setPaymentMode("Cash");
  }

  function addExtra() {
    if (!extraService || extraAmount <= 0) {
      toast.error("Select a service and enter a valid amount.");
      return;
    }
    setExtras((prev) => [
      ...prev,
      { service: extraService, amount: extraAmount },
    ]);
    setExtraService("");
    setExtraAmount(0);
  }

  function removeExtra(idx: number) {
    setExtras((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleVeg(name: string) {
    setSelectedVeg((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function toggleNonVeg(name: string) {
    setSelectedNonVeg((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function generateBill() {
    if (!eventName.trim()) {
      toast.error("Event Name is required.");
      return;
    }
    if (!eventDate) {
      toast.error("Event Date is required.");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Client Name is required.");
      return;
    }
    if (!clientPhone.trim()) {
      toast.error("Client Phone is required.");
      return;
    }
    if (!hall) {
      toast.error("Hall / Venue is required.");
      return;
    }

    setIsGenerating(true);

    const invoiceNo = getNextInvoiceNo(restaurantId);
    const bill: BanquetBill = {
      id: `BANQ_${Date.now()}`,
      invoiceNo,
      eventName,
      eventDate,
      clientName,
      clientPhone,
      clientEmail,
      companyName,
      companyGst,
      guestCount,
      hall,
      hallCharge,
      eventNotes,
      vegPax,
      selectedVeg,
      vegTotal,
      nonVegPax,
      selectedNonVeg,
      nonVegTotal,
      djCharge,
      decorCharge,
      extras,
      subtotal,
      cgst,
      sgst,
      total,
      advancePaid,
      discount,
      balanceDue,
      paymentMode,
      createdAt: new Date().toISOString(),
    };

    const existing = loadBills(restaurantId);
    saveBills(restaurantId, [...existing, bill]);

    // Print
    printBanquetBill(bill, settings, currency);

    toast.success(`Banquet bill ${invoiceNo} generated!`);
    resetForm();
    setIsGenerating(false);
    setActiveTab("bill-history");
  }

  function printBanquetBill(
    bill: BanquetBill,
    s: Record<string, string>,
    cur: string,
  ) {
    const restaurantName = s.restaurantName || s.name || "Restaurant";
    const address = s.address || "";
    const gstin = s.gstin || "";

    const vegLines = vegItems
      .filter((i) => bill.selectedVeg.includes(i.name))
      .map(
        (i) =>
          `<tr><td style="padding:3px 6px">${i.name}</td><td style="padding:3px 6px;text-align:right">${cur}${i.rate}/head × ${bill.vegPax}</td><td style="padding:3px 6px;text-align:right">${cur}${(i.rate * bill.vegPax).toFixed(2)}</td></tr>`,
      )
      .join("");

    const nonVegLines = nonVegItems
      .filter((i) => bill.selectedNonVeg.includes(i.name))
      .map(
        (i) =>
          `<tr><td style="padding:3px 6px">${i.name}</td><td style="padding:3px 6px;text-align:right">${cur}${i.rate}/head × ${bill.nonVegPax}</td><td style="padding:3px 6px;text-align:right">${cur}${(i.rate * bill.nonVegPax).toFixed(2)}</td></tr>`,
      )
      .join("");

    const extraLines = bill.extras
      .map(
        (e) =>
          `<tr><td style="padding:3px 6px">${e.service}</td><td style="padding:3px 6px;text-align:right">—</td><td style="padding:3px 6px;text-align:right">${cur}${e.amount.toFixed(2)}</td></tr>`,
      )
      .join("");

    const discountAmt = (bill.subtotal * bill.discount) / 100;

    const html = `<!DOCTYPE html>
<html>
<head><title>Banquet Bill - ${bill.invoiceNo}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; font-size: 13px; }
  h1 { text-align: center; font-size: 20px; margin: 0; }
  h2 { text-align: center; font-size: 14px; margin: 4px 0; }
  .center { text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f0f0; padding: 6px; text-align: left; border-bottom: 1px solid #ccc; }
  td { border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; border-top: 2px solid #333; }
  .section-header td { background: #f8f8f8; font-weight: bold; padding: 6px; }
  .grand-total td { font-size: 16px; font-weight: bold; background: #e8f0fe; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>${restaurantName}</h1>
${address ? `<h2>${address}</h2>` : ""}
${gstin ? `<p class="center" style="margin:2px">GSTIN: ${gstin}</p>` : ""}
<h2 style="background:#1e3a8a;color:white;padding:8px;border-radius:4px">BANQUET BILL</h2>
<table style="margin-bottom:12px">
  <tr><td><b>Invoice No.:</b> ${bill.invoiceNo}</td><td><b>Date:</b> ${new Date(bill.createdAt).toLocaleDateString("en-IN")}</td></tr>
  <tr><td><b>Event Name:</b> ${bill.eventName}</td><td><b>Event Date:</b> ${bill.eventDate}</td></tr>
  <tr><td><b>Client:</b> ${bill.clientName}</td><td><b>Phone:</b> ${bill.clientPhone}</td></tr>
  ${bill.clientEmail ? `<tr><td colspan="2"><b>Email:</b> ${bill.clientEmail}</td></tr>` : ""}
  ${bill.companyName ? `<tr><td><b>Company:</b> ${bill.companyName}</td><td><b>GSTIN:</b> ${bill.companyGst || "—"}</td></tr>` : ""}
  <tr><td><b>Hall / Venue:</b> ${bill.hall}</td><td><b>Guest Count:</b> ${bill.guestCount || "—"}</td></tr>
  ${bill.eventNotes ? `<tr><td colspan="2"><b>Notes:</b> ${bill.eventNotes}</td></tr>` : ""}
</table>
<table>
  <thead><tr><th>Item</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    ${bill.hallCharge > 0 ? `<tr class="section-header"><td colspan="3">Hall & Venue</td></tr><tr><td style="padding:3px 6px">Hall Charge - ${bill.hall}</td><td style="padding:3px 6px;text-align:right">—</td><td style="padding:3px 6px;text-align:right">${cur}${bill.hallCharge.toFixed(2)}</td></tr>` : ""}
    ${vegLines ? `<tr class="section-header"><td colspan="3">Veg Menu (${bill.vegPax} pax)</td></tr>${vegLines}` : ""}
    ${nonVegLines ? `<tr class="section-header"><td colspan="3">Non-Veg Menu (${bill.nonVegPax} pax)</td></tr>${nonVegLines}` : ""}
    ${bill.djCharge > 0 ? `<tr class="section-header"><td colspan="3">DJ & Decoration</td></tr><tr><td style="padding:3px 6px">DJ Charges</td><td style="padding:3px 6px;text-align:right">—</td><td style="padding:3px 6px;text-align:right">${cur}${bill.djCharge.toFixed(2)}</td></tr>` : ""}
    ${bill.decorCharge > 0 ? `<tr><td style="padding:3px 6px">Flower & Decoration</td><td style="padding:3px 6px;text-align:right">—</td><td style="padding:3px 6px;text-align:right">${cur}${bill.decorCharge.toFixed(2)}</td></tr>` : ""}
    ${extraLines ? `<tr class="section-header"><td colspan="3">Extra Services</td></tr>${extraLines}` : ""}
    <tr class="total-row"><td colspan="2" style="padding:6px">Subtotal</td><td style="padding:6px;text-align:right">${cur}${bill.subtotal.toFixed(2)}</td></tr>
    ${discountAmt > 0 ? `<tr><td colspan="2" style="padding:3px 6px">Discount (${bill.discount}%)</td><td style="padding:3px 6px;text-align:right">- ${cur}${discountAmt.toFixed(2)}</td></tr>` : ""}
    <tr><td colspan="2" style="padding:3px 6px">CGST (2.5%)</td><td style="padding:3px 6px;text-align:right">${cur}${bill.cgst.toFixed(2)}</td></tr>
    <tr><td colspan="2" style="padding:3px 6px">SGST (2.5%)</td><td style="padding:3px 6px;text-align:right">${cur}${bill.sgst.toFixed(2)}</td></tr>
    <tr class="grand-total"><td colspan="2" style="padding:8px">TOTAL</td><td style="padding:8px;text-align:right">${cur}${bill.total.toFixed(2)}</td></tr>
    ${bill.advancePaid > 0 ? `<tr><td colspan="2" style="padding:3px 6px">Advance Paid</td><td style="padding:3px 6px;text-align:right">- ${cur}${bill.advancePaid.toFixed(2)}</td></tr>` : ""}
    <tr><td colspan="2" style="padding:6px;font-weight:bold">Balance Due</td><td style="padding:6px;text-align:right;font-weight:bold;color:${bill.balanceDue <= 0 ? "green" : "red"}">${bill.balanceDue <= 0 ? "FULLY PAID" : `${cur}${bill.balanceDue.toFixed(2)}`}</td></tr>
  </tbody>
</table>
<p style="margin-top:16px"><b>Payment Mode:</b> ${bill.paymentMode}</p>
<p class="center" style="margin-top:24px;color:#999;font-size:11px">Thank you for choosing us for your event!</p>
</body></html>`;

    const win = window.open("", "_blank", "width=750,height=900");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  }

  const bills = loadBills(restaurantId);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Banquet Billing
            </h1>
            <p className="text-sm text-muted-foreground">
              Event & Function Hall Billing System
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="new-bill" data-ocid="banquet.new_bill.tab">
            New Bill
          </TabsTrigger>
          <TabsTrigger
            value="bill-history"
            data-ocid="banquet.bill_history.tab"
          >
            Bill History
          </TabsTrigger>
        </TabsList>

        {/* NEW BILL TAB */}
        <TabsContent value="new-bill">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* LEFT: Form */}
            <div className="xl:col-span-2 space-y-5">
              {/* Section 1: Event Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    Event Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="eventName">Event Name *</Label>
                    <Input
                      id="eventName"
                      data-ocid="banquet.eventName.input"
                      placeholder="Wedding Reception, Birthday Party..."
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventDate">Event Date *</Label>
                    <Input
                      id="eventDate"
                      type="date"
                      data-ocid="banquet.eventDate.input"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="guestCount">Guest Count</Label>
                    <Input
                      id="guestCount"
                      type="number"
                      min={0}
                      data-ocid="banquet.guestCount.input"
                      value={guestCount || ""}
                      onChange={(e) => setGuestCount(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientName">Client Name *</Label>
                    <Input
                      id="clientName"
                      data-ocid="banquet.clientName.input"
                      placeholder="Full name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientPhone">Client Phone *</Label>
                    <Input
                      id="clientPhone"
                      data-ocid="banquet.clientPhone.input"
                      placeholder="Mobile number"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientEmail">Client Email</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      data-ocid="banquet.clientEmail.input"
                      placeholder="email@example.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      data-ocid="banquet.companyName.input"
                      placeholder="Company / Organization name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyGst">Company GST Number</Label>
                    <Input
                      id="companyGst"
                      data-ocid="banquet.companyGst.input"
                      placeholder="15-digit GSTIN"
                      value={companyGst}
                      onChange={(e) =>
                        setCompanyGst(e.target.value.toUpperCase())
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hall">Hall / Venue *</Label>
                    <Select
                      value={hall}
                      onValueChange={(v) => {
                        setHall(v);
                        const h = halls.find((x) => x.name === v);
                        if (h && h.defaultCharge > 0)
                          setHallCharge(h.defaultCharge);
                      }}
                    >
                      <SelectTrigger
                        className="mt-1"
                        data-ocid="banquet.hall.select"
                      >
                        <SelectValue placeholder="-- Select Hall --" />
                      </SelectTrigger>
                      <SelectContent>
                        {halls.map((h) => (
                          <SelectItem key={h.id} value={h.name}>
                            {h.name}
                            {h.defaultCharge > 0
                              ? ` (₹${h.defaultCharge.toLocaleString()})`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="hallCharge">Hall Charge (₹)</Label>
                    <Input
                      id="hallCharge"
                      type="number"
                      min={0}
                      data-ocid="banquet.hallCharge.input"
                      value={hallCharge || ""}
                      onChange={(e) => setHallCharge(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="eventNotes">Event Notes</Label>
                    <Textarea
                      id="eventNotes"
                      data-ocid="banquet.eventNotes.textarea"
                      placeholder="Special requests, seating arrangement, etc."
                      value={eventNotes}
                      onChange={(e) => setEventNotes(e.target.value)}
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Veg Menu */}
              <Card className="border-green-200">
                <CardHeader className="pb-3 bg-green-50 rounded-t-lg">
                  <CardTitle className="text-base text-green-800">
                    🥗 Veg Menu Selection
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="vegPax" className="whitespace-nowrap">
                      No. of Veg Pax:
                    </Label>
                    <Input
                      id="vegPax"
                      type="number"
                      min={0}
                      data-ocid="banquet.vegPax.input"
                      value={vegPax || ""}
                      onChange={(e) => setVegPax(Number(e.target.value))}
                      className="w-28"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {vegItems.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-green-50 cursor-pointer border border-transparent hover:border-green-200 transition-colors text-left w-full"
                        onClick={() => toggleVeg(item.name)}
                      >
                        <Checkbox
                          checked={selectedVeg.includes(item.name)}
                          onCheckedChange={() => toggleVeg(item.name)}
                          data-ocid="banquet.veg.checkbox"
                        />
                        <span className="text-sm flex-1">{item.name}</span>
                        <span className="text-sm text-green-700 font-medium">
                          ₹{item.rate}/head
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between bg-green-50 rounded-lg px-4 py-2 mt-2">
                    <span className="text-sm font-medium text-green-800">
                      Veg Total ({vegPax} pax)
                    </span>
                    <span className="font-bold text-green-800">
                      {formatCurrency(vegTotal, currency)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: Non-Veg Menu */}
              <Card className="border-red-200">
                <CardHeader className="pb-3 bg-red-50 rounded-t-lg">
                  <CardTitle className="text-base text-red-800">
                    🍗 Non-Veg Menu Selection
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="nonVegPax" className="whitespace-nowrap">
                      No. of Non-Veg Pax:
                    </Label>
                    <Input
                      id="nonVegPax"
                      type="number"
                      min={0}
                      data-ocid="banquet.nonVegPax.input"
                      value={nonVegPax || ""}
                      onChange={(e) => setNonVegPax(Number(e.target.value))}
                      className="w-28"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {nonVegItems.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-red-50 cursor-pointer border border-transparent hover:border-red-200 transition-colors text-left w-full"
                        onClick={() => toggleNonVeg(item.name)}
                      >
                        <Checkbox
                          checked={selectedNonVeg.includes(item.name)}
                          onCheckedChange={() => toggleNonVeg(item.name)}
                          data-ocid="banquet.nonveg.checkbox"
                        />
                        <span className="text-sm flex-1">{item.name}</span>
                        <span className="text-sm text-red-700 font-medium">
                          ₹{item.rate}/head
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between bg-red-50 rounded-lg px-4 py-2 mt-2">
                    <span className="text-sm font-medium text-red-800">
                      Non-Veg Total ({nonVegPax} pax)
                    </span>
                    <span className="font-bold text-red-800">
                      {formatCurrency(nonVegTotal, currency)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4: DJ & Decoration */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    🎵 DJ & Decoration Services
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="djCharge">DJ Charges (₹)</Label>
                    <Input
                      id="djCharge"
                      type="number"
                      min={0}
                      data-ocid="banquet.djCharge.input"
                      value={djCharge || ""}
                      onChange={(e) => setDjCharge(Number(e.target.value))}
                      className="mt-1"
                    />
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setDjCharge(8000)}
                        className="px-3 py-1 text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        DJ (Basic) ₹8,000
                      </button>
                      <button
                        type="button"
                        onClick={() => setDjCharge(15000)}
                        className="px-3 py-1 text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        DJ (Premium) ₹15,000
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="decorCharge">Flower & Decoration (₹)</Label>
                    <Input
                      id="decorCharge"
                      type="number"
                      min={0}
                      data-ocid="banquet.decorCharge.input"
                      value={decorCharge || ""}
                      onChange={(e) => setDecorCharge(Number(e.target.value))}
                      className="mt-1"
                    />
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {[
                        { label: "Flower Gate ₹5,000", val: 5000 },
                        { label: "Stage Decor ₹12,000", val: 12000 },
                        { label: "Balloon Decor ₹3,000", val: 3000 },
                        { label: "LED Backdrop ₹8,000", val: 8000 },
                      ].map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => setDecorCharge(c.val)}
                          className="px-3 py-1 text-xs rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 5: Extra Services */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    ✨ Extra / Add-on Services
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <Select
                        value={extraService}
                        onValueChange={setExtraService}
                      >
                        <SelectTrigger data-ocid="banquet.extraService.select">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXTRA_SERVICES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Amount (₹)"
                      data-ocid="banquet.extraAmount.input"
                      value={extraAmount || ""}
                      onChange={(e) => setExtraAmount(Number(e.target.value))}
                      className="w-36"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addExtra}
                      data-ocid="banquet.addExtra.button"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  {extras.length > 0 && (
                    <div className="space-y-1">
                      {extras.map((e, idx) => (
                        <div
                          key={e.service + String(idx)}
                          className="flex items-center justify-between bg-muted rounded-lg px-3 py-2"
                          data-ocid={`banquet.extra.item.${idx + 1}`}
                        >
                          <span className="text-sm">{e.service}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {formatCurrency(e.amount, currency)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeExtra(idx)}
                              className="text-destructive hover:text-destructive/80"
                              data-ocid={`banquet.extra.delete_button.${idx + 1}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT: Billing Summary */}
            <div className="xl:col-span-1">
              <div className="sticky top-4 space-y-4">
                <Card className="border-blue-200">
                  <CardHeader className="pb-2 bg-blue-600 rounded-t-lg">
                    <CardTitle className="text-base text-white">
                      💰 Billing Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
                    {/* Line items */}
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Hall Charge
                        </span>
                        <span>{formatCurrency(hallCharge, currency)}</span>
                      </div>
                      {vegTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Veg Menu ({vegPax} pax)
                          </span>
                          <span className="text-green-700">
                            {formatCurrency(vegTotal, currency)}
                          </span>
                        </div>
                      )}
                      {nonVegTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Non-Veg Menu ({nonVegPax} pax)
                          </span>
                          <span className="text-red-700">
                            {formatCurrency(nonVegTotal, currency)}
                          </span>
                        </div>
                      )}
                      {djCharge > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            DJ Charges
                          </span>
                          <span>{formatCurrency(djCharge, currency)}</span>
                        </div>
                      )}
                      {decorCharge > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Flower & Decoration
                          </span>
                          <span>{formatCurrency(decorCharge, currency)}</span>
                        </div>
                      )}
                      {extrasTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Other Extras
                          </span>
                          <span>{formatCurrency(extrasTotal, currency)}</span>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="flex justify-between text-sm font-medium">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal, currency)}</span>
                    </div>

                    {/* Discount */}
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="discount"
                        className="whitespace-nowrap text-sm"
                      >
                        Discount %
                      </Label>
                      <Input
                        id="discount"
                        type="number"
                        min={0}
                        max={100}
                        data-ocid="banquet.discount.input"
                        value={discount || ""}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>Discount ({discount}%)</span>
                        <span>
                          -{" "}
                          {formatCurrency(
                            (subtotal * discount) / 100,
                            currency,
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">CGST (2.5%)</span>
                      <span>{formatCurrency(cgst, currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">SGST (2.5%)</span>
                      <span>{formatCurrency(sgst, currency)}</span>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-lg font-bold text-blue-700">
                      <span>TOTAL</span>
                      <span>{formatCurrency(total, currency)}</span>
                    </div>

                    {/* Advance */}
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="advance"
                        className="whitespace-nowrap text-sm"
                      >
                        Advance Paid
                      </Label>
                      <Input
                        id="advance"
                        type="number"
                        min={0}
                        data-ocid="banquet.advancePaid.input"
                        value={advancePaid || ""}
                        onChange={(e) => setAdvancePaid(Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Balance Due</span>
                      {balanceDue <= 0 ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          ✓ Fully Paid
                        </Badge>
                      ) : (
                        <span className="font-bold text-red-600 text-lg">
                          {formatCurrency(balanceDue, currency)}
                        </span>
                      )}
                    </div>

                    {/* Payment Mode */}
                    <div>
                      <Label className="text-sm mb-2 block">Payment Mode</Label>
                      <div className="flex flex-wrap gap-2">
                        {["Cash", "Card", "UPI", "Split"].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            data-ocid="banquet.paymentMode.toggle"
                            onClick={() => setPaymentMode(mode)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                              paymentMode === mode
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-background text-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 space-y-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetForm}
                          className="flex-1"
                          data-ocid="banquet.reset.button"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toast.info("Draft saved locally.")}
                          className="flex-1"
                          data-ocid="banquet.saveDraft.button"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Draft
                        </Button>
                      </div>
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={generateBill}
                        disabled={isGenerating}
                        data-ocid="banquet.generateBill.primary_button"
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Generate Banquet Bill
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* BILL HISTORY TAB */}
        <TabsContent value="bill-history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Banquet Bill History</CardTitle>
            </CardHeader>
            <CardContent>
              {bills.length === 0 ? (
                <div
                  data-ocid="banquet.history.empty_state"
                  className="text-center py-12 text-muted-foreground"
                >
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No banquet bills generated yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice No.</TableHead>
                        <TableHead>Event Name</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Event Date</TableHead>
                        <TableHead>Hall</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...bills].reverse().map((bill, idx) => (
                        <TableRow
                          key={bill.id}
                          data-ocid={`banquet.history.row.${idx + 1}`}
                        >
                          <TableCell className="font-mono text-sm font-medium">
                            {bill.invoiceNo}
                          </TableCell>
                          <TableCell>{bill.eventName}</TableCell>
                          <TableCell>
                            <div>{bill.clientName}</div>
                            <div className="text-xs text-muted-foreground">
                              {bill.clientPhone}
                            </div>
                          </TableCell>
                          <TableCell>
                            {bill.companyName ? (
                              <div>
                                <div className="text-sm">
                                  {bill.companyName}
                                </div>
                                {bill.companyGst && (
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {bill.companyGst}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{bill.eventDate}</TableCell>
                          <TableCell>{bill.hall}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(bill.total, currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{bill.paymentMode}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                printBanquetBill(bill, settings, currency)
                              }
                              data-ocid={`banquet.history.print.button.${idx + 1}`}
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              Print
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
