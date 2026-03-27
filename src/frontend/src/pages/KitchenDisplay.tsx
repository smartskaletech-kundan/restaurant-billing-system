import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Order } from "../backend";
import { useActor } from "../hooks/useActor";

function formatTime(createdAt: bigint) {
  const ms = Number(createdAt) / 1_000_000;
  return new Date(ms).toLocaleTimeString();
}

function getElapsed(createdAt: bigint) {
  const ms = Number(createdAt) / 1_000_000;
  const elapsed = Math.floor((Date.now() - ms) / 60000);
  if (elapsed < 1) return "just now";
  if (elapsed === 1) return "1m ago";
  return `${elapsed}m ago`;
}

function ElapsedBadge({ createdAt }: { createdAt: bigint }) {
  const ms = Number(createdAt) / 1_000_000;
  const elapsed = Math.floor((Date.now() - ms) / 60000);
  const color =
    elapsed >= 20
      ? "bg-red-100 text-red-700"
      : elapsed >= 10
        ? "bg-yellow-100 text-yellow-700"
        : "bg-green-100 text-green-700";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {getElapsed(createdAt)}
    </span>
  );
}

export function KitchenDisplay() {
  const { actor, isFetching } = useActor();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!actor) return;
    try {
      const all = await actor.getOrders();
      const active = all.filter((o) =>
        ["kotSent", "inProgress", "ready"].includes(o.status),
      );
      setOrders(active);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Kitchen load error:", err);
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    if (!actor || isFetching) return;
    load();
    const interval = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [actor, isFetching, load]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (!actor) return;
    setUpdating(orderId);
    try {
      const result = await actor.updateOrderStatus(orderId, newStatus);
      const updated = Array.isArray(result)
        ? result.length > 0
          ? result[0]
          : null
        : result;
      if (!updated) {
        throw new Error("Order not found");
      }
      const label =
        newStatus === "inProgress"
          ? "In Progress"
          : newStatus === "ready"
            ? "Ready"
            : "Completed";
      toast.success(`Order marked as ${label}`);
      await load();
    } catch (err) {
      console.error("Status update error:", err);
      toast.error("Failed to update order status");
    } finally {
      setUpdating(null);
    }
  };

  const pending = orders.filter((o) => o.status === "kotSent");
  const inProgress = orders.filter((o) => o.status === "inProgress");
  const ready = orders.filter((o) => o.status === "ready");

  const KOTCard = ({
    order,
    actions,
  }: {
    order: Order;
    actions: {
      label: string;
      newStatus: string;
      variant?: "default" | "outline";
    }[];
  }) => (
    <div className="bg-card border border-border rounded-xl p-4 shadow-card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-foreground">{order.tableName}</p>
          <p className="text-xs text-muted-foreground">
            {formatTime(order.createdAt)}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            #{order.id.slice(-6)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ElapsedBadge createdAt={order.createdAt} />
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
            {order.items.length} items
          </span>
        </div>
      </div>
      <div className="space-y-1.5 border-t border-border pt-2">
        {order.items.map((item) => (
          <div
            key={`${item.menuItemId}-${item.name}`}
            className="flex justify-between text-sm"
          >
            <span className="text-foreground">{item.name}</span>
            <span className="font-bold text-foreground bg-muted px-1.5 py-0.5 rounded text-xs">
              ×{Number(item.quantity)}
            </span>
          </div>
        ))}
      </div>
      {order.specialInstructions && (
        <p className="text-xs text-muted-foreground border-t border-dashed pt-2">
          📝 {order.specialInstructions}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        {actions.map((action) => (
          <Button
            key={action.newStatus}
            type="button"
            data-ocid={`kitchen.${action.newStatus}.button`}
            size="sm"
            variant={action.variant ?? "default"}
            className="flex-1 text-xs"
            disabled={updating === order.id}
            onClick={() => updateStatus(order.id, action.newStatus)}
          >
            {updating === order.id ? (
              <span className="animate-spin">⏳</span>
            ) : (
              action.label
            )}
          </Button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="kitchen.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="kitchen.page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Kitchen Display
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {orders.length} active order{orders.length !== 1 ? "s" : ""} ·
            Auto-refreshes every 15s · Last:{" "}
            {lastRefreshed.toLocaleTimeString()}
          </p>
        </div>
        <Button
          type="button"
          data-ocid="kitchen.refresh.button"
          variant="outline"
          onClick={load}
        >
          🔄 Refresh Now
        </Button>
      </div>

      {orders.length === 0 && (
        <div className="bg-card border border-border rounded-xl text-center py-16">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-foreground font-semibold">Kitchen is clear!</p>
          <p className="text-muted-foreground text-sm mt-1">
            No active orders. Orders sent from Order Management will appear
            here.
          </p>
          <Button variant="outline" className="mt-4" onClick={load}>
            🔄 Refresh
          </Button>
        </div>
      )}

      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {/* Pending */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-3 h-3 rounded-full bg-orange-400" />
              <h3 className="font-semibold text-foreground">New Orders</h3>
              <span className="ml-auto bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {pending.length}
              </span>
            </div>
            {pending.length === 0 ? (
              <div
                className="bg-card border border-border rounded-xl p-6 text-center"
                data-ocid="kitchen.pending.empty_state"
              >
                <p className="text-muted-foreground text-sm">No new orders</p>
              </div>
            ) : (
              pending.map((order, i) => (
                <div key={order.id} data-ocid={`kitchen.pending.item.${i + 1}`}>
                  <KOTCard
                    order={order}
                    actions={[
                      { label: "▶ Start Preparing", newStatus: "inProgress" },
                    ]}
                  />
                </div>
              ))
            )}
          </div>

          {/* In Progress */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="font-semibold text-foreground">In Progress</h3>
              <span className="ml-auto bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {inProgress.length}
              </span>
            </div>
            {inProgress.length === 0 ? (
              <div
                className="bg-card border border-border rounded-xl p-6 text-center"
                data-ocid="kitchen.inprogress.empty_state"
              >
                <p className="text-muted-foreground text-sm">
                  No orders in progress
                </p>
              </div>
            ) : (
              inProgress.map((order, i) => (
                <div
                  key={order.id}
                  data-ocid={`kitchen.inprogress.item.${i + 1}`}
                >
                  <KOTCard
                    order={order}
                    actions={[{ label: "✓ Mark Ready", newStatus: "ready" }]}
                  />
                </div>
              ))
            )}
          </div>

          {/* Ready */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <h3 className="font-semibold text-foreground">Ready to Serve</h3>
              <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {ready.length}
              </span>
            </div>
            {ready.length === 0 ? (
              <div
                className="bg-card border border-border rounded-xl p-6 text-center"
                data-ocid="kitchen.ready.empty_state"
              >
                <p className="text-muted-foreground text-sm">No orders ready</p>
              </div>
            ) : (
              ready.map((order, i) => (
                <div key={order.id} data-ocid={`kitchen.ready.item.${i + 1}`}>
                  <KOTCard
                    order={order}
                    actions={[
                      {
                        label: "✅ Served / Complete",
                        newStatus: "closed",
                        variant: "outline",
                      },
                    ]}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
