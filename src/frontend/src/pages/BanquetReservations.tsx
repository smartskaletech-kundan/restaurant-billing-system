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
import { Textarea } from "@/components/ui/textarea";
import { CalendarCheck, Pencil, Printer, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRestaurant } from "../context/RestaurantContext";

const DEFAULT_HALLS = [
  "Main Banquet Hall",
  "Garden Lawn",
  "Rooftop Terrace",
  "Conference Room",
  "Private Dining Room",
];

const EVENT_TYPES = [
  "Wedding",
  "Birthday",
  "Corporate",
  "Conference",
  "Social Event",
  "Other",
];

const STATUS_OPTIONS = [
  "Pending",
  "Confirmed",
  "Cancelled",
  "Completed",
] as const;
type ReservationStatus = (typeof STATUS_OPTIONS)[number];

interface BanquetReservation {
  id: string;
  reservationDate: string;
  eventDate: string;
  eventName: string;
  customerName: string;
  companyName: string;
  companyGst: string;
  phone: string;
  email: string;
  guestCount: number;
  hall: string;
  eventType: string;
  advance: number;
  notes: string;
  status: ReservationStatus;
}

function loadReservations(restaurantId: string): BanquetReservation[] {
  try {
    const raw = localStorage.getItem(`${restaurantId}_banquet_reservations`);
    return raw ? (JSON.parse(raw) as BanquetReservation[]) : [];
  } catch {
    return [];
  }
}

function saveReservations(
  restaurantId: string,
  reservations: BanquetReservation[],
): void {
  localStorage.setItem(
    `${restaurantId}_banquet_reservations`,
    JSON.stringify(reservations),
  );
}

function getSettings(restaurantId: string) {
  try {
    const raw = localStorage.getItem(`${restaurantId}_settings`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function statusBadge(status: ReservationStatus) {
  const map: Record<ReservationStatus, string> = {
    Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Confirmed: "bg-green-100 text-green-800 border-green-200",
    Cancelled: "bg-red-100 text-red-800 border-red-200",
    Completed: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${map[status]}`}
    >
      {status}
    </span>
  );
}

function printReservation(
  res: BanquetReservation,
  settings: Record<string, string>,
) {
  const restaurantName =
    settings.restaurantName || settings.name || "Restaurant";
  const address = settings.address || "";
  const gstin = settings.gstin || "";

  const html = `<!DOCTYPE html>
<html>
<head><title>Banquet Reservation - ${res.id}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; font-size: 13px; }
  h1 { text-align: center; font-size: 20px; margin: 0; }
  h2 { text-align: center; font-size: 14px; margin: 4px 0; }
  .center { text-align: center; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #f0f0f0; padding: 6px; text-align: left; border-bottom: 1px solid #ccc; }
  td { padding: 6px; border-bottom: 1px solid #eee; }
  .section { background: #1e3a8a; color: white; padding: 8px; border-radius: 4px; text-align: center; font-weight: bold; margin: 12px 0 8px; font-size: 15px; }
  .status-badge { padding: 3px 10px; border-radius: 12px; font-weight: bold; font-size: 13px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>${restaurantName}</h1>
${address ? `<h2>${address}</h2>` : ""}
${gstin ? `<p class="center" style="margin:2px">GSTIN: ${gstin}</p>` : ""}
<div class="section">BANQUET RESERVATION CONFIRMATION</div>
<table>
  <tr><td><b>Reservation ID:</b></td><td>${res.id}</td><td><b>Reservation Date:</b></td><td>${new Date(res.reservationDate).toLocaleDateString("en-IN")}</td></tr>
  <tr><td><b>Status:</b></td><td>${res.status}</td><td><b>Event Type:</b></td><td>${res.eventType}</td></tr>
</table>
<table>
  <tr><th colspan="4" style="background:#dbeafe;color:#1e40af">Event Details</th></tr>
  <tr><td><b>Event Name:</b></td><td>${res.eventName}</td><td><b>Event Date:</b></td><td>${res.eventDate}</td></tr>
  <tr><td><b>Hall / Venue:</b></td><td>${res.hall}</td><td><b>Guest Count:</b></td><td>${res.guestCount || "—"}</td></tr>
  ${res.notes ? `<tr><td><b>Notes:</b></td><td colspan="3">${res.notes}</td></tr>` : ""}
</table>
<table>
  <tr><th colspan="4" style="background:#dcfce7;color:#166534">Guest Details</th></tr>
  <tr><td><b>Customer Name:</b></td><td>${res.customerName}</td><td><b>Phone:</b></td><td>${res.phone}</td></tr>
  ${res.email ? `<tr><td><b>Email:</b></td><td colspan="3">${res.email}</td></tr>` : ""}
  ${res.companyName ? `<tr><td><b>Company:</b></td><td>${res.companyName}</td><td><b>GST No.:</b></td><td>${res.companyGst || "—"}</td></tr>` : ""}
</table>
${res.advance > 0 ? `<p><b>Advance Paid:</b> ₹${res.advance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>` : ""}
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

const EMPTY_FORM: Omit<BanquetReservation, "id" | "reservationDate"> = {
  eventDate: "",
  eventName: "",
  customerName: "",
  companyName: "",
  companyGst: "",
  phone: "",
  email: "",
  guestCount: 0,
  hall: "",
  eventType: "Wedding",
  advance: 0,
  notes: "",
  status: "Pending",
};

export function BanquetReservations() {
  const { restaurantId } = useRestaurant();
  const [activeTab, setActiveTab] = useState("new-reservation");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [reservations, setReservations] = useState<BanquetReservation[]>(() =>
    loadReservations(restaurantId),
  );

  // Filters
  const [searchName, setSearchName] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Edit dialog
  const [editRes, setEditRes] = useState<BanquetReservation | null>(null);
  const [editForm, setEditForm] = useState<BanquetReservation | null>(null);

  // Confirm cancel dialog
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const settings = useMemo(() => getSettings(restaurantId), [restaurantId]);

  const halls = useMemo(() => {
    try {
      const raw = localStorage.getItem(`${restaurantId}_banquet_halls`);
      if (raw) {
        const parsed = JSON.parse(raw) as { id: string; name: string }[];
        return parsed.map((h) => h.name);
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_HALLS;
  }, [restaurantId]);

  function setField<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.eventName.trim()) {
      toast.error("Event Name is required.");
      return;
    }
    if (!form.eventDate) {
      toast.error("Event Date is required.");
      return;
    }
    if (!form.customerName.trim()) {
      toast.error("Customer Name is required.");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Phone is required.");
      return;
    }
    if (!form.hall) {
      toast.error("Hall / Venue is required.");
      return;
    }

    const newRes: BanquetReservation = {
      ...form,
      id: `RES-${Date.now()}`,
      reservationDate: new Date().toISOString(),
      companyGst: form.companyGst.toUpperCase(),
    };

    const updated = [...reservations, newRes];
    setReservations(updated);
    saveReservations(restaurantId, updated);
    toast.success(`Reservation ${newRes.id} saved!`);
    setForm({ ...EMPTY_FORM });
    setActiveTab("history");
  }

  function handleEditSave() {
    if (!editForm) return;
    const updated = reservations.map((r) =>
      r.id === editForm.id
        ? { ...editForm, companyGst: editForm.companyGst.toUpperCase() }
        : r,
    );
    setReservations(updated);
    saveReservations(restaurantId, updated);
    toast.success("Reservation updated.");
    setEditRes(null);
    setEditForm(null);
  }

  function handleCancel(id: string) {
    const updated = reservations.map((r) =>
      r.id === id ? { ...r, status: "Cancelled" as ReservationStatus } : r,
    );
    setReservations(updated);
    saveReservations(restaurantId, updated);
    toast.success("Reservation cancelled.");
    setCancelTarget(null);
  }

  const filtered = useMemo(() => {
    return [...reservations].reverse().filter((r) => {
      if (
        searchName &&
        !r.customerName.toLowerCase().includes(searchName.toLowerCase())
      )
        return false;
      if (filterStatus !== "All" && r.status !== filterStatus) return false;
      if (filterFrom && r.eventDate < filterFrom) return false;
      if (filterTo && r.eventDate > filterTo) return false;
      return true;
    });
  }, [reservations, searchName, filterStatus, filterFrom, filterTo]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
          <CalendarCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Banquet Reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage event bookings & guest details
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger
            value="new-reservation"
            data-ocid="banquet_res.new_reservation.tab"
          >
            New Reservation
          </TabsTrigger>
          <TabsTrigger value="history" data-ocid="banquet_res.history.tab">
            Reservation History
          </TabsTrigger>
        </TabsList>

        {/* NEW RESERVATION TAB */}
        <TabsContent value="new-reservation">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-indigo-600" />
                New Reservation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Event Name */}
                <div className="sm:col-span-2">
                  <Label htmlFor="res_eventName">Event Name *</Label>
                  <Input
                    id="res_eventName"
                    data-ocid="banquet_res.eventName.input"
                    placeholder="Wedding Reception, Birthday Party..."
                    value={form.eventName}
                    onChange={(e) => setField("eventName", e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Event Date */}
                <div>
                  <Label htmlFor="res_eventDate">Event Date *</Label>
                  <Input
                    id="res_eventDate"
                    type="date"
                    data-ocid="banquet_res.eventDate.input"
                    value={form.eventDate}
                    onChange={(e) => setField("eventDate", e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Event Type */}
                <div>
                  <Label>Event Type</Label>
                  <Select
                    value={form.eventType}
                    onValueChange={(v) => setField("eventType", v)}
                  >
                    <SelectTrigger
                      className="mt-1"
                      data-ocid="banquet_res.eventType.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hall */}
                <div>
                  <Label>Hall / Venue *</Label>
                  <Select
                    value={form.hall}
                    onValueChange={(v) => setField("hall", v)}
                  >
                    <SelectTrigger
                      className="mt-1"
                      data-ocid="banquet_res.hall.select"
                    >
                      <SelectValue placeholder="-- Select Hall --" />
                    </SelectTrigger>
                    <SelectContent>
                      {halls.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Guest Count */}
                <div>
                  <Label htmlFor="res_guestCount">Guest Count</Label>
                  <Input
                    id="res_guestCount"
                    type="number"
                    min={0}
                    data-ocid="banquet_res.guestCount.input"
                    value={form.guestCount || ""}
                    onChange={(e) =>
                      setField("guestCount", Number(e.target.value))
                    }
                    className="mt-1"
                  />
                </div>

                {/* Section: Guest Details */}
                <div className="sm:col-span-2 mt-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Guest Details
                  </p>
                </div>

                {/* Customer Name */}
                <div>
                  <Label htmlFor="res_customerName">Customer Name *</Label>
                  <Input
                    id="res_customerName"
                    data-ocid="banquet_res.customerName.input"
                    placeholder="Full name"
                    value={form.customerName}
                    onChange={(e) => setField("customerName", e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Phone */}
                <div>
                  <Label htmlFor="res_phone">Phone *</Label>
                  <Input
                    id="res_phone"
                    data-ocid="banquet_res.phone.input"
                    placeholder="Mobile number"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="res_email">Email</Label>
                  <Input
                    id="res_email"
                    type="email"
                    data-ocid="banquet_res.email.input"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Company Name */}
                <div>
                  <Label htmlFor="res_companyName">Company Name</Label>
                  <Input
                    id="res_companyName"
                    data-ocid="banquet_res.companyName.input"
                    placeholder="Company / Organization"
                    value={form.companyName}
                    onChange={(e) => setField("companyName", e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Company GST */}
                <div>
                  <Label htmlFor="res_companyGst">Company GST Number</Label>
                  <Input
                    id="res_companyGst"
                    data-ocid="banquet_res.companyGst.input"
                    placeholder="15-digit GSTIN"
                    value={form.companyGst}
                    onChange={(e) =>
                      setField("companyGst", e.target.value.toUpperCase())
                    }
                    className="mt-1"
                  />
                </div>

                {/* Advance */}
                <div>
                  <Label htmlFor="res_advance">Advance Paid (₹)</Label>
                  <Input
                    id="res_advance"
                    type="number"
                    min={0}
                    data-ocid="banquet_res.advance.input"
                    value={form.advance || ""}
                    onChange={(e) =>
                      setField("advance", Number(e.target.value))
                    }
                    className="mt-1"
                  />
                </div>

                {/* Status */}
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setField("status", v as ReservationStatus)
                    }
                  >
                    <SelectTrigger
                      className="mt-1"
                      data-ocid="banquet_res.status.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <Label htmlFor="res_notes">Notes</Label>
                  <Textarea
                    id="res_notes"
                    data-ocid="banquet_res.notes.textarea"
                    placeholder="Special requests, seating arrangement, etc."
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setForm({ ...EMPTY_FORM })}
                  data-ocid="banquet_res.reset.button"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  data-ocid="banquet_res.save.button"
                >
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  Save Reservation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reservation History</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                <Input
                  placeholder="Search by customer name..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="max-w-xs"
                  data-ocid="banquet_res.search_input"
                />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger
                    className="w-40"
                    data-ocid="banquet_res.status_filter.select"
                  >
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Status</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">
                    Event Date From
                  </Label>
                  <Input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="w-40"
                    data-ocid="banquet_res.date_from.input"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="w-40"
                    data-ocid="banquet_res.date_to.input"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div
                  className="text-center py-12 text-muted-foreground"
                  data-ocid="banquet_res.history.empty_state"
                >
                  No reservations found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Res. Date</TableHead>
                        <TableHead>Event Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Hall</TableHead>
                        <TableHead>Event Type</TableHead>
                        <TableHead className="text-right">Guests</TableHead>
                        <TableHead className="text-right">Advance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((res, idx) => (
                        <TableRow
                          key={res.id}
                          data-ocid={`banquet_res.history.row.${idx + 1}`}
                        >
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(res.reservationDate).toLocaleDateString(
                              "en-IN",
                            )}
                          </TableCell>
                          <TableCell>{res.eventDate}</TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {res.customerName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {res.eventName}
                            </div>
                          </TableCell>
                          <TableCell>
                            {res.companyName ? (
                              <div>
                                <div className="text-sm">{res.companyName}</div>
                                {res.companyGst && (
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {res.companyGst}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{res.phone}</TableCell>
                          <TableCell>{res.hall}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{res.eventType}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {res.guestCount || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {res.advance > 0
                              ? `₹${res.advance.toLocaleString("en-IN")}`
                              : "—"}
                          </TableCell>
                          <TableCell>{statusBadge(res.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                title="Edit"
                                data-ocid={`banquet_res.history.edit_button.${idx + 1}`}
                                onClick={() => {
                                  setEditRes(res);
                                  setEditForm({ ...res });
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {res.status !== "Cancelled" &&
                                res.status !== "Completed" && (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7 text-red-500 hover:text-red-600"
                                    title="Cancel Reservation"
                                    data-ocid={`banquet_res.history.cancel_button.${idx + 1}`}
                                    onClick={() => setCancelTarget(res.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                title="Print"
                                data-ocid={`banquet_res.history.print.button.${idx + 1}`}
                                onClick={() => printReservation(res, settings)}
                              >
                                <Printer className="h-3 w-3" />
                              </Button>
                            </div>
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

      {/* Edit Dialog */}
      <Dialog
        open={!!editRes}
        onOpenChange={(open) => {
          if (!open) {
            setEditRes(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          data-ocid="banquet_res.edit.dialog"
        >
          <DialogHeader>
            <DialogTitle>Edit Reservation</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="sm:col-span-2">
                <Label>Event Name *</Label>
                <Input
                  value={editForm.eventName}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p ? { ...p, eventName: e.target.value } : p,
                    )
                  }
                  className="mt-1"
                  data-ocid="banquet_res.edit.eventName.input"
                />
              </div>
              <div>
                <Label>Event Date *</Label>
                <Input
                  type="date"
                  value={editForm.eventDate}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p ? { ...p, eventDate: e.target.value } : p,
                    )
                  }
                  className="mt-1"
                  data-ocid="banquet_res.edit.eventDate.input"
                />
              </div>
              <div>
                <Label>Event Type</Label>
                <Select
                  value={editForm.eventType}
                  onValueChange={(v) =>
                    setEditForm((p) => (p ? { ...p, eventType: v } : p))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hall / Venue *</Label>
                <Select
                  value={editForm.hall}
                  onValueChange={(v) =>
                    setEditForm((p) => (p ? { ...p, hall: v } : p))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="-- Select Hall --" />
                  </SelectTrigger>
                  <SelectContent>
                    {halls.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Guest Count</Label>
                <Input
                  type="number"
                  value={editForm.guestCount || ""}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p ? { ...p, guestCount: Number(e.target.value) } : p,
                    )
                  }
                  className="mt-1"
                  data-ocid="banquet_res.edit.guestCount.input"
                />
              </div>
              <div>
                <Label>Customer Name *</Label>
                <Input
                  value={editForm.customerName}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p ? { ...p, customerName: e.target.value } : p,
                    )
                  }
                  className="mt-1"
                  data-ocid="banquet_res.edit.customerName.input"
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p ? { ...p, phone: e.target.value } : p,
                    )
                  }
                  className="mt-1"
                  data-ocid="banquet_res.edit.phone.input"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p ? { ...p, email: e.target.value } : p,
                    )
                  }
                  className="mt-1"
                  data-ocid="banquet_res.edit.email.input"
                />
              </div>
              <div>
                <Label>Company Name</Label>
                <Input
                  value={editForm.companyName}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p ? { ...p, companyName: e.target.value } : p,
                    )
                  }
                  className="mt-1"
                  data-ocid="banquet_res.edit.companyName.input"
                />
              </div>
              <div>
                <Label>Company GST Number</Label>
                <Input
                  value={editForm.companyGst}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p
                        ? { ...p, companyGst: e.target.value.toUpperCase() }
                        : p,
                    )
                  }
                  className="mt-1"
                  data-ocid="banquet_res.edit.companyGst.input"
                />
              </div>
              <div>
                <Label>Advance Paid (₹)</Label>
                <Input
                  type="number"
                  value={editForm.advance || ""}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p ? { ...p, advance: Number(e.target.value) } : p,
                    )
                  }
                  className="mt-1"
                  data-ocid="banquet_res.edit.advance.input"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) =>
                    setEditForm((p) =>
                      p ? { ...p, status: v as ReservationStatus } : p,
                    )
                  }
                >
                  <SelectTrigger
                    className="mt-1"
                    data-ocid="banquet_res.edit.status.select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((p) =>
                      p ? { ...p, notes: e.target.value } : p,
                    )
                  }
                  className="mt-1"
                  rows={2}
                  data-ocid="banquet_res.edit.notes.textarea"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditRes(null);
                setEditForm(null);
              }}
              data-ocid="banquet_res.edit.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-ocid="banquet_res.edit.save_button"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent data-ocid="banquet_res.cancel.dialog">
          <DialogHeader>
            <DialogTitle>Cancel Reservation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel this reservation? This action cannot
            be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              data-ocid="banquet_res.cancel.cancel_button"
            >
              Keep Reservation
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelTarget && handleCancel(cancelTarget)}
              data-ocid="banquet_res.cancel.confirm_button"
            >
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
