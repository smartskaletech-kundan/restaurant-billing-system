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

interface KOTRound {
  roundNo: number;
  sentAt: string;
  items: CartItem[];
  waiterName: string;
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

function getKOTKey(orderId: string) {
  return `kot_rounds_${orderId}`;
}

function loadKOTRounds(orderId: string): KOTRound[] {
  try {
    const raw = localStorage.getItem(getKOTKey(orderId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveKOTRounds(orderId: string, rounds: KOTRound[]) {
  localStorage.setItem(getKOTKey(orderId), JSON.stringify(rounds));
}

export function OrderManagement({
  navigateTo,
  selectedTable,
  setSelectedOrder,
}: Props) {
  const { actor, isFetching } = useActor();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [existingOrder, setExistingOrder] = useState<Order | null>(null);
  // sentItems: items already punched in previous KOT rounds
  const [sentItems, setSentItems] = useState<CartItem[]>([]);
  // cart: only NEW items added this round
  const [cart, setCart] = useState<CartItem[]>([]);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKOT, setShowKOT] = useState(false);
  const [kotRounds, setKotRounds] = useState<KOTRound[]>([]);
  const [editRoundIdx, setEditRoundIdx] = useState<number | null>(null);
  const [editRoundItems, setEditRoundItems] = useState<CartItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
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
          setInstructions(o.specialInstructions);
          // Load previous KOT rounds
          const rounds = loadKOTRounds(o.id);
          setKotRounds(rounds);
          // Determine what's already been sent vs what's new
          if (rounds.length > 0) {
            // Reconstruct sentItems from all KOT rounds
            const sent: CartItem[] = [];
            for (const round of rounds) {
              for (const ri of round.items) {
                const idx = sent.findIndex(
                  (s) => s.menuItemId === ri.menuItemId,
                );
                if (idx >= 0) {
                  sent[idx] = {
                    ...sent[idx],
                    quantity: sent[idx].quantity + ri.quantity,
                  };
                } else {
                  sent.push({ ...ri });
                }
              }
            }
            setSentItems(sent);
            setCart([]);
          } else {
            // No KOT history yet — treat existing order items as already sent
            const sent = o.items.map((i) => ({
              menuItemId: i.menuItemId,
              name: i.name,
              price: i.price,
              quantity: Number(i.quantity),
              note: i.note,
            }));
            setSentItems(sent);
            setCart([]);
          }
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

  // Merge sentItems + cart into full order items for backend
  const buildAllOrderItems = (newCart: CartItem[]): OrderItem[] => {
    const merged: CartItem[] = [...sentItems];
    for (const ni of newCart) {
      const idx = merged.findIndex((s) => s.menuItemId === ni.menuItemId);
      if (idx >= 0) {
        merged[idx] = {
          ...merged[idx],
          quantity: merged[idx].quantity + ni.quantity,
        };
      } else {
        merged.push({ ...ni });
      }
    }
    return merged.map((c) => ({
      menuItemId: c.menuItemId,
      name: c.name,
      price: c.price,
      quantity: BigInt(c.quantity),
      note: c.note,
    }));
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
      toast.error(
        "Please add NEW items to send to kitchen. Previous items were already sent.",
      );
      return;
    }
    setSaving(true);
    try {
      let order = existingOrder;
      const allItems = buildAllOrderItems(cart);

      if (!order) {
        order = await actor.createOrder(
          selectedTable.id,
          selectedTable.name,
          allItems,
          instructions,
        );
        if (!order || !order.id) throw new Error("Failed to create order");
        setExistingOrder(order);
        setSelectedOrder({
          id: order.id,
          tableId: order.tableId,
          tableName: order.tableName,
        });
      } else {
        await actor.updateOrderItems(order.id, allItems);
      }

      const statusResult = await actor.updateOrderStatus(order.id, "kotSent");
      const updatedOrder = Array.isArray(statusResult)
        ? statusResult.length > 0
          ? statusResult[0]
          : null
        : statusResult;

      if (!updatedOrder) throw new Error("Kitchen update failed");
      setExistingOrder(updatedOrder as Order);

      // Save this as a new KOT round
      const waiterName =
        selectedWaiter !== "none"
          ? (waiters.find((w) => String(w.id) === selectedWaiter)?.name ?? "")
          : "";
      const newRound: KOTRound = {
        roundNo: kotRounds.length + 1,
        sentAt: new Date().toLocaleString(),
        items: [...cart],
        waiterName,
      };
      const updatedRounds = [...kotRounds, newRound];
      setKotRounds(updatedRounds);
      saveKOTRounds(order.id, updatedRounds);

      // Move cart to sentItems
      const newSent = [...sentItems];
      for (const ni of cart) {
        const idx = newSent.findIndex((s) => s.menuItemId === ni.menuItemId);
        if (idx >= 0) {
          newSent[idx] = {
            ...newSent[idx],
            quantity: newSent[idx].quantity + ni.quantity,
          };
        } else {
          newSent.push({ ...ni });
        }
      }
      setSentItems(newSent);
      setCart([]);

      toast.success("✅ New items sent to kitchen!");
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

  const handleSaveOrder = async () => {
    if (!actor || !selectedTable) return;
    if (cart.length === 0 && sentItems.length === 0) {
      toast.error("Please add items to the order first");
      return;
    }
    setSaving(true);
    try {
      const allItems = buildAllOrderItems(cart);
      if (existingOrder) {
        const result = await actor.updateOrderItems(existingOrder.id, allItems);
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
          allItems,
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

  // Edit KOT round: open dialog with that round's items
  const handleEditRound = (idx: number) => {
    setEditRoundIdx(idx);
    setEditRoundItems(kotRounds[idx].items.map((i) => ({ ...i })));
  };

  const handleEditRoundQty = (menuItemId: string, delta: number) => {
    setEditRoundItems((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId
            ? { ...c, quantity: c.quantity + delta }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const handleSaveEditRound = async () => {
    if (editRoundIdx === null || !existingOrder || !actor) return;
    setSaving(true);
    try {
      const updatedRounds = kotRounds.map((r, i) =>
        i === editRoundIdx ? { ...r, items: editRoundItems } : r,
      );
      // Recalculate sentItems from all rounds
      const newSent: CartItem[] = [];
      for (const round of updatedRounds) {
        for (const ri of round.items) {
          const idx = newSent.findIndex((s) => s.menuItemId === ri.menuItemId);
          if (idx >= 0) {
            newSent[idx] = {
              ...newSent[idx],
              quantity: newSent[idx].quantity + ri.quantity,
            };
          } else {
            newSent.push({ ...ri });
          }
        }
      }
      // Update backend order
      const allItems: OrderItem[] = newSent.map((c) => ({
        menuItemId: c.menuItemId,
        name: c.name,
        price: c.price,
        quantity: BigInt(c.quantity),
        note: c.note,
      }));
      await actor.updateOrderItems(existingOrder.id, allItems);
      saveKOTRounds(existingOrder.id, updatedRounds);
      setKotRounds(updatedRounds);
      setSentItems(newSent);
      setEditRoundIdx(null);
      toast.success("KOT updated");
    } catch {
      toast.error("Failed to update KOT");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRound = async (idx: number) => {
    if (!existingOrder || !actor) return;
    if (
      !confirm(
        `Delete KOT Round ${kotRounds[idx].roundNo}? This will remove those items from the order.`,
      )
    )
      return;
    setSaving(true);
    try {
      const updatedRounds = kotRounds
        .filter((_, i) => i !== idx)
        .map((r, i) => ({ ...r, roundNo: i + 1 }));
      // Recalculate sentItems
      const newSent: CartItem[] = [];
      for (const round of updatedRounds) {
        for (const ri of round.items) {
          const si = newSent.findIndex((s) => s.menuItemId === ri.menuItemId);
          if (si >= 0) {
            newSent[si] = {
              ...newSent[si],
              quantity: newSent[si].quantity + ri.quantity,
            };
          } else {
            newSent.push({ ...ri });
          }
        }
      }
      const allItems: OrderItem[] = newSent.map((c) => ({
        menuItemId: c.menuItemId,
        name: c.name,
        price: c.price,
        quantity: BigInt(c.quantity),
        note: c.note,
      }));
      await actor.updateOrderItems(existingOrder.id, allItems);
      saveKOTRounds(existingOrder.id, updatedRounds);
      setKotRounds(updatedRounds);
      setSentItems(newSent);
      toast.success("KOT round deleted");
    } catch {
      toast.error("Failed to delete KOT round");
    } finally {
      setSaving(false);
    }
  };

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const sentSubtotal = sentItems.reduce((s, c) => s + c.price * c.quantity, 0);
  const itemsByCategory = CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = menuItems.filter((m) => m.category === cat && m.available);
      return acc;
    },
    {} as Record<string, MenuItem[]>,
  );

  const currentWaiterName =
    selectedWaiter !== "none"
      ? (waiters.find((w) => String(w.id) === selectedWaiter)?.name ?? "")
      : "";

  const latestKOT = kotRounds[kotRounds.length - 1];

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
              ? `Order #${existingOrder.id.slice(-6)} · ${existingOrder.status} · KOT Rounds: ${kotRounds.length}`
              : "New Order"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {kotRounds.length > 0 && (
            <Button variant="outline" onClick={() => setShowHistory(true)}>
              📋 KOT History ({kotRounds.length})
            </Button>
          )}
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
        {currentWaiterName && (
          <span className="text-sm text-muted-foreground">
            Serving:{" "}
            <strong className="text-foreground">{currentWaiterName}</strong>
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
            <h3 className="font-semibold text-foreground">Order</h3>
          </div>

          {/* Previously sent items - read only */}
          {sentItems.length > 0 && (
            <div className="px-3 pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Already Sent (
                {kotRounds.length > 0
                  ? `${kotRounds.length} KOT round${kotRounds.length > 1 ? "s" : ""}`
                  : "existing order"}
                )
              </p>
              <div className="space-y-1 mb-2">
                {sentItems.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="flex items-center justify-between bg-muted/40 rounded px-2.5 py-1.5 text-sm"
                  >
                    <span className="text-foreground flex-1 truncate">
                      {item.name}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      ×{item.quantity}
                    </span>
                    <span className="text-muted-foreground ml-3 w-16 text-right">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-1 pb-2">
                <span>Sent subtotal</span>
                <span>₹{sentSubtotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* New items cart */}
          <div className="px-3 pt-2">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1.5">
              New Items — KOT Round {kotRounds.length + 1}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 space-y-2">
            {cart.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                Add new items from the menu to create the next KOT round
              </p>
            ) : (
              cart.map((item, i) => (
                <div
                  key={item.menuItemId}
                  data-ocid={`orders.cart_item.${i + 1}`}
                  className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-2.5"
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
            {cart.length > 0 && (
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-destructive hover:underline"
                >
                  Clear new items
                </button>
                <span className="text-sm font-semibold text-foreground">
                  New: ₹{subtotal.toFixed(2)}
                </span>
              </div>
            )}
            <Textarea
              data-ocid="orders.instructions.textarea"
              placeholder="Special instructions..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="text-sm resize-none h-16"
            />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Total</span>
              <span className="font-bold text-foreground">
                ₹{(sentSubtotal + subtotal).toFixed(2)}
              </span>
            </div>
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleSendToKitchen}
              disabled={saving || cart.length === 0}
              data-ocid="orders.kitchen_cart.button"
            >
              {saving
                ? "Sending..."
                : `🍳 Send KOT Round ${kotRounds.length + 1}`}
            </Button>
          </div>
        </div>
      </div>

      {/* KOT Print Dialog — only shows NEW items */}
      <Dialog open={showKOT} onOpenChange={setShowKOT}>
        <DialogContent className="max-w-sm" data-ocid="orders.kot.dialog">
          <DialogHeader>
            <DialogTitle>
              KOT — Round {latestKOT?.roundNo ?? kotRounds.length}
            </DialogTitle>
          </DialogHeader>
          <div className="print-bill font-mono text-sm space-y-3 py-2">
            <div className="text-center border-b border-dashed pb-3">
              <p className="font-bold text-base">KITCHEN ORDER TICKET</p>
              <p className="text-muted-foreground">
                Table: {selectedTable.name}
              </p>
              {latestKOT?.waiterName && (
                <p className="text-muted-foreground text-xs">
                  Waiter: {latestKOT.waiterName}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {latestKOT?.sentAt ?? new Date().toLocaleString()}
              </p>
              <p className="text-xs font-semibold text-orange-600">
                Round #{latestKOT?.roundNo ?? kotRounds.length} (New Items Only)
              </p>
              {existingOrder && (
                <p className="text-xs text-muted-foreground">
                  Order #{existingOrder.id.slice(-6)}
                </p>
              )}
            </div>
            <div className="space-y-1">
              {(latestKOT?.items ?? []).map((item) => (
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

      {/* KOT History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent
          className="max-w-2xl"
          data-ocid="orders.kot_history.dialog"
        >
          <DialogHeader>
            <DialogTitle>KOT History — {selectedTable.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {kotRounds.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                No KOT rounds yet
              </p>
            ) : (
              kotRounds.map((round, idx) => (
                <div
                  key={round.roundNo}
                  className="border border-border rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-foreground">
                        KOT Round #{round.roundNo}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {round.sentAt}
                      </span>
                      {round.waiterName && (
                        <span className="text-xs text-muted-foreground ml-2">
                          · Waiter: {round.waiterName}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowHistory(false);
                          handleEditRound(idx);
                        }}
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setShowHistory(false);
                          handleDeleteRound(idx);
                        }}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {round.items.map((item) => (
                      <div
                        key={item.menuItemId}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-foreground">{item.name}</span>
                        <span className="text-muted-foreground">
                          ×{item.quantity} — ₹
                          {(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-right text-muted-foreground mt-1 border-t border-border pt-1">
                    Round total: ₹
                    {round.items
                      .reduce((s, i) => s + i.price * i.quantity, 0)
                      .toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistory(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit KOT Round Dialog */}
      <Dialog
        open={editRoundIdx !== null}
        onOpenChange={(o) => {
          if (!o) setEditRoundIdx(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit KOT Round #
              {editRoundIdx !== null ? kotRounds[editRoundIdx]?.roundNo : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {editRoundItems.map((item) => (
              <div
                key={item.menuItemId}
                className="flex items-center gap-3 border border-border rounded-lg p-2.5"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{item.price.toFixed(2)} each
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditRoundQty(item.menuItemId, -1)}
                    className="w-7 h-7 rounded bg-muted hover:bg-destructive/10 flex items-center justify-center text-sm"
                  >
                    −
                  </button>
                  <Input
                    className="w-12 h-7 text-center text-sm"
                    value={item.quantity}
                    onChange={(e) => {
                      const v = Number.parseInt(e.target.value);
                      if (!Number.isNaN(v) && v >= 0) {
                        setEditRoundItems((prev) =>
                          prev
                            .map((c) =>
                              c.menuItemId === item.menuItemId
                                ? { ...c, quantity: v }
                                : c,
                            )
                            .filter((c) => c.quantity > 0),
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleEditRoundQty(item.menuItemId, 1)}
                    className="w-7 h-7 rounded bg-muted hover:bg-primary/10 flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-semibold w-16 text-right">
                  ₹{(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            {editRoundItems.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">
                All items removed — saving will delete this round
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoundIdx(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditRound} disabled={saving}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
