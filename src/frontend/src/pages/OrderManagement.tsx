import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Page, SelectedOrder, SelectedTable } from "../App";
import type { MenuItem, Order, OrderItem } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";
import { loadWaitersFromStorage } from "./TableManagement";

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

interface Props {
  navigateTo: (
    page: Page,
    table?: SelectedTable,
    order?: SelectedOrder,
  ) => void;
  selectedTable: SelectedTable | null;
  selectedOrder: SelectedOrder | null;
  setSelectedOrder: (o: SelectedOrder | null) => void;
}

const CATEGORIES = ["Starters", "Mains", "Beverages", "Desserts"];

export function OrderManagement({
  navigateTo,
  selectedTable,
  setSelectedOrder,
}: Props) {
  const { actor, isFetching } = useActor();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [existingOrder, setExistingOrder] = useState<Order | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKOT, setShowKOT] = useState(false);
  const [selectedWaiter, setSelectedWaiter] = useState<string>("none");
  const { restaurantId } = useRestaurant();
  const waiters = loadWaitersFromStorage(restaurantId);

  useEffect(() => {
    if (!actor || isFetching) return;
    setLoading(true);
    const promises: Promise<unknown>[] = [actor.getMenuItems()];
    if (selectedTable) {
      promises.push(actor.getOrderByTable(selectedTable.id));
    }
    Promise.all(promises)
      .then(([items, orderRaw]) => {
        setMenuItems(items as MenuItem[]);
        // Handle optional Order: could be null, undefined, [] or [Order]
        let o: Order | null = null;
        if (orderRaw != null) {
          if (Array.isArray(orderRaw)) {
            o = orderRaw.length > 0 ? (orderRaw[0] as Order) : null;
          } else {
            o = orderRaw as Order;
          }
        }
        if (o && o.status !== "billed" && o.status !== "closed") {
          setExistingOrder(o);
          setCart(
            o.items.map((i) => ({
              menuItemId: i.menuItemId,
              name: i.name,
              price: i.price,
              quantity: Number(i.quantity),
              note: i.note,
            })),
          );
          setInstructions(o.specialInstructions);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load order data:", err);
        setLoading(false);
      });
  }, [actor, isFetching, selectedTable]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menuItemId === item.id);
      if (idx >= 0) {
        return prev.map((c, i) =>
          i === idx ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          note: "",
        },
      ];
    });
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId
            ? { ...c, quantity: c.quantity + delta }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const toOrderItems = (): OrderItem[] =>
    cart.map((c) => ({
      menuItemId: c.menuItemId,
      name: c.name,
      price: c.price,
      quantity: BigInt(c.quantity),
      note: c.note,
    }));

  const handleSaveOrder = async () => {
    if (!actor || !selectedTable) return;
    if (cart.length === 0) {
      toast.error("Please add items to the order first");
      return;
    }
    setSaving(true);
    try {
      const items = toOrderItems();
      if (existingOrder) {
        const result = await actor.updateOrderItems(existingOrder.id, items);
        // Handle optional return
        const updated = Array.isArray(result)
          ? result.length > 0
            ? result[0]
            : null
          : result;
        if (updated) setExistingOrder(updated as Order);
        toast.success("Order updated successfully");
      } else {
        const order = await actor.createOrder(
          selectedTable.id,
          selectedTable.name,
          items,
          instructions,
        );
        setExistingOrder(order);
        setSelectedOrder({
          id: order.id,
          tableId: order.tableId,
          tableName: order.tableName,
        });
        toast.success("Order created successfully");
      }
    } catch (err) {
      console.error("Save order error:", err);
      toast.error("Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  const handleSendToKitchen = async () => {
    if (!actor) {
      toast.error("Not connected. Please refresh the page.");
      return;
    }
    if (!selectedTable) {
      toast.error(
        "No table selected. Go to Table Management and select a table.",
      );
      return;
    }
    if (cart.length === 0) {
      toast.error("Please add items to the order before sending to kitchen.");
      return;
    }
    setSaving(true);
    try {
      let order = existingOrder;
      const items = toOrderItems();

      if (!order) {
        // Create new order
        order = await actor.createOrder(
          selectedTable.id,
          selectedTable.name,
          items,
          instructions,
        );
        if (!order || !order.id) {
          throw new Error(
            "Failed to create order — invalid response from backend",
          );
        }
        setExistingOrder(order);
        setSelectedOrder({
          id: order.id,
          tableId: order.tableId,
          tableName: order.tableName,
        });
      } else {
        // Update existing order items
        await actor.updateOrderItems(order.id, items);
      }

      // Send to kitchen by updating status
      const statusResult = await actor.updateOrderStatus(order.id, "kotSent");
      // Validate that status was actually updated
      const updatedOrder = Array.isArray(statusResult)
        ? statusResult.length > 0
          ? statusResult[0]
          : null
        : statusResult;

      if (!updatedOrder) {
        throw new Error("Kitchen update failed — order not found in backend");
      }

      setExistingOrder(updatedOrder as Order);
      toast.success("✅ Order sent to kitchen!");
      setShowKOT(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to send to kitchen";
      console.error("Send to kitchen error:", err);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateBill = () => {
    if (!selectedTable || !existingOrder) {
      toast.error("Please save order first before generating a bill");
      return;
    }
    setSelectedOrder({
      id: existingOrder.id,
      tableId: selectedTable.id,
      tableName: selectedTable.name,
    });
    navigateTo("billing", selectedTable, {
      id: existingOrder.id,
      tableId: selectedTable.id,
      tableName: selectedTable.name,
    });
  };

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const itemsByCategory = CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = menuItems.filter((m) => m.category === cat && m.available);
      return acc;
    },
    {} as Record<string, MenuItem[]>,
  );

  const waiterName =
    selectedWaiter !== "none"
      ? (waiters.find((w) => String(w.id) === selectedWaiter)?.name ?? "")
      : "";

  if (!selectedTable) {
    return (
      <div
        className="bg-card border border-border rounded-xl text-center py-16"
        data-ocid="orders.empty_state"
      >
        <p className="text-4xl mb-3">📋</p>
        <p className="text-muted-foreground">
          Select a table from Table Management to start an order
        </p>
        <Button className="mt-4" onClick={() => navigateTo("tables")}>
          Go to Tables
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="orders.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-ocid="orders.page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {selectedTable.name}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {existingOrder
              ? `Order #${existingOrder.id.slice(-6)} · ${existingOrder.status}`
              : "New Order"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            data-ocid="orders.save.button"
            variant="outline"
            onClick={handleSaveOrder}
            disabled={saving}
          >
            💾 Save Order
          </Button>
          <Button
            data-ocid="orders.kitchen.button"
            onClick={handleSendToKitchen}
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {saving ? "Sending..." : "🍳 Send to Kitchen"}
          </Button>
          <Button
            data-ocid="orders.bill.button"
            variant="outline"
            onClick={handleGenerateBill}
            disabled={!existingOrder}
          >
            💰 Generate Bill
          </Button>
        </div>
      </div>

      {/* Waiter Selection Bar */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-4">
        <Label className="text-sm font-medium whitespace-nowrap">
          🧑‍🍽️ Assign Waiter
        </Label>
        <Select value={selectedWaiter} onValueChange={setSelectedWaiter}>
          <SelectTrigger className="w-56" data-ocid="orders.waiter.select">
            <SelectValue placeholder="Select waiter..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— No Waiter Assigned —</SelectItem>
            {waiters.map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>
                {w.name}
                {w.phone ? ` (${w.phone})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {waiterName && (
          <span className="text-sm text-muted-foreground">
            Serving: <strong className="text-foreground">{waiterName}</strong>
          </span>
        )}
        {waiters.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Add waiters in{" "}
            <button
              type="button"
              className="text-primary underline"
              onClick={() => navigateTo("tables")}
            >
              Table Management
            </button>
          </span>
        )}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Menu Panel */}
        <div className="col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">Menu</h3>
          </div>
          <Tabs defaultValue="Starters">
            <TabsList className="m-3 w-auto">
              {CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  data-ocid={`orders.${cat.toLowerCase()}.tab`}
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
            {CATEGORIES.map((cat) => (
              <TabsContent key={cat} value={cat} className="p-3 pt-0">
                {itemsByCategory[cat]?.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    No items in {cat}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {itemsByCategory[cat]?.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-ocid="orders.menu_item.button"
                        onClick={() => addToCart(item)}
                        className="bg-background border border-border rounded-lg p-3 text-left hover:border-primary/50 hover:bg-accent/30 transition-all"
                      >
                        <p className="font-medium text-sm text-foreground">
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                        <p className="text-primary font-semibold text-sm mt-1">
                          ₹{item.price.toFixed(2)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Cart Panel */}
        <div className="col-span-2 bg-card border border-border rounded-xl flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              Current Order ({cart.length} items)
            </h3>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs text-destructive hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No items added yet. Click items from the menu to add.
              </p>
            ) : (
              cart.map((item, i) => (
                <div
                  key={item.menuItemId}
                  data-ocid={`orders.cart_item.${i + 1}`}
                  className="flex items-center gap-2 bg-background rounded-lg p-2.5 border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ₹{item.price.toFixed(2)} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-ocid={`orders.qty_minus.${i + 1}`}
                      onClick={() => updateQty(item.menuItemId, -1)}
                      className="w-6 h-6 rounded bg-muted hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-sm transition-colors"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      data-ocid={`orders.qty_plus.${i + 1}`}
                      onClick={() => updateQty(item.menuItemId, 1)}
                      className="w-6 h-6 rounded bg-muted hover:bg-primary/10 hover:text-primary flex items-center justify-center text-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-foreground w-16 text-right">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-border space-y-3">
            <Textarea
              data-ocid="orders.instructions.textarea"
              placeholder="Special instructions..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="text-sm resize-none h-16"
            />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Subtotal</span>
              <span className="font-bold text-foreground">
                ₹{subtotal.toFixed(2)}
              </span>
            </div>
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleSendToKitchen}
              disabled={saving || cart.length === 0}
              data-ocid="orders.kitchen_cart.button"
            >
              {saving ? "Sending..." : "🍳 Send to Kitchen"}
            </Button>
          </div>
        </div>
      </div>

      {/* KOT Modal */}
      <Dialog open={showKOT} onOpenChange={setShowKOT}>
        <DialogContent className="max-w-sm" data-ocid="orders.kot.dialog">
          <DialogHeader>
            <DialogTitle>Kitchen Order Ticket (KOT)</DialogTitle>
          </DialogHeader>
          <div className="print-bill font-mono text-sm space-y-3 py-2">
            <div className="text-center border-b border-dashed pb-3">
              <p className="font-bold text-base">KOT</p>
              <p className="text-muted-foreground">
                Table: {selectedTable.name}
              </p>
              {waiterName && (
                <p className="text-muted-foreground text-xs">
                  Waiter: {waiterName}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {new Date().toLocaleString()}
              </p>
              {existingOrder && (
                <p className="text-xs text-muted-foreground">
                  Order #{existingOrder.id.slice(-6)}
                </p>
              )}
            </div>
            <div className="space-y-1">
              {cart.map((item) => (
                <div key={item.menuItemId} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-bold">×{item.quantity}</span>
                </div>
              ))}
            </div>
            {instructions && (
              <div className="border-t border-dashed pt-2">
                <p className="text-xs text-muted-foreground">
                  Note: {instructions}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              data-ocid="orders.kot_print.button"
              variant="outline"
              onClick={() => window.print()}
            >
              🖨 Print KOT
            </Button>
            <Button
              data-ocid="orders.kot_close.button"
              onClick={() => setShowKOT(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
