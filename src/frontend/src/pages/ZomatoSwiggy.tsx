import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Platform = "Zomato" | "Swiggy";
type OrderStatus = "New" | "Preparing" | "Out for Delivery";

interface DeliveryOrder {
  id: string;
  platform: Platform;
  customer: string;
  items: string[];
  total: number;
  timeAgo: string;
  status: OrderStatus;
}

interface MenuItem {
  id: number;
  name: string;
  price: number;
  zomato: boolean;
  swiggy: boolean;
}

const INITIAL_ORDERS: DeliveryOrder[] = [
  {
    id: "ZOM-8821",
    platform: "Zomato",
    customer: "Rahul Sharma",
    items: ["Butter Chicken", "Garlic Naan x2"],
    total: 520,
    timeAgo: "3 min ago",
    status: "New",
  },
  {
    id: "SWG-4412",
    platform: "Swiggy",
    customer: "Priya Mehta",
    items: ["Paneer Tikka", "Dal Fry", "Rice"],
    total: 650,
    timeAgo: "7 min ago",
    status: "Preparing",
  },
  {
    id: "ZOM-8822",
    platform: "Zomato",
    customer: "Amit Verma",
    items: ["Chicken Biryani x2"],
    total: 480,
    timeAgo: "12 min ago",
    status: "Out for Delivery",
  },
  {
    id: "SWG-4413",
    platform: "Swiggy",
    customer: "Deepa Singh",
    items: ["Veg Thali", "Lassi x2"],
    total: 380,
    timeAgo: "2 min ago",
    status: "New",
  },
  {
    id: "ZOM-8823",
    platform: "Zomato",
    customer: "Vikram Patel",
    items: ["Mutton Rogan Josh", "Paratha x3"],
    total: 720,
    timeAgo: "18 min ago",
    status: "Preparing",
  },
];

const INITIAL_MENU: MenuItem[] = [
  { id: 1, name: "Butter Chicken", price: 320, zomato: true, swiggy: true },
  { id: 2, name: "Paneer Tikka", price: 280, zomato: true, swiggy: false },
  { id: 3, name: "Chicken Biryani", price: 340, zomato: true, swiggy: true },
  { id: 4, name: "Dal Makhani", price: 220, zomato: false, swiggy: true },
  { id: 5, name: "Veg Thali", price: 199, zomato: true, swiggy: true },
  { id: 6, name: "Mutton Rogan Josh", price: 420, zomato: true, swiggy: false },
];

export default function ZomatoSwiggy() {
  const [orders, setOrders] = useState<DeliveryOrder[]>(INITIAL_ORDERS);
  const [menu, setMenu] = useState<MenuItem[]>(INITIAL_MENU);
  const [platformFilter, setPlatformFilter] = useState<"All" | Platform>("All");
  const [settings, setSettings] = useState({
    zomatoId: "",
    zomatoKey: "",
    swiggyId: "",
    swiggyKey: "",
  });
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState("");

  const filtered =
    platformFilter === "All"
      ? orders
      : orders.filter((o) => o.platform === platformFilter);

  function accept(id: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "Preparing" } : o)),
    );
    toast.success("Order accepted");
  }
  function reject(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    toast.error("Order rejected");
  }

  function startEditPrice(item: MenuItem) {
    setEditingPriceId(item.id);
    setEditingPrice(String(item.price));
  }

  function savePrice(itemId: number) {
    const newPrice = Number(editingPrice);
    if (!editingPrice || Number.isNaN(newPrice) || newPrice <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    setMenu((prev) =>
      prev.map((m) => (m.id === itemId ? { ...m, price: newPrice } : m)),
    );
    setEditingPriceId(null);
    toast.success("Price updated");
  }

  const platformStyle: Record<Platform, string> = {
    Zomato: "bg-red-500/20 text-red-400 border-red-500/30",
    Swiggy: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">
        Zomato &amp; Swiggy Integration
      </h1>
      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">Live Orders</TabsTrigger>
          <TabsTrigger value="sync">Menu Sync</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-4 mt-4">
          <div className="flex gap-2">
            {(["All", "Zomato", "Swiggy"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={platformFilter === f ? "default" : "outline"}
                onClick={() => setPlatformFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className={platformStyle[o.platform]}>
                      {o.platform}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {o.timeAgo}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{o.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.customer}
                    </p>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-0.5">
                    {o.items.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">₹{o.total}</span>
                    {o.status === "New" ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => accept(o.id)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => reject(o.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        className={
                          o.status === "Preparing"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400"
                        }
                      >
                        {o.status}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sync" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Menu Availability &amp; Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Zomato</TableHead>
                    <TableHead>Swiggy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {menu.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        {editingPriceId === item.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">₹</span>
                            <Input
                              className="w-24 h-7 text-sm"
                              type="number"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") savePrice(item.id);
                                if (e.key === "Escape") setEditingPriceId(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => savePrice(item.id)}
                              className="text-green-500 hover:text-green-400"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPriceId(null)}
                              className="text-red-500 hover:text-red-400"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>₹{item.price}</span>
                            <button
                              type="button"
                              onClick={() => startEditPrice(item)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Edit price"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.zomato}
                          onCheckedChange={(v) =>
                            setMenu((prev) =>
                              prev.map((m) =>
                                m.id === item.id ? { ...m, zomato: v } : m,
                              ),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.swiggy}
                          onCheckedChange={(v) =>
                            setMenu((prev) =>
                              prev.map((m) =>
                                m.id === item.id ? { ...m, swiggy: v } : m,
                              ),
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-400">Zomato Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Restaurant ID</Label>
                  <Input
                    placeholder="ZOM-XXXXXX"
                    value={settings.zomatoId}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, zomatoId: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={settings.zomatoKey}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, zomatoKey: e.target.value }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-orange-400">
                  Swiggy Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Restaurant ID</Label>
                  <Input
                    placeholder="SWG-XXXXXX"
                    value={settings.swiggyId}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, swiggyId: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={settings.swiggyKey}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, swiggyKey: e.target.value }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          <Button
            className="mt-4"
            onClick={() => toast.success("Settings saved successfully")}
          >
            Save Settings
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { ZomatoSwiggy };
