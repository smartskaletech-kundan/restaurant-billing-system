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
import { Gift, Megaphone, Star, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Customer {
  id: number;
  name: string;
  phone: string;
  visits: number;
  points: number;
  lastVisit: string;
}

interface Campaign {
  id: number;
  name: string;
  description: string;
  offer: string;
  status: "Active" | "Scheduled" | "Ended";
}

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 1,
    name: "Anita Gupta",
    phone: "9876543210",
    visits: 28,
    points: 2450,
    lastVisit: "2026-03-26",
  },
  {
    id: 2,
    name: "Rajesh Kumar",
    phone: "9812345678",
    visits: 15,
    points: 1200,
    lastVisit: "2026-03-24",
  },
  {
    id: 3,
    name: "Sunita Sharma",
    phone: "9845671234",
    visits: 7,
    points: 380,
    lastVisit: "2026-03-20",
  },
  {
    id: 4,
    name: "Mohan Das",
    phone: "9901234567",
    visits: 42,
    points: 4100,
    lastVisit: "2026-03-27",
  },
  {
    id: 5,
    name: "Kavita Patel",
    phone: "9765432109",
    visits: 3,
    points: 110,
    lastVisit: "2026-03-15",
  },
];

const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 1,
    name: "Birthday Bonus",
    description: "2x points on birthday month",
    offer: "200% Points",
    status: "Active",
  },
  {
    id: 2,
    name: "Double Points Weekend",
    description: "Earn 2x on Sat & Sun",
    offer: "2x Points Sat-Sun",
    status: "Scheduled",
  },
  {
    id: 3,
    name: "New Member Welcome",
    description: "100 bonus points on first visit",
    offer: "100 Bonus Points",
    status: "Active",
  },
];

function getTier(points: number): { label: string; color: string } {
  if (points >= 2000)
    return { label: "Gold", color: "bg-yellow-500/20 text-yellow-400" };
  if (points >= 500)
    return { label: "Silver", color: "bg-gray-400/20 text-gray-300" };
  return { label: "Bronze", color: "bg-orange-800/30 text-orange-400" };
}

export default function LoyaltyCRM() {
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCustomerId, setRedeemCustomerId] = useState<number | null>(null);
  const [redeemAmount, setRedeemAmount] = useState("");

  const pointsEarned =
    billAmount && !Number.isNaN(Number(billAmount))
      ? Math.floor(Number(billAmount) / 10)
      : 0;

  function addPoints() {
    if (!selectedCustomerId || !billAmount) {
      toast.error("Select customer and enter bill amount");
      return;
    }
    const amt = Number(billAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid bill amount");
      return;
    }
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === Number(selectedCustomerId)
          ? {
              ...c,
              points: c.points + pointsEarned,
              visits: c.visits + 1,
              lastVisit: new Date().toISOString().split("T")[0],
            }
          : c,
      ),
    );
    toast.success(`Added ${pointsEarned} points`);
    setBillAmount("");
  }

  function redeemPoints() {
    const amt = Number(redeemAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid redemption amount");
      return;
    }
    const customer = customers.find((c) => c.id === redeemCustomerId);
    if (!customer) {
      toast.error("Customer not found");
      return;
    }
    if (amt > customer.points) {
      toast.error(
        `Cannot redeem ₹${amt} — only ₹${customer.points} points available`,
      );
      return;
    }
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === redeemCustomerId ? { ...c, points: c.points - amt } : c,
      ),
    );
    toast.success(`Redeemed ₹${amt} worth of points for ${customer.name}`);
    setRedeemOpen(false);
    setRedeemAmount("");
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Loyalty &amp; CRM</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Members",
            value: customers.length,
            icon: Users,
            color: "text-blue-400",
          },
          {
            label: "Points Issued Today",
            value: "340",
            icon: Star,
            color: "text-yellow-400",
          },
          {
            label: "Redemptions This Month",
            value: "₹4,200",
            icon: Gift,
            color: "text-pink-400",
          },
          {
            label: "Active Campaigns",
            value: campaigns.filter((c) => c.status === "Active").length,
            icon: Megaphone,
            color: "text-green-400",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="w-48">
                  <Label>Customer</Label>
                  <Select
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Bill Amount (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    className="w-32"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <Label>Points Earned</Label>
                  <Input
                    readOnly
                    className="w-24 bg-muted"
                    value={pointsEarned}
                  />
                </div>
                <Button onClick={addPoints}>Add Points</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Visits</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => {
                    const tier = getTier(c.points);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.phone}
                        </TableCell>
                        <TableCell>{c.visits}</TableCell>
                        <TableCell className="font-semibold">
                          {c.points.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={tier.color}>{tier.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.lastVisit}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRedeemCustomerId(c.id);
                              setRedeemAmount("");
                              setRedeemOpen(true);
                            }}
                          >
                            Redeem
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4 space-y-4">
          {campaigns.map((camp) => (
            <Card key={camp.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{camp.name}</h3>
                    <Badge
                      className={
                        camp.status === "Active"
                          ? "bg-green-500/20 text-green-400"
                          : camp.status === "Scheduled"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-gray-500/20 text-gray-400"
                      }
                    >
                      {camp.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {camp.description}
                  </p>
                  <p className="text-sm font-medium mt-1 text-yellow-400">
                    {camp.offer}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCampaigns((prev) =>
                      prev.map((c) =>
                        c.id === camp.id
                          ? {
                              ...c,
                              status:
                                c.status === "Active" ? "Ended" : "Active",
                            }
                          : c,
                      ),
                    )
                  }
                >
                  {camp.status === "Active" ? "Pause" : "Activate"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Redeem Dialog */}
      <Dialog
        open={redeemOpen}
        onOpenChange={(open) => {
          setRedeemOpen(open);
          if (!open) setRedeemAmount("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem Points</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {redeemCustomerId !== null &&
              (() => {
                const c = customers.find((x) => x.id === redeemCustomerId);
                return c ? (
                  <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-muted-foreground">
                      Available Points:{" "}
                      <strong className="text-foreground">
                        {c.points.toLocaleString()}
                      </strong>{" "}
                      (₹{c.points} value)
                    </p>
                  </div>
                ) : null;
              })()}
            <div>
              <Label>Amount to Redeem (₹)</Label>
              <Input
                type="number"
                placeholder="0"
                min="1"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                1 point = ₹1 value
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRedeemOpen(false);
                setRedeemAmount("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={redeemPoints}>Redeem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { LoyaltyCRM };
