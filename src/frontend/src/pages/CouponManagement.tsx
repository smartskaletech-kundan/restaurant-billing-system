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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRestaurant } from "../context/RestaurantContext";
import { getCurrentFY } from "../utils/billFormat";

interface Coupon {
  id: string;
  code: string;
  name: string;
  discountType: "percent" | "flat";
  discountValue: number;
  minOrderAmount: number;
  maxUses: number;
  usedCount: number;
  expiryDate: string; // ISO date string
  assignedMobile: string; // empty = open coupon, filled = customer-specific
  status: "active" | "expired" | "used_up";
  createdAt: string;
  fy: string;
}

interface CouponUsage {
  id: string;
  couponId: string;
  couponCode: string;
  mobileNumber: string;
  billId: string;
  billAmount: number;
  discountApplied: number;
  usedAt: string;
}

function getStorageKey(restaurantId: string, suffix: string) {
  return `coupon_${suffix}_${restaurantId}`;
}

function loadCoupons(restaurantId: string): Coupon[] {
  try {
    const raw = localStorage.getItem(getStorageKey(restaurantId, "list"));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCoupons(restaurantId: string, coupons: Coupon[]) {
  localStorage.setItem(
    getStorageKey(restaurantId, "list"),
    JSON.stringify(coupons),
  );
}

function loadUsages(restaurantId: string): CouponUsage[] {
  try {
    const raw = localStorage.getItem(getStorageKey(restaurantId, "usage"));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function computeStatus(coupon: Coupon): Coupon["status"] {
  const now = new Date();
  const expiry = new Date(coupon.expiryDate);
  if (expiry < now) return "expired";
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses)
    return "used_up";
  return "active";
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  used_up: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  expired: "Expired",
  used_up: "Used Up",
};

const EMPTY_FORM: {
  code: string;
  name: string;
  discountType: "percent" | "flat";
  discountValue: string;
  minOrderAmount: string;
  maxUses: string;
  expiryDate: string;
  assignedMobile: string;
} = {
  code: "",
  name: "",
  discountType: "percent" as "percent" | "flat",
  discountValue: "",
  minOrderAmount: "",
  maxUses: "",
  expiryDate: "",
  assignedMobile: "",
};

export function CouponManagement() {
  const { restaurantId } = useRestaurant();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [usages, setUsages] = useState<CouponUsage[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Coupon | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const fy = getCurrentFY();

  useEffect(() => {
    if (!restaurantId) return;
    const raw = loadCoupons(restaurantId).map((c) => ({
      ...c,
      status: computeStatus(c),
    }));
    setCoupons(raw);
    setUsages(loadUsages(restaurantId));
  }, [restaurantId]);

  const filtered = useMemo(() => {
    return coupons.filter((c) => {
      const matchSearch =
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.assignedMobile.includes(search);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [coupons, search, statusFilter]);

  const stats = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter((c) => c.status === "active").length;
    const expired = coupons.filter((c) => c.status === "expired").length;
    const usedUp = coupons.filter((c) => c.status === "used_up").length;
    const totalDiscount = usages.reduce((s, u) => s + u.discountApplied, 0);
    return { total, active, expired, usedUp, totalDiscount };
  }, [coupons, usages]);

  function openNew() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  }

  function openEdit(c: Coupon) {
    setEditTarget(c);
    setForm({
      code: c.code,
      name: c.name,
      discountType: c.discountType,
      discountValue: c.discountValue.toString(),
      minOrderAmount: c.minOrderAmount.toString(),
      maxUses: c.maxUses.toString(),
      expiryDate: c.expiryDate,
      assignedMobile: c.assignedMobile,
    });
    setShowDialog(true);
  }

  function handleSave() {
    if (!form.code.trim()) return toast.error("Coupon code is required");
    if (!form.name.trim()) return toast.error("Coupon name is required");
    const discountValue = Number.parseFloat(form.discountValue);
    if (Number.isNaN(discountValue) || discountValue <= 0)
      return toast.error("Enter a valid discount value");
    if (!form.expiryDate) return toast.error("Expiry date is required");

    const now = new Date().toISOString();
    const newCoupon: Coupon = {
      id: editTarget?.id ?? Math.random().toString(36).substring(2, 10),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      discountType: form.discountType,
      discountValue,
      minOrderAmount: Number.parseFloat(form.minOrderAmount) || 0,
      maxUses: Number.parseInt(form.maxUses) || 0,
      usedCount: editTarget?.usedCount ?? 0,
      expiryDate: form.expiryDate,
      assignedMobile: form.assignedMobile.trim(),
      status: "active",
      createdAt: editTarget?.createdAt ?? now,
      fy,
    };
    newCoupon.status = computeStatus(newCoupon);

    const updated = editTarget
      ? coupons.map((c) => (c.id === editTarget.id ? newCoupon : c))
      : [...coupons, newCoupon];

    setCoupons(updated);
    saveCoupons(restaurantId!, updated);
    setShowDialog(false);
    toast.success(editTarget ? "Coupon updated" : "Coupon created");
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const updated = coupons.filter((c) => c.id !== deleteTarget.id);
    setCoupons(updated);
    saveCoupons(restaurantId!, updated);
    setDeleteTarget(null);
    toast.success("Coupon deleted");
  }

  function generateCode() {
    const prefix = "COUP";
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    setForm((f) => ({ ...f, code: `${prefix}${rand}` }));
  }

  function createBulkCoupons() {
    const count = 10;
    const newCoupons: Coupon[] = [];
    for (let i = 0; i < count; i++) {
      const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
      const now = new Date();
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + 3);
      const c: Coupon = {
        id: Math.random().toString(36).substring(2, 10),
        code: `BULK${rand}`,
        name: "Bulk Offer",
        discountType: "percent",
        discountValue: 10,
        minOrderAmount: 0,
        maxUses: 1,
        usedCount: 0,
        expiryDate: expiry.toISOString().slice(0, 10),
        assignedMobile: "",
        status: "active",
        createdAt: now.toISOString(),
        fy,
      };
      newCoupons.push(c);
    }
    const updated = [...coupons, ...newCoupons];
    setCoupons(updated);
    saveCoupons(restaurantId!, updated);
    toast.success(`${count} bulk coupons created (10% off, valid 3 months)`);
  }

  return (
    <div className="p-6 space-y-6" data-ocid="coupon.root">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupon Management</h1>
          <p className="text-muted-foreground text-sm">FY {fy}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={createBulkCoupons}>
            Create Bulk (10 coupons)
          </Button>
          <Button onClick={openNew}>+ New Coupon</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Active", value: stats.active, color: "text-green-600" },
          { label: "Expired", value: stats.expired, color: "text-red-500" },
          { label: "Used Up", value: stats.usedUp, color: "text-gray-500" },
          {
            label: "Total Discount Given",
            value: `₹${stats.totalDiscount.toFixed(2)}`,
            color: "text-primary",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-card border rounded-lg p-4 text-center shadow-sm"
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="coupons">
        <TabsList>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="usage">Usage History</TabsTrigger>
        </TabsList>

        <TabsContent value="coupons" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Search by code, name, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
              data-ocid="coupon.search"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="used_up">Used Up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border rounded-lg overflow-auto shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Min Order</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Assigned Mobile</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-10"
                    >
                      No coupons found
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold">
                      {c.code}
                    </TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>
                      {c.discountType === "percent"
                        ? `${c.discountValue}%`
                        : `₹${c.discountValue}`}
                    </TableCell>
                    <TableCell>
                      {c.minOrderAmount > 0 ? `₹${c.minOrderAmount}` : "—"}
                    </TableCell>
                    <TableCell>
                      {c.usedCount} / {c.maxUses > 0 ? c.maxUses : "∞"}
                    </TableCell>
                    <TableCell>
                      {c.assignedMobile || (
                        <span className="text-muted-foreground text-xs">
                          Open
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(c.expiryDate).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[c.status]}>
                        {STATUS_LABELS[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(c)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(c)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <div className="bg-card border rounded-lg overflow-auto shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coupon Code</TableHead>
                  <TableHead>Customer Mobile</TableHead>
                  <TableHead>Bill Amount</TableHead>
                  <TableHead>Discount Applied</TableHead>
                  <TableHead>Used At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usages.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-10"
                    >
                      No usage records yet
                    </TableCell>
                  </TableRow>
                )}
                {usages.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono">{u.couponCode}</TableCell>
                    <TableCell>{u.mobileNumber}</TableCell>
                    <TableCell>₹{u.billAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      -₹{u.discountApplied.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {new Date(u.usedAt).toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-xl" data-ocid="coupon.form.dialog">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Coupon" : "Create Coupon"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Coupon Code *</Label>
                <Input
                  className="h-9"
                  placeholder="e.g. DIWALI25"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  data-ocid="coupon.form.code"
                />
              </div>
              <Button
                variant="outline"
                className="self-end"
                onClick={generateCode}
              >
                Generate
              </Button>
            </div>

            <div className="space-y-1">
              <Label>Coupon Name *</Label>
              <Input
                className="h-9"
                placeholder="e.g. Diwali Special 25% Off"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Discount Type</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      discountType: v as "percent" | "flat",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Discount Value *</Label>
                <Input
                  className="h-9"
                  type="number"
                  placeholder={
                    form.discountType === "percent" ? "e.g. 10" : "e.g. 50"
                  }
                  value={form.discountValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discountValue: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Min Order Amount (₹)</Label>
                <Input
                  className="h-9"
                  type="number"
                  placeholder="0 = no minimum"
                  value={form.minOrderAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minOrderAmount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Max Uses</Label>
                <Input
                  className="h-9"
                  type="number"
                  placeholder="0 = unlimited"
                  value={form.maxUses}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxUses: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Expiry Date *</Label>
              <Input
                className="h-9"
                type="date"
                value={form.expiryDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiryDate: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Assign to Customer Mobile (optional)</Label>
              <Input
                className="h-9"
                placeholder="Leave blank for open coupon"
                value={form.assignedMobile}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assignedMobile: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                If specified, only this customer can use the coupon.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editTarget ? "Save Changes" : "Create Coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Coupon</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete coupon <strong>{deleteTarget?.code}</strong>? This cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
