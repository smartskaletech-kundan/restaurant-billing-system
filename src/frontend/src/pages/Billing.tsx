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
import { useActorExtended as useActor } from "../hooks/useActorExtended";
import { useCardNames } from "../hooks/useCardNames";
import { formatBillNumber } from "../utils/billFormat";

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
interface PartialDue {
  id: string;
  billId: string;
  billNumber: number;
  tableName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMode: string;
  customerName: string;
  customerMobile: string;
  customerCompany: string;
  customerGSTIN: string;
  createdAt: string;
  settled: boolean;
}

interface Props {
  navigateTo: (page: Page) => void;
  selectedTable: SelectedTable | null;
  selectedOrder: SelectedOrder | null;
}

export function Billing({ navigateTo, selectedTable, selectedOrder }: Props) {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const { card1Name, card2Name } = useCardNames();
  const restaurantGSTIN = restaurantId
    ? localStorage.getItem(`${restaurantId}_restaurant_gstin`) || ""
    : localStorage.getItem("restaurant_gstin") || "";
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  // Discount fields
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [discountInput, setDiscountInput] = useState(0);
  // Coupon fields
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");
  // Customer fields
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerGSTIN, setCustomerGSTIN] = useState("");
  const [customerFound, setCustomerFound] = useState(false);
  // New Customer dialog
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncMobile, setNcMobile] = useState("");
  const [ncCompany, setNcCompany] = useState("");
  const [ncGSTIN, setNcGSTIN] = useState("");
  const [ncEmail, setNcEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showPreviewPrint, setShowPreviewPrint] = useState(false);
  const [billFinalized, setBillFinalized] = useState(false);
  const [savedBillNumber, setSavedBillNumber] = useState<number | null>(null);

  // Multi-payment amounts: each key is a mode, value is amount entered
  const [payAmounts, setPayAmounts] = useState({
    cash: 0,
    hdfc: 0,
    sbi: 0,
    upi: 0,
    due: 0,
  });
  // Track which modes are enabled (checkbox)
  const [enabledModes, setEnabledModes] = useState<Set<string>>(
    new Set(["cash"]),
  );

  // Running tables selector
  const [runningTables, setRunningTables] = useState<Table[]>([]);
  const [pickedTable, setPickedTable] = useState<Table | null>(null);
  const [pickedOrder, setPickedOrder] = useState<Order | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);

  // Effective table/order: either from props or from user selection
  const effectiveTable: SelectedTable | null =
    selectedTable ||
    (pickedTable ? { id: pickedTable.id, name: pickedTable.name } : null);

  // Customer lookup by mobile
  function lookupCustomer(mobile: string) {
    setCustomerMobile(mobile);
    if (!mobile.trim()) {
      setCustomerName("");
      setCustomerCompany("");
      setCustomerGSTIN("");
      setCustomerFound(false);
      return;
    }
    try {
      const customers: Array<{
        mobile?: string;
        name?: string;
        companyName?: string;
        gstin?: string;
      }> = JSON.parse(
        localStorage.getItem(`customers_${restaurantId}`) || "[]",
      );
      const match = customers.find((c) => c.mobile === mobile.trim());
      if (match) {
        setCustomerName(match.name || "");
        setCustomerCompany(match.companyName || "");
        setCustomerGSTIN((match.gstin || "").toUpperCase());
        setCustomerFound(true);
      } else {
        setCustomerName("");
        setCustomerCompany("");
        setCustomerGSTIN("");
        setCustomerFound(false);
      }
    } catch {
      setCustomerFound(false);
    }
  }

  function resetCustomerFields() {
    setCustomerMobile("");
    setCustomerName("");
    setCustomerCompany("");
    setCustomerGSTIN("");
    setCustomerFound(false);
  }

  function saveNewCustomer() {
    if (!ncName.trim() || !ncMobile.trim()) {
      toast.error("Name and Mobile are required.");
      return;
    }
    const customers: Array<Record<string, string>> = JSON.parse(
      localStorage.getItem(`customers_${restaurantId}`) || "[]",
    );
    const existing = customers.find((c) => c.mobile === ncMobile.trim());
    if (existing) {
      toast.error("A customer with this mobile already exists.");
      return;
    }
    const newC = {
      id: `cust-${Date.now()}`,
      name: ncName.trim(),
      mobile: ncMobile.trim(),
      companyName: ncCompany.trim(),
      gstin: ncGSTIN.trim().toUpperCase(),
      email: ncEmail.trim(),
      createdAt: new Date().toISOString(),
    };
    customers.push(newC);
    localStorage.setItem(
      `customers_${restaurantId}`,
      JSON.stringify(customers),
    );
    // Auto-fill billing customer fields
    setCustomerMobile(newC.mobile);
    setCustomerName(newC.name);
    setCustomerCompany(newC.companyName);
    setCustomerGSTIN(newC.gstin);
    setCustomerFound(true);
    // Reset new customer form
    setNcName("");
    setNcMobile("");
    setNcCompany("");
    setNcGSTIN("");
    setNcEmail("");
    setShowNewCustomer(false);
    toast.success(`Customer "${newC.name}" added and selected!`);
  }

  // Load running tables when no table is selected from props
  useEffect(() => {
    if (!actor || isFetching || selectedTable) return;
    setLoadingTables(true);
    actor
      .getTablesR(restaurantId)
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
  }, [actor, isFetching, selectedTable, restaurantId]);

  // Load order for a selected running table
  const handlePickTable = async (table: Table) => {
    if (!actor) return;
    setPickedTable(table);
    setPickedOrder(null);
    try {
      const oRaw = await actor.getOrderByTableR(restaurantId, table.id);
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
        ? actor.getOrderByTableR(restaurantId, selectedTable.id)
        : Promise.resolve(null),
      actor.getSettingsR(restaurantId),
    ])
      .then(([oRaw, s]) => {
        let o: Order | null = null;
        if (oRaw != null) {
          if (Array.isArray(oRaw))
            o = oRaw.length > 0 ? (oRaw[0] as Order) : null;
          else o = oRaw as Order;
        }
        setOrder(o);
        setSettings(s as RestaurantSettings);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Billing load error:", err);
        setLoading(false);
      });
  }, [actor, isFetching, selectedTable, selectedOrder, restaurantId]);

  // Load settings when using picked table path
  useEffect(() => {
    if (!actor || isFetching || selectedTable || !pickedOrder) return;
    actor
      .getSettingsR(restaurantId)
      .then((s) => setSettings(s as RestaurantSettings))
      .catch(() => {});
  }, [actor, isFetching, selectedTable, pickedOrder, restaurantId]);

  const activeOrder = order ?? pickedOrder;

  const subtotal = activeOrder
    ? activeOrder.items.reduce((s, i) => s + i.price * Number(i.quantity), 0)
    : 0;
  const taxRate = settings?.taxRate ?? 0;

  // Manual discount (flat value computed from type + input)
  const discount =
    discountType === "percent"
      ? (subtotal * discountInput) / 100
      : discountInput;

  // Coupon discount
  const couponDiscount = appliedCoupon
    ? appliedCoupon.discountType === "percent"
      ? (subtotal * appliedCoupon.discountValue) / 100
      : appliedCoupon.discountValue
    : 0;

  const totalDiscount = discount + couponDiscount;
  const taxableAmount = subtotal - totalDiscount;
  const taxAmount = taxableAmount * (taxRate / 100);
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;
  const totalBeforeRound = taxableAmount + taxAmount;
  // Round off: difference to nearest rupee
  const roundOff = Math.round(totalBeforeRound) - totalBeforeRound;
  const total = totalBeforeRound + roundOff;

  // Payment amounts total and balance
  const payAmountsTotal = Object.values(payAmounts).reduce((a, b) => a + b, 0);
  const payAmountsBalance = Math.max(0, total - payAmountsTotal);

  function setPayAmount(key: keyof typeof payAmounts, value: number) {
    setPayAmounts((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMode(key: string, checked: boolean) {
    setEnabledModes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else {
        next.delete(key);
        setPayAmounts((p) => ({ ...p, [key]: 0 }));
      }
      return next;
    });
  }

  // Build settlement mode string
  function buildModeString(): string {
    const parts: string[] = [];
    if (payAmounts.cash > 0) parts.push(`Cash:${payAmounts.cash.toFixed(2)}`);
    if (payAmounts.hdfc > 0) parts.push(`HDFC:${payAmounts.hdfc.toFixed(2)}`);
    if (payAmounts.sbi > 0) parts.push(`SBI:${payAmounts.sbi.toFixed(2)}`);
    if (payAmounts.upi > 0) parts.push(`UPI:${payAmounts.upi.toFixed(2)}`);
    if (payAmounts.due > 0) parts.push(`Due:${payAmounts.due.toFixed(2)}`);
    if (parts.length === 0) return "Cash";
    if (parts.length === 1 && payAmounts.due === 0)
      return parts[0].split(":")[0]; // single mode like "Cash"
    return `Multi(${parts.join(",")})`;
  }

  function applyCoupon() {
    const coupons: Coupon[] = JSON.parse(
      localStorage.getItem(`coupon_list_${restaurantId}`) || "[]",
    );
    const now = new Date();
    const found = coupons.find(
      (c) => c.code.toLowerCase() === couponCode.trim().toLowerCase(),
    );
    if (!found) {
      setCouponError("Coupon code not found.");
      return;
    }
    if (found.status === "expired" || new Date(found.expiryDate) < now) {
      setCouponError("Coupon has expired.");
      return;
    }
    if (found.maxUses > 0 && found.usedCount >= found.maxUses) {
      setCouponError("Coupon has been fully used.");
      return;
    }
    if (subtotal < found.minOrderAmount) {
      setCouponError(`Minimum order ₹${found.minOrderAmount} required.`);
      return;
    }
    setAppliedCoupon(found);
    setCouponError("");
    toast.success(`Coupon "${found.code}" applied!`);
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  }

  function resetPaymentFields() {
    setPayAmounts({ cash: 0, hdfc: 0, sbi: 0, upi: 0, due: 0 });
    setEnabledModes(new Set(["cash"]));
  }

  const handleFinalize = async () => {
    if (!actor || !activeOrder || !effectiveTable) return;

    // Prevent duplicate bill generation
    if (billFinalized) {
      toast.error(
        "Bill already generated for this order. View in Bill History.",
      );
      return;
    }

    // Validate at least one mode has amount
    if (payAmountsTotal <= 0) {
      toast.error("Please enter at least one payment amount.");
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

      const modeString = buildModeString();

      const bill = await actor.createBillR(
        restaurantId,
        activeOrder.id,
        effectiveTable.id,
        effectiveTable.name,
        billItems,
        subtotal,
        taxAmount,
        totalDiscount,
        total,
        modeString,
        "Admin",
      );

      await Promise.all([
        actor.updateOrderStatusR(restaurantId, activeOrder.id, "billed"),
        actor.updateTableStatus(effectiveTable.id, "available"),
      ]);

      // Record coupon usage
      if (appliedCoupon) {
        const coupons: Coupon[] = JSON.parse(
          localStorage.getItem(`coupon_list_${restaurantId}`) || "[]",
        );
        const updatedCoupons = coupons.map((c) =>
          c.id === appliedCoupon.id ? { ...c, usedCount: c.usedCount + 1 } : c,
        );
        localStorage.setItem(
          `coupon_list_${restaurantId}`,
          JSON.stringify(updatedCoupons),
        );
        const usages: CouponUsage[] = JSON.parse(
          localStorage.getItem(`coupon_usage_${restaurantId}`) || "[]",
        );
        usages.push({
          id: `usage-${Date.now()}`,
          couponId: appliedCoupon.id,
          couponCode: appliedCoupon.code,
          mobileNumber: customerMobile,
          billId: String(bill.billNumber),
          billAmount: total,
          discountApplied: couponDiscount,
          usedAt: new Date().toISOString(),
        });
        localStorage.setItem(
          `coupon_usage_${restaurantId}`,
          JSON.stringify(usages),
        );
      }

      const bn = Array.isArray(bill.billNumber)
        ? Number((bill.billNumber as bigint[])[0] ?? 0n)
        : Number(bill.billNumber ?? 0);
      setSavedBillNumber(bn);

      // Persist customer details keyed by bill ID so GST reports can use them
      if (customerGSTIN || customerMobile || customerName || customerCompany) {
        const billCustomerMap: Record<
          string,
          { mobile: string; name: string; company: string; gstin: string }
        > = JSON.parse(
          localStorage.getItem(`bill_customer_map_${restaurantId}`) || "{}",
        );
        billCustomerMap[bill.id] = {
          mobile: customerMobile,
          name: customerName,
          company: customerCompany,
          gstin: customerGSTIN.toUpperCase(),
        };
        localStorage.setItem(
          `bill_customer_map_${restaurantId}`,
          JSON.stringify(billCustomerMap),
        );
      }

      // Save partial due if the due mode was used
      if (payAmounts.due > 0) {
        const paidAmount = payAmountsTotal - payAmounts.due;
        const dueAmount = payAmounts.due;
        const partialDues: PartialDue[] = JSON.parse(
          localStorage.getItem(`partial_dues_${restaurantId}`) || "[]",
        );
        partialDues.push({
          id: `due-${Date.now()}`,
          billId: bill.id,
          billNumber: bn,
          tableName: effectiveTable.name,
          totalAmount: total,
          paidAmount,
          dueAmount,
          paymentMode: modeString,
          customerName,
          customerMobile,
          customerCompany,
          customerGSTIN: customerGSTIN.toUpperCase(),
          createdAt: new Date().toISOString(),
          settled: false,
        });
        localStorage.setItem(
          `partial_dues_${restaurantId}`,
          JSON.stringify(partialDues),
        );
      } else if (payAmountsBalance > 0.01) {
        // Auto-balance remaining as due
        const partialDues: PartialDue[] = JSON.parse(
          localStorage.getItem(`partial_dues_${restaurantId}`) || "[]",
        );
        partialDues.push({
          id: `due-${Date.now()}`,
          billId: bill.id,
          billNumber: bn,
          tableName: effectiveTable.name,
          totalAmount: total,
          paidAmount: payAmountsTotal,
          dueAmount: payAmountsBalance,
          paymentMode: modeString,
          customerName,
          customerMobile,
          customerCompany,
          customerGSTIN: customerGSTIN.toUpperCase(),
          createdAt: new Date().toISOString(),
          settled: false,
        });
        localStorage.setItem(
          `partial_dues_${restaurantId}`,
          JSON.stringify(partialDues),
        );
      }

      setBillFinalized(true);
      toast.success("Bill saved successfully!");
      // Reset billing fields for next bill
      setDiscountInput(0);
      setDiscountType("flat");
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponError("");
      resetPaymentFields();
      resetCustomerFields();
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
    const modeString = buildModeString();
    const msg = `Dear Customer, your bill of ₹${total.toFixed(2)} at ${restaurantName} (Bill ${billNum}) via ${modeString} is attached. Thank you for dining with us!`;
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

  const paymentModeRows: Array<{
    key: keyof typeof payAmounts;
    label: string;
    icon: string;
    color: string;
  }> = [
    { key: "cash", label: "Cash", icon: "💵", color: "text-green-600" },
    { key: "hdfc", label: card1Name, icon: "💳", color: "text-blue-600" },
    { key: "sbi", label: card2Name, icon: "💳", color: "text-indigo-600" },
    { key: "upi", label: "UPI", icon: "📱", color: "text-purple-600" },
    { key: "due", label: "Customer Due", icon: "🕐", color: "text-orange-600" },
  ];

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

      {/* Customer Details Section */}
      <div
        className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4"
        data-ocid="billing.customer.panel"
      >
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-base">
            Customer Details{" "}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              (Optional)
            </span>
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowNewCustomer(true)}
            data-ocid="billing.new_customer.button"
          >
            + New Customer
          </Button>
        </div>
        {/* Mobile — full width */}
        <div className="space-y-1">
          <Label className="text-sm text-muted-foreground">Mobile Number</Label>
          <div className="flex items-center gap-2">
            <Input
              data-ocid="billing.customer.input"
              placeholder="Search by mobile..."
              value={customerMobile}
              onChange={(e) => lookupCustomer(e.target.value)}
              className="h-9 flex-1"
              maxLength={15}
            />
            {customerFound && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full whitespace-nowrap">
                ✓ Customer found
              </span>
            )}
          </div>
        </div>
        {/* Name, Company, GSTIN in 2-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">
              Customer Name
            </Label>
            <Input
              data-ocid="billing.customer_name.input"
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">
              Company Name
            </Label>
            <Input
              data-ocid="billing.customer_company.input"
              placeholder="Company name"
              value={customerCompany}
              onChange={(e) => setCustomerCompany(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-sm text-muted-foreground">
              GST Number (GSTIN)
            </Label>
            <Input
              data-ocid="billing.customer_gstin.input"
              placeholder="GST number"
              value={customerGSTIN}
              onChange={(e) => setCustomerGSTIN(e.target.value.toUpperCase())}
              className="h-9 font-mono tracking-wide"
              maxLength={15}
            />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
        {/* Discount Row */}
        <div className="space-y-2">
          <Label className="font-medium">Discount</Label>
          <div className="flex items-center gap-3">
            {/* Type toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setDiscountType("flat")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  discountType === "flat"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Flat (₹)
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("percent")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-border ${
                  discountType === "percent"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                Percent (%)
              </button>
            </div>
            <div className="relative w-32">
              <Input
                data-ocid="billing.discount.input"
                type="number"
                value={discountInput}
                onChange={(e) =>
                  setDiscountInput(Number.parseFloat(e.target.value) || 0)
                }
                min="0"
                max={discountType === "percent" ? 100 : undefined}
                className="h-9 pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {discountType === "percent" ? "%" : "₹"}
              </span>
            </div>
            {discount > 0 && (
              <span className="text-sm text-green-600 font-medium">
                = ₹{discount.toFixed(2)} off
              </span>
            )}
          </div>
        </div>

        {/* Coupon Redemption Row */}
        <div className="space-y-2">
          <Label className="font-medium">Coupon Code</Label>
          {appliedCoupon ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <span className="text-green-700 font-semibold text-sm">
                🎟 {appliedCoupon.code}
              </span>
              <span className="text-green-600 text-sm">
                {appliedCoupon.name} —{" "}
                {appliedCoupon.discountType === "percent"
                  ? `${appliedCoupon.discountValue}% off`
                  : `₹${appliedCoupon.discountValue} off`}{" "}
                (−₹{couponDiscount.toFixed(2)})
              </span>
              <button
                type="button"
                onClick={removeCoupon}
                className="ml-auto text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                data-ocid="billing.coupon.input"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  setCouponError("");
                }}
                className="h-9 flex-1"
                onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-ocid="billing.coupon.apply_button"
                onClick={applyCoupon}
                disabled={!couponCode.trim()}
                className="h-9"
              >
                Apply
              </Button>
            </div>
          )}
          {couponError && (
            <p
              className="text-xs text-destructive"
              data-ocid="billing.coupon.error_state"
            >
              {couponError}
            </p>
          )}
        </div>

        {/* Multi-Payment Panel */}
        <div className="space-y-3" data-ocid="billing.payment.panel">
          <Label className="font-semibold text-base">Payment Mode</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Select one or more payment modes and enter amounts. Balance becomes
            customer due.
          </p>
          <div className="space-y-2 bg-muted/30 rounded-xl p-3 border border-border">
            {paymentModeRows.map(({ key, label, icon, color }) => (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`pay-mode-${key}`}
                  checked={enabledModes.has(key)}
                  onChange={(e) => toggleMode(key, e.target.checked)}
                  className="h-4 w-4 flex-shrink-0"
                />
                <Label
                  htmlFor={`pay-mode-${key}`}
                  className={`w-28 flex-shrink-0 text-sm font-medium cursor-pointer ${color}`}
                >
                  {icon} {label}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={payAmounts[key] || ""}
                  disabled={!enabledModes.has(key)}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setPayAmount(key, val);
                    if (val > 0 && !enabledModes.has(key)) {
                      setEnabledModes((prev) => new Set([...prev, key]));
                    }
                  }}
                  className="h-9 flex-1"
                  data-ocid={`billing.pay_amount_${key}.input`}
                />
              </div>
            ))}
          </div>

          {/* Running total and balance */}
          <div className="space-y-1.5 border border-border rounded-lg p-3 bg-card">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bill Total</span>
              <span className="font-semibold">₹{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Entered</span>
              <span
                className={`font-semibold ${
                  payAmountsTotal >= total - 0.01
                    ? "text-green-600"
                    : "text-amber-600"
                }`}
              >
                ₹{payAmountsTotal.toFixed(2)}
              </span>
            </div>
            {payAmountsBalance > 0.01 && (
              <div className="flex justify-between text-sm font-semibold text-orange-600 border-t border-border pt-1.5 mt-1.5">
                <span>Balance Due (→ Customer Due)</span>
                <span>₹{payAmountsBalance.toFixed(2)}</span>
              </div>
            )}
            {payAmountsTotal >= total - 0.01 && (
              <p className="text-xs text-green-600 font-medium border-t border-border pt-1.5 mt-1.5">
                ✅ Full amount covered
              </p>
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
              <span className="text-muted-foreground">
                Discount
                {discountType === "percent" ? ` (${discountInput}%)` : ""}
              </span>
              <span className="text-destructive">−₹{discount.toFixed(2)}</span>
            </div>
          )}
          {couponDiscount > 0 && appliedCoupon && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Coupon ({appliedCoupon.code})
              </span>
              <span className="text-green-600">
                −₹{couponDiscount.toFixed(2)}
              </span>
            </div>
          )}
          {/* Tax Breakup */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">CGST ({taxRate / 2}%)</span>
            <span className="text-foreground">₹{cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">SGST ({taxRate / 2}%)</span>
            <span className="text-foreground">₹{sgst.toFixed(2)}</span>
          </div>
          {/* Round Off */}
          {Math.abs(roundOff) > 0.001 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Round Off</span>
              <span
                className={
                  roundOff >= 0 ? "text-green-600" : "text-destructive"
                }
              >
                {roundOff >= 0 ? "+" : "-"}₹{Math.abs(roundOff).toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>Grand Total</span>
            <span className="text-primary">₹{total.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <Button
        data-ocid="billing.preview.button"
        className="w-full"
        size="lg"
        variant="outline"
        onClick={() => setShowPreviewPrint(true)}
      >
        🖨 Preview Bill (Draft)
      </Button>

      <Button
        data-ocid="billing.finalize.button"
        className="w-full"
        size="lg"
        onClick={handleFinalize}
        disabled={saving || billFinalized}
        style={
          billFinalized
            ? {
                background: "var(--green-600, #16a34a)",
                color: "white",
                opacity: 1,
              }
            : undefined
        }
      >
        {saving
          ? "Processing..."
          : billFinalized
            ? "✅ Bill Generated"
            : "✅ Finalize & Save Bill"}
      </Button>

      {/* Preview Print Dialog */}
      <Dialog open={showPreviewPrint} onOpenChange={setShowPreviewPrint}>
        <DialogContent
          className="max-w-sm"
          data-ocid="billing.preview_print.dialog"
        >
          <DialogHeader>
            <DialogTitle>Bill Preview (Draft)</DialogTitle>
          </DialogHeader>
          <div className="print-bill font-mono text-xs space-y-2 py-2 border border-dashed rounded p-4">
            <div className="text-center space-y-0.5">
              <p className="font-bold text-sm">
                {settings?.name || "Restaurant"}
              </p>
              <p>{settings?.address}</p>
              {settings?.phone && <p>Tel: {settings.phone}</p>}
              {restaurantGSTIN && <p>GSTIN: {restaurantGSTIN}</p>}
            </div>
            <p className="text-center font-bold text-muted-foreground border border-dashed p-1 mt-1">
              ⚠ DRAFT - NOT FINALIZED
            </p>
            <div className="border-t border-dashed my-2 pt-2 space-y-1">
              <p>Table: {effectiveTable?.name}</p>
              <p>Date: {new Date().toLocaleString()}</p>
              {(customerName ||
                customerMobile ||
                customerCompany ||
                customerGSTIN) && (
                <div className="border-t border-dashed mt-1 pt-1 space-y-0.5">
                  {customerName && (
                    <p className="font-semibold">{customerName}</p>
                  )}
                  {customerMobile && <p>Mobile: {customerMobile}</p>}
                  {customerCompany && <p>Company: {customerCompany}</p>}
                  {customerGSTIN && <p>GSTIN: {customerGSTIN}</p>}
                </div>
              )}
            </div>
            <div className="border-t border-dashed my-2 pt-2 space-y-1">
              <div className="flex justify-between font-bold border-b border-dashed pb-1">
                <span>Item</span>
                <span>Amt</span>
              </div>
              {activeOrder?.items.map((item) => (
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
                  <span>
                    Discount
                    {discountType === "percent" ? ` (${discountInput}%)` : ""}
                  </span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>CGST ({taxRate / 2}%)</span>
                <span>₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST ({taxRate / 2}%)</span>
                <span>₹{sgst.toFixed(2)}</span>
              </div>
              {Math.abs(roundOff) > 0.001 && (
                <div className="flex justify-between">
                  <span>Round Off</span>
                  <span>
                    {roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-dashed pt-1">
                <span>TOTAL</span>
                <span>₹{total.toFixed(0)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => window.print()}
              data-ocid="billing.preview_print.button"
            >
              🖨 Print Preview
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPreviewPrint(false)}
              data-ocid="billing.preview_close.button"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
        <DialogContent
          className="max-w-md"
          data-ocid="billing.new_customer.dialog"
        >
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={ncName}
                  onChange={(e) => setNcName(e.target.value)}
                  placeholder="Customer name"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">
                  Mobile <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={ncMobile}
                  onChange={(e) => setNcMobile(e.target.value)}
                  placeholder="Mobile number"
                  className="h-9"
                  maxLength={15}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Company Name</Label>
                <Input
                  value={ncCompany}
                  onChange={(e) => setNcCompany(e.target.value)}
                  placeholder="Company"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Email</Label>
                <Input
                  value={ncEmail}
                  onChange={(e) => setNcEmail(e.target.value)}
                  placeholder="Email"
                  className="h-9"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-sm">GSTIN</Label>
                <Input
                  value={ncGSTIN}
                  onChange={(e) => setNcGSTIN(e.target.value.toUpperCase())}
                  placeholder="GST Number"
                  className="h-9 font-mono tracking-wide"
                  maxLength={15}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNewCustomer(false)}>
              Cancel
            </Button>
            <Button onClick={saveNewCustomer}>Save &amp; Select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Modal */}
      <Dialog
        open={showPrint}
        onOpenChange={(open) => {
          if (!open) {
            setDiscountInput(0);
            setDiscountType("flat");
            setAppliedCoupon(null);
            setCouponCode("");
            setCouponError("");
            resetPaymentFields();
            setBillFinalized(false);
            resetCustomerFields();
          }
          setShowPrint(open);
        }}
      >
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
              {restaurantGSTIN && <p>GSTIN: {restaurantGSTIN}</p>}
            </div>
            <div className="border-t border-dashed my-2 pt-2 space-y-1">
              {savedBillNumber && (
                <p>Bill No: {formatBillNumber(savedBillNumber)}</p>
              )}
              <p>Table: {effectiveTable?.name}</p>
              <p>Date: {new Date().toLocaleString()}</p>
              {/* Customer details on receipt */}
              {(customerName ||
                customerMobile ||
                customerCompany ||
                customerGSTIN) && (
                <div className="border-t border-dashed mt-2 pt-2 space-y-0.5">
                  {customerName && (
                    <p className="font-semibold">{customerName}</p>
                  )}
                  {customerMobile && <p>Mobile: {customerMobile}</p>}
                  {customerCompany && <p>Company: {customerCompany}</p>}
                  {customerGSTIN && <p>GSTIN: {customerGSTIN}</p>}
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
                  <span>
                    Discount
                    {discountType === "percent" ? ` (${discountInput}%)` : ""}
                  </span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              {couponDiscount > 0 && appliedCoupon && (
                <div className="flex justify-between">
                  <span>Coupon ({appliedCoupon.code})</span>
                  <span>-₹{couponDiscount.toFixed(2)}</span>
                </div>
              )}
              {/* Tax Breakup on receipt */}
              <div className="flex justify-between">
                <span>CGST ({taxRate / 2}%)</span>
                <span>₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST ({taxRate / 2}%)</span>
                <span>₹{sgst.toFixed(2)}</span>
              </div>
              {/* Round Off on receipt */}
              {Math.abs(roundOff) > 0.001 && (
                <div className="flex justify-between">
                  <span>Round Off</span>
                  <span>
                    {roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}
                  </span>
                </div>
              )}
              {/* Payment breakdown */}
              <div className="border-t border-dashed pt-1 mt-1 space-y-0.5">
                <p className="font-semibold">Payment:</p>
                {payAmounts.cash > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>💵 Cash</span>
                    <span>₹{payAmounts.cash.toFixed(2)}</span>
                  </div>
                )}
                {payAmounts.hdfc > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>💳 {card1Name}</span>
                    <span>₹{payAmounts.hdfc.toFixed(2)}</span>
                  </div>
                )}
                {payAmounts.sbi > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>💳 {card2Name}</span>
                    <span>₹{payAmounts.sbi.toFixed(2)}</span>
                  </div>
                )}
                {payAmounts.upi > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>📱 UPI</span>
                    <span>₹{payAmounts.upi.toFixed(2)}</span>
                  </div>
                )}
                {payAmounts.due > 0 && (
                  <div className="flex justify-between pl-2 text-orange-600">
                    <span>🕐 Customer Due</span>
                    <span>₹{payAmounts.due.toFixed(2)}</span>
                  </div>
                )}
                {payAmountsBalance > 0.01 && (
                  <div className="flex justify-between pl-2 text-orange-600">
                    <span>🕐 Balance Due</span>
                    <span>₹{payAmountsBalance.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-bold border-t border-dashed pt-1">
                <span>TOTAL</span>
                <span>₹{total.toFixed(0)}</span>
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
                setBillFinalized(false);
                resetPaymentFields();
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
