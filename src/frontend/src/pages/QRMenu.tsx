import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Copy,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Order } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActorExtended as useActor } from "../hooks/useActorExtended";

const TABLES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

type OrderStatus = "New" | "Accepted" | "Preparing" | "Ready";
interface DisplayOrder {
  id: string;
  rawId: string;
  table: string;
  items: string;
  amount: number;
  status: OrderStatus;
}

function mapStatus(backendStatus: string): OrderStatus {
  if (backendStatus === "kotSent") return "New";
  if (backendStatus === "inProgress") return "Accepted";
  if (backendStatus === "ready") return "Ready";
  return "Preparing";
}

function QRPattern({ table }: { table: string }) {
  const seed = table.charCodeAt(table.length - 1);
  const pattern = Array.from({ length: 64 }, (_, i) => {
    const r = Math.floor(i / 8);
    const c = i % 8;
    if ((r < 3 && c < 3) || (r < 3 && c > 4) || (r > 4 && c < 3)) return true;
    return (seed * (i + 7) * 13) % 17 < 8;
  });
  return (
    <div
      className="inline-grid gap-0.5"
      style={{ gridTemplateColumns: "repeat(8, 1fr)" }}
    >
      {pattern.map((filled, i) => (
        <div
          key={String(i)}
          className={`w-5 h-5 rounded-sm ${
            filled ? "bg-foreground" : "bg-background border border-muted"
          }`}
        />
      ))}
    </div>
  );
}

export default function QRMenu() {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const [selectedTable, setSelectedTable] = useState("T1");
  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [updating, setUpdating] = useState<string | null>(null);

  const tableUrl = `https://menu.smartskale.com/table/${selectedTable}`;

  const load = useCallback(async () => {
    if (!actor) return;
    try {
      const all: Order[] = await actor.getOrdersR(restaurantId);
      const active = all.filter((o) =>
        ["kotSent", "inProgress", "ready"].includes(o.status),
      );
      const display: DisplayOrder[] = active.map((o) => ({
        id: `ORD-${o.id.slice(-6)}`,
        rawId: o.id,
        table: o.tableName,
        items: o.items
          .map((item) => `${item.name} x${Number(item.quantity)}`)
          .join(", "),
        amount: o.items.reduce(
          (sum, item) => sum + item.price * Number(item.quantity),
          0,
        ),
        status: mapStatus(o.status),
      }));
      setOrders(display);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("QRMenu load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actor, restaurantId]);

  useEffect(() => {
    if (!actor || isFetching) return;
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [actor, isFetching, load]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  async function handleAccept(rawId: string) {
    if (!actor) return;
    setUpdating(rawId);
    try {
      const result = await actor.updateOrderStatus(rawId, "inProgress");
      if (!result) throw new Error("Order not found");
      toast.success("Order accepted");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to accept order");
    } finally {
      setUpdating(null);
    }
  }

  async function handleReady(rawId: string) {
    if (!actor) return;
    setUpdating(rawId);
    try {
      const result = await actor.updateOrderStatus(rawId, "ready");
      if (!result) throw new Error("Order not found");
      toast.success("Order marked as ready");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark order ready");
    } finally {
      setUpdating(null);
    }
  }

  function handleCopyLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(tableUrl).then(() => {
        toast.success("Link copied to clipboard!");
      });
    } else {
      const el = document.createElement("input");
      el.value = tableUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast.success("Link copied!");
    }
  }

  // Compute table occupancy from live orders
  const occupiedTables = new Set(orders.map((o) => o.table));
  const tableStatus: Record<string, "Available" | "Occupied"> = {};
  for (const t of TABLES) {
    tableStatus[t] = occupiedTables.has(t) ? "Occupied" : "Available";
  }

  const statusColor: Record<OrderStatus, string> = {
    New: "bg-blue-500/20 text-blue-400",
    Accepted: "bg-yellow-500/20 text-yellow-400",
    Preparing: "bg-orange-500/20 text-orange-400",
    Ready: "bg-green-500/20 text-green-400",
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="qr.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          QR Menu &amp; Orders
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Last refreshed: {lastRefreshed.toLocaleTimeString()} · Auto-refreshes
          every 3s
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Active Tables",
            value: occupiedTables.size.toString(),
            icon: Users,
            color: "text-blue-400",
          },
          {
            label: "QR Scans Today",
            value: "47",
            icon: ScanLine,
            color: "text-purple-400",
          },
          {
            label: "Pending Orders",
            value: orders
              .filter((o) => o.status === "New" || o.status === "Accepted")
              .length.toString(),
            icon: ShoppingBag,
            color: "text-orange-400",
          },
          {
            label: "Total Revenue",
            value: "₹12,480",
            icon: TrendingUp,
            color: "text-green-400",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table + QR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {TABLES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setSelectedTable(t)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  selectedTable === t
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className="font-medium">Table {t}</span>
                <Badge
                  className={
                    tableStatus[t] === "Occupied"
                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                      : "bg-green-500/20 text-green-400 border-green-500/30"
                  }
                >
                  {tableStatus[t]}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" /> QR Code — Table {selectedTable}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-xl shadow-lg">
              <QRPattern table={selectedTable} />
            </div>
            <p className="text-sm text-muted-foreground break-all">
              {tableUrl}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                data-ocid="qr.copy_link.button"
              >
                <Copy className="h-4 w-4 mr-2" /> Copy Link
              </Button>
              <Button
                size="sm"
                data-ocid="qr.print.button"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4 mr-2" /> Print QR
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incoming Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Incoming Orders</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-ocid="qr.refresh.button"
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div
              className="text-center py-12"
              data-ocid="qr.orders.empty_state"
            >
              <p className="text-4xl mb-3">📋</p>
              <p className="text-foreground font-semibold">No active orders</p>
              <p className="text-muted-foreground text-sm mt-1">
                Orders placed via QR menu will appear here automatically.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order#</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o, i) => (
                  <TableRow key={o.rawId} data-ocid={`qr.orders.item.${i + 1}`}>
                    <TableCell className="font-medium">{o.id}</TableCell>
                    <TableCell>{o.table}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.items}
                    </TableCell>
                    <TableCell>₹{o.amount}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[o.status]}>
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {o.status === "New" && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={updating === o.rawId}
                            onClick={() => handleAccept(o.rawId)}
                            data-ocid={`qr.accept.button.${i + 1}`}
                          >
                            {updating === o.rawId ? (
                              <span className="animate-spin">⏳</span>
                            ) : (
                              "Accept"
                            )}
                          </Button>
                        )}
                        {o.status === "Accepted" && (
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600"
                            disabled={updating === o.rawId}
                            onClick={() => handleReady(o.rawId)}
                            data-ocid={`qr.ready.button.${i + 1}`}
                          >
                            {updating === o.rawId ? (
                              <span className="animate-spin">⏳</span>
                            ) : (
                              "Mark Ready"
                            )}
                          </Button>
                        )}
                        {(o.status === "Preparing" || o.status === "Ready") && (
                          <span className="text-xs text-muted-foreground">
                            {o.status === "Ready" ? "✓ Ready" : "In Kitchen"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { QRMenu };
