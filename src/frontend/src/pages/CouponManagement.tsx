import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useActor } from "../hooks/useActor";
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
  expiryDate: string;
  assignedMobile: string;
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

// OTP session for WhatsApp OTP verification
interface OtpSession {
  couponId: string;
  mobile: string;
  otp: string;
  generatedAt: number;
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

function saveUsages(restaurantId: string, usages: CouponUsage[]) {
  localStorage.setItem(
    getStorageKey(restaurantId, "usage"),
    JSON.stringify(usages),
  );
}

function computeStatus(coupon: Coupon): Coupon["status"] {
  const now = new Date();
  const expiry = new Date(coupon.expiryDate);
  if (expiry < now) return "expired";
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses)
    return "used_up";
  return "active";
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

const EMPTY_FORM = {
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
  const { actor } = useActor();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [usages, setUsages] = useState<CouponUsage[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Coupon | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [mobileSearch, setMobileSearch] = useState("");
  const [expandedMobiles, setExpandedMobiles] = useState<Set<string>>(
    new Set(),
  );

  // Bulk assign state
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkMobiles, setBulkMobiles] = useState(""); // comma/newline separated
  const [selectedCouponIds, setSelectedCouponIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkAssignMode, setBulkAssignMode] = useState<
    "mobile_to_coupons" | "coupons_to_mobile"
  >("coupons_to_mobile");
  const [bulkSingleMobile, setBulkSingleMobile] = useState("");

  // Bulk create state
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    prefix: "BULK",
    count: "10",
    discountType: "percent" as "percent" | "flat",
    discountValue: "10",
    minOrderAmount: "0",
    maxUses: "1",
    expiryMonths: "3",
    mobileList: "", // one per line, optional - assign each coupon to a mobile
  });

  // Redeem / OTP state
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemForm, setRedeemForm] = useState({
    code: "",
    mobile: "",
    billAmount: "",
  });
  const [otpSession, setOtpSession] = useState<OtpSession | null>(null);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpStep, setOtpStep] = useState<"input" | "verify">("input");

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

  const activeCoupons = useMemo(
    () => coupons.filter((c) => c.status === "active"),
    [coupons],
  );

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
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    setForm((f) => ({ ...f, code: `COUP${rand}` }));
  }

  // ---- BULK CREATE ----
  function handleBulkCreate() {
    const count = Number.parseInt(bulkForm.count) || 10;
    const discountValue = Number.parseFloat(bulkForm.discountValue) || 10;
    const minOrderAmount = Number.parseFloat(bulkForm.minOrderAmount) || 0;
    const maxUses = Number.parseInt(bulkForm.maxUses) || 1;
    const expiryMonths = Number.parseInt(bulkForm.expiryMonths) || 3;
    const mobileLines = bulkForm.mobileList
      .split(/[\n,]+/)
      .map((m) => m.trim())
      .filter(Boolean);

    const now = new Date();
    const expiry = new Date(now);
    expiry.setMonth(expiry.getMonth() + expiryMonths);
    const expiryDate = expiry.toISOString().slice(0, 10);

    const newCoupons: Coupon[] = [];
    for (let i = 0; i < count; i++) {
      const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
      const c: Coupon = {
        id: Math.random().toString(36).substring(2, 10),
        code: `${bulkForm.prefix.toUpperCase()}${rand}`,
        name: `Bulk Offer (${bulkForm.discountType === "percent" ? `${discountValue}% off` : `₹${discountValue} off`})`,
        discountType: bulkForm.discountType,
        discountValue,
        minOrderAmount,
        maxUses,
        usedCount: 0,
        expiryDate,
        assignedMobile: mobileLines[i] ?? "",
        status: "active",
        createdAt: now.toISOString(),
        fy,
      };
      newCoupons.push(c);
    }
    const updated = [...coupons, ...newCoupons];
    setCoupons(updated);
    saveCoupons(restaurantId!, updated);
    setShowBulkCreate(false);
    const assignedCount = newCoupons.filter((c) => c.assignedMobile).length;
    toast.success(
      `${count} coupons created${
        assignedCount > 0 ? `, ${assignedCount} assigned to mobile numbers` : ""
      }`,
    );
  }

  // ---- BULK ASSIGN ----
  function handleBulkAssign() {
    if (bulkAssignMode === "coupons_to_mobile") {
      // Assign selected coupons to one mobile number
      if (!bulkSingleMobile.trim()) return toast.error("Enter a mobile number");
      if (selectedCouponIds.size === 0)
        return toast.error("Select at least one coupon");
      const updated = coupons.map((c) =>
        selectedCouponIds.has(c.id)
          ? { ...c, assignedMobile: bulkSingleMobile.trim() }
          : c,
      );
      setCoupons(updated);
      saveCoupons(restaurantId!, updated);
      setShowBulkAssign(false);
      setSelectedCouponIds(new Set());
      setBulkSingleMobile("");
      toast.success(
        `${selectedCouponIds.size} coupon(s) assigned to ${bulkSingleMobile.trim()}`,
      );
    } else {
      // Assign one coupon to multiple mobiles (creates copies)
      if (selectedCouponIds.size !== 1)
        return toast.error(
          "Select exactly one coupon to assign to multiple mobiles",
        );
      const mobileLines = bulkMobiles
        .split(/[\n,]+/)
        .map((m) => m.trim())
        .filter(Boolean);
      if (mobileLines.length === 0)
        return toast.error("Enter at least one mobile number");
      const sourceCoupon = coupons.find((c) => selectedCouponIds.has(c.id))!;
      const newCopies: Coupon[] = mobileLines.map((mobile) => ({
        ...sourceCoupon,
        id: Math.random().toString(36).substring(2, 10),
        code: `${sourceCoupon.code.slice(0, 6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
        assignedMobile: mobile,
        usedCount: 0,
        status: "active" as const,
        createdAt: new Date().toISOString(),
      }));
      const updated = [...coupons, ...newCopies];
      setCoupons(updated);
      saveCoupons(restaurantId!, updated);
      setShowBulkAssign(false);
      setSelectedCouponIds(new Set());
      setBulkMobiles("");
      toast.success(
        `${newCopies.length} coupons assigned to ${newCopies.length} mobile numbers`,
      );
    }
  }

  // ---- REDEEM WITH OTP ----
  async function handleSendOtp() {
    const code = redeemForm.code.trim().toUpperCase();
    const mobile = redeemForm.mobile.trim();
    const billAmount = Number.parseFloat(redeemForm.billAmount) || 0;

    if (!code) return toast.error("Enter a coupon code");
    if (!mobile || mobile.length < 10)
      return toast.error("Enter a valid 10-digit mobile number");
    if (!redeemForm.billAmount || billAmount <= 0)
      return toast.error("Enter the bill amount");

    const coupon = coupons.find((c) => c.code === code);
    if (!coupon) return toast.error("Coupon code not found");
    if (coupon.status === "expired")
      return toast.error("This coupon has expired");
    if (coupon.status === "used_up")
      return toast.error("This coupon has been fully used");
    if (coupon.assignedMobile && coupon.assignedMobile !== mobile)
      return toast.error("This coupon is not assigned to this mobile number");
    if (coupon.minOrderAmount > 0 && billAmount < coupon.minOrderAmount)
      return toast.error(`Minimum order amount is ₹${coupon.minOrderAmount}`);

    const otp = generateOtp();

    if (actor) {
      try {
        const result = await (actor as any).sendOtp(mobile, otp);
        if (!result.success) {
          if (result.response.toLowerCase().includes("not configured")) {
            toast.error(
              "SMS gateway not configured. Please set it up in Settings → SMS / WhatsApp Gateway.",
            );
          } else {
            toast.error(`Failed to send OTP: ${result.response}`);
          }
          return;
        }
        toast.success(`OTP sent to ${mobile}`);
      } catch (err) {
        console.error("sendOtp error:", err);
        toast.error("Failed to send OTP. Please check gateway settings.");
        return;
      }
    } else {
      toast.error("Not connected to backend");
      return;
    }

    setOtpSession({
      couponId: coupon.id,
      mobile,
      otp,
      generatedAt: Date.now(),
    });
    setEnteredOtp("");
    setOtpStep("verify");
  }

  function handleVerifyOtp() {
    if (!otpSession) return;
    // Check expiry (5 min)
    if (Date.now() - otpSession.generatedAt > 5 * 60 * 1000) {
      toast.error("OTP expired. Please request a new one.");
      setOtpStep("input");
      setOtpSession(null);
      return;
    }
    if (enteredOtp.trim() !== otpSession.otp) {
      toast.error("Incorrect OTP. Please try again.");
      return;
    }

    // OTP verified — apply redemption
    const coupon = coupons.find((c) => c.id === otpSession.couponId)!;
    const billAmount = Number.parseFloat(redeemForm.billAmount);
    const discount =
      coupon.discountType === "percent"
        ? (billAmount * coupon.discountValue) / 100
        : coupon.discountValue;

    const updatedCoupons = coupons.map((c) =>
      c.id === coupon.id
        ? {
            ...c,
            usedCount: c.usedCount + 1,
            status: computeStatus({ ...c, usedCount: c.usedCount + 1 }),
          }
        : c,
    );
    const newUsage: CouponUsage = {
      id: Math.random().toString(36).substring(2, 10),
      couponId: coupon.id,
      couponCode: coupon.code,
      mobileNumber: otpSession.mobile,
      billId: "",
      billAmount,
      discountApplied: discount,
      usedAt: new Date().toISOString(),
    };
    const updatedUsages = [...usages, newUsage];
    setCoupons(updatedCoupons);
    setUsages(updatedUsages);
    saveCoupons(restaurantId!, updatedCoupons);
    saveUsages(restaurantId!, updatedUsages);

    toast.success(
      `Coupon redeemed! Discount: ₹${discount.toFixed(2)} | Final amount: ₹${(billAmount - discount).toFixed(2)}`,
      { duration: 6000 },
    );
    setShowRedeem(false);
    setOtpStep("input");
    setOtpSession(null);
    setRedeemForm({ code: "", mobile: "", billAmount: "" });
    setEnteredOtp("");
  }

  function openRedeemForCoupon(coupon: Coupon) {
    setRedeemForm({
      code: coupon.code,
      mobile: coupon.assignedMobile,
      billAmount: "",
    });
    setOtpStep("input");
    setOtpSession(null);
    setEnteredOtp("");
    setShowRedeem(true);
  }

  return (
    <div className="p-6 space-y-6" data-ocid="coupon.root">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Coupon Management</h1>
          <p className="text-muted-foreground text-sm">FY {fy}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              setShowBulkCreate(true);
            }}
          >
            Bulk Create
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedCouponIds(new Set());
              setBulkSingleMobile("");
              setBulkMobiles("");
              setShowBulkAssign(true);
            }}
          >
            Bulk Assign
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setRedeemForm({ code: "", mobile: "", billAmount: "" });
              setOtpStep("input");
              setOtpSession(null);
              setEnteredOtp("");
              setShowRedeem(true);
            }}
          >
            🎟 Redeem Coupon
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
          <TabsTrigger value="by-mobile" data-ocid="coupon.tab">
            By Mobile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coupons" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Search by code, name, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
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
                      <div className="flex gap-1 flex-wrap">
                        {c.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-300 text-xs"
                            onClick={() => openRedeemForCoupon(c)}
                          >
                            Redeem
                          </Button>
                        )}
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

        <TabsContent value="by-mobile" className="space-y-4">
          <div className="flex gap-3 items-center">
            <Input
              placeholder="Search by mobile number..."
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
              className="max-w-xs h-9"
              data-ocid="coupon.search_input"
            />
            {mobileSearch && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setMobileSearch("")}
              >
                ✕ Clear
              </button>
            )}
          </div>
          {(() => {
            const grouped: Record<string, Coupon[]> = {};
            for (const c of coupons) {
              const key = c.assignedMobile
                ? c.assignedMobile
                : "__unassigned__";
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(c);
            }
            const entries = Object.entries(grouped)
              .filter(([key]) => {
                if (!mobileSearch.trim()) return true;
                if (key === "__unassigned__") return false;
                return key.includes(mobileSearch.trim());
              })
              .sort(([a], [b]) => {
                if (a === "__unassigned__") return 1;
                if (b === "__unassigned__") return -1;
                return a.localeCompare(b);
              });
            if (entries.length === 0) {
              return (
                <div
                  className="text-center text-muted-foreground py-16 bg-card border rounded-lg"
                  data-ocid="coupon.empty_state"
                >
                  No coupons found for this mobile number.
                </div>
              );
            }
            return (
              <div className="space-y-4">
                {entries.map(([key, group]) => (
                  <div
                    key={key}
                    className="bg-card border rounded-lg shadow-sm overflow-auto"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-3 px-4 py-3 border-b bg-muted/40 w-full text-left hover:bg-muted/60 transition-colors"
                      onClick={() =>
                        setExpandedMobiles((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                    >
                      <span className="font-bold text-base flex-1">
                        {key === "__unassigned__" ? "Open / Unassigned" : key}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {group.length} coupon{group.length !== 1 ? "s" : ""}
                      </Badge>
                      <span className="text-muted-foreground text-xs ml-2">
                        {expandedMobiles.has(key) ? "▲" : "▼"}
                      </span>
                    </button>
                    {expandedMobiles.has(key) && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Discount</TableHead>
                            <TableHead>Expiry</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.map((c) => (
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
                                {new Date(c.expiryDate).toLocaleDateString(
                                  "en-IN",
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={STATUS_COLORS[c.status]}>
                                  {STATUS_LABELS[c.status]}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-xl">
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

      {/* Bulk Create Dialog */}
      <Dialog open={showBulkCreate} onOpenChange={setShowBulkCreate}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Create Coupons</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code Prefix</Label>
                <Input
                  className="h-9"
                  placeholder="e.g. FEST"
                  value={bulkForm.prefix}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      prefix: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Number of Coupons *</Label>
                <Input
                  className="h-9"
                  type="number"
                  value={bulkForm.count}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, count: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Discount Type</Label>
                <Select
                  value={bulkForm.discountType}
                  onValueChange={(v) =>
                    setBulkForm((f) => ({
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
                  value={bulkForm.discountValue}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      discountValue: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Min Order (₹)</Label>
                <Input
                  className="h-9"
                  type="number"
                  value={bulkForm.minOrderAmount}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      minOrderAmount: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Max Uses per Coupon</Label>
                <Input
                  className="h-9"
                  type="number"
                  value={bulkForm.maxUses}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, maxUses: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Valid for (months)</Label>
              <Input
                className="h-9"
                type="number"
                value={bulkForm.expiryMonths}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, expiryMonths: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Assign to Mobile Numbers (optional)</Label>
              <textarea
                className="w-full border rounded-md p-2 text-sm h-28 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={
                  "Enter one mobile per line (or comma-separated).\nIf provided, each coupon is assigned to the corresponding mobile number in order.\n\nE.g.:\n9876543210\n9876543211\n9876543212"
                }
                value={bulkForm.mobileList}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, mobileList: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to create unassigned coupons. If fewer mobiles than
                count, remaining coupons are unassigned.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkCreate}>Create Coupons</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkAssign} onOpenChange={setShowBulkAssign}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Assign Coupons</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button
                size="sm"
                variant={
                  bulkAssignMode === "coupons_to_mobile" ? "default" : "outline"
                }
                onClick={() => setBulkAssignMode("coupons_to_mobile")}
              >
                Multiple Coupons → One Mobile
              </Button>
              <Button
                size="sm"
                variant={
                  bulkAssignMode === "mobile_to_coupons" ? "default" : "outline"
                }
                onClick={() => setBulkAssignMode("mobile_to_coupons")}
              >
                One Coupon → Multiple Mobiles
              </Button>
            </div>

            {bulkAssignMode === "coupons_to_mobile" ? (
              <>
                <div className="space-y-1">
                  <Label>Mobile Number *</Label>
                  <Input
                    className="h-9"
                    placeholder="e.g. 9876543210"
                    value={bulkSingleMobile}
                    onChange={(e) => setBulkSingleMobile(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Select Coupons to Assign</Label>
                  <div className="border rounded-md overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead>Current Mobile</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeCoupons.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center text-muted-foreground py-6"
                            >
                              No active coupons
                            </TableCell>
                          </TableRow>
                        )}
                        {activeCoupons.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedCouponIds.has(c.id)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(selectedCouponIds);
                                  if (checked) next.add(c.id);
                                  else next.delete(c.id);
                                  setSelectedCouponIds(next);
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {c.code}
                            </TableCell>
                            <TableCell className="text-sm">{c.name}</TableCell>
                            <TableCell className="text-sm">
                              {c.discountType === "percent"
                                ? `${c.discountValue}%`
                                : `₹${c.discountValue}`}
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.assignedMobile || (
                                <span className="text-muted-foreground">
                                  Open
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[c.status]}>
                                {STATUS_LABELS[c.status]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedCouponIds.size} coupon(s) selected
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>
                    Select ONE Coupon (a copy will be made for each mobile)
                  </Label>
                  <div className="border rounded-md overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Discount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeCoupons.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedCouponIds.has(c.id)}
                                onCheckedChange={(checked) => {
                                  // single select only
                                  setSelectedCouponIds(
                                    checked ? new Set([c.id]) : new Set(),
                                  );
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {c.code}
                            </TableCell>
                            <TableCell className="text-sm">{c.name}</TableCell>
                            <TableCell className="text-sm">
                              {c.discountType === "percent"
                                ? `${c.discountValue}%`
                                : `₹${c.discountValue}`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>
                    Mobile Numbers (one per line or comma-separated) *
                  </Label>
                  <textarea
                    className="w-full border rounded-md p-2 text-sm h-28 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder={"9876543210\n9876543211\n9876543212"}
                    value={bulkMobiles}
                    onChange={(e) => setBulkMobiles(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAssign(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssign}>Assign Coupons</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem with WhatsApp OTP Dialog */}
      <Dialog
        open={showRedeem}
        onOpenChange={(open) => {
          if (!open) {
            setShowRedeem(false);
            setOtpStep("input");
            setOtpSession(null);
            setEnteredOtp("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🎟 Redeem Coupon (WhatsApp OTP)</DialogTitle>
          </DialogHeader>

          {otpStep === "input" ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800">
                Enter the coupon code and customer mobile number. An OTP will be
                sent to the customer's WhatsApp for verification.
              </div>
              <div className="space-y-1">
                <Label>Coupon Code *</Label>
                <Input
                  className="h-9 font-mono uppercase"
                  placeholder="e.g. DIWALI25"
                  value={redeemForm.code}
                  onChange={(e) =>
                    setRedeemForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Customer Mobile Number *</Label>
                <Input
                  className="h-9"
                  placeholder="10-digit mobile"
                  type="tel"
                  value={redeemForm.mobile}
                  onChange={(e) =>
                    setRedeemForm((f) => ({ ...f, mobile: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Bill Amount (₹) *</Label>
                <Input
                  className="h-9"
                  type="number"
                  placeholder="Enter current bill total"
                  value={redeemForm.billAmount}
                  onChange={(e) =>
                    setRedeemForm((f) => ({ ...f, billAmount: e.target.value }))
                  }
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRedeem(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendOtp}>Send OTP via WhatsApp</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800">
                <p className="font-medium">
                  ✅ OTP has been sent to customer's mobile: {redeemForm.mobile}
                </p>
                <p className="mt-1 text-xs">
                  Ask the customer to share the OTP they received. Valid for 5
                  minutes.
                </p>
              </div>

              <div className="space-y-1">
                <Label>Enter OTP *</Label>
                <Input
                  className="h-9 text-center font-mono text-xl tracking-widest"
                  placeholder="______"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) =>
                    setEnteredOtp(e.target.value.replace(/\D/g, ""))
                  }
                />
              </div>

              {/* Preview discount */}
              {redeemForm.billAmount &&
                otpSession &&
                (() => {
                  const coupon = coupons.find(
                    (c) => c.id === otpSession.couponId,
                  );
                  if (!coupon) return null;
                  const billAmount = Number.parseFloat(redeemForm.billAmount);
                  const discount =
                    coupon.discountType === "percent"
                      ? (billAmount * coupon.discountValue) / 100
                      : coupon.discountValue;
                  return (
                    <div className="bg-muted rounded-md p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Bill Amount</span>
                        <span>₹{billAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-green-600 font-medium">
                        <span>Discount ({coupon.code})</span>
                        <span>-₹{discount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1">
                        <span>Final Amount</span>
                        <span>₹{(billAmount - discount).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOtpStep("input");
                    setOtpSession(null);
                    setEnteredOtp("");
                  }}
                >
                  Resend OTP
                </Button>
                <Button
                  onClick={handleVerifyOtp}
                  disabled={enteredOtp.length !== 6}
                >
                  Verify & Redeem
                </Button>
              </DialogFooter>
            </div>
          )}
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
