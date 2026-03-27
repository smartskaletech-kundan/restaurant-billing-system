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
  ScanLine,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TABLES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
const INITIAL_TABLE_STATUS: Record<string, "Available" | "Occupied"> = {
  T1: "Occupied",
  T2: "Available",
  T3: "Occupied",
  T4: "Available",
  T5: "Available",
  T6: "Occupied",
  T7: "Available",
  T8: "Occupied",
};

type OrderStatus = "New" | "Accepted" | "Preparing" | "Ready";
interface Order {
  id: string;
  table: string;
  items: string;
  amount: number;
  status: OrderStatus;
}

const INITIAL_ORDERS: Order[] = [
  {
    id: "ORD-001",
    table: "T1",
    items: "Butter Chicken x2, Naan x4",
    amount: 680,
    status: "New",
  },
  {
    id: "ORD-002",
    table: "T3",
    items: "Paneer Tikka x1, Dal Makhani x1",
    amount: 420,
    status: "Accepted",
  },
  {
    id: "ORD-003",
    table: "T6",
    items: "Biryani x2, Raita x2",
    amount: 560,
    status: "Preparing",
  },
];

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
  const [selectedTable, setSelectedTable] = useState("T1");
  const [tableStatus] = useState(INITIAL_TABLE_STATUS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);

  const tableUrl = `https://menu.smartskale.com/table/${selectedTable}`;

  function handleAccept(id: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "Accepted" } : o)),
    );
    toast.success("Order accepted");
  }
  function handleReady(id: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "Ready" } : o)),
    );
    toast.success("Order marked as ready");
  }

  function handleCopyLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(tableUrl).then(() => {
        toast.success("Link copied to clipboard!");
      });
    } else {
      // Fallback for browsers without clipboard API
      const el = document.createElement("input");
      el.value = tableUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast.success("Link copied!");
    }
  }

  const statusColor: Record<OrderStatus, string> = {
    New: "bg-blue-500/20 text-blue-400",
    Accepted: "bg-yellow-500/20 text-yellow-400",
    Preparing: "bg-orange-500/20 text-orange-400",
    Ready: "bg-green-500/20 text-green-400",
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">
        QR Menu &amp; Orders
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Active Tables",
            value: "3",
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
        <CardHeader>
          <CardTitle>Incoming Orders</CardTitle>
        </CardHeader>
        <CardContent>
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
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.id}</TableCell>
                  <TableCell>{o.table}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.items}
                  </TableCell>
                  <TableCell>₹{o.amount}</TableCell>
                  <TableCell>
                    <Badge className={statusColor[o.status]}>{o.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {o.status === "New" && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleAccept(o.id)}
                        >
                          Accept
                        </Button>
                      )}
                      {o.status === "Accepted" && (
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={() => handleReady(o.id)}
                        >
                          Mark Ready
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
        </CardContent>
      </Card>
    </div>
  );
}

export { QRMenu };
