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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, CreditCard, Gift, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CardStatus = "Active" | "Partially Used" | "Fully Redeemed" | "Expired";

interface GiftCard {
  id: number;
  code: string;
  recipient: string;
  phone: string;
  amount: number;
  balance: number;
  issued: string;
  expiry: string;
  status: CardStatus;
}

const INITIAL_CARDS: GiftCard[] = [
  {
    id: 1,
    code: "GC-A1B2-C3D4",
    recipient: "Pooja Verma",
    phone: "9812345678",
    amount: 1000,
    balance: 1000,
    issued: "2026-03-01",
    expiry: "2026-12-31",
    status: "Active",
  },
  {
    id: 2,
    code: "GC-E5F6-G7H8",
    recipient: "Suresh Nair",
    phone: "9876543210",
    amount: 500,
    balance: 200,
    issued: "2026-02-15",
    expiry: "2026-08-15",
    status: "Partially Used",
  },
  {
    id: 3,
    code: "GC-I9J0-K1L2",
    recipient: "Meena Joshi",
    phone: "9845671234",
    amount: 2000,
    balance: 0,
    issued: "2026-01-10",
    expiry: "2026-07-10",
    status: "Fully Redeemed",
  },
  {
    id: 4,
    code: "GC-M3N4-O5P6",
    recipient: "Arun Pillai",
    phone: "9901234567",
    amount: 750,
    balance: 750,
    issued: "2025-12-01",
    expiry: "2026-03-01",
    status: "Expired",
  },
  {
    id: 5,
    code: "GC-Q7R8-S9T0",
    recipient: "Lata Iyer",
    phone: "9765432109",
    amount: 1500,
    balance: 900,
    issued: "2026-03-20",
    expiry: "2026-09-20",
    status: "Partially Used",
  },
];

function generateCode(): string {
  const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GC-${seg()}-${seg()}`;
}

const statusColor: Record<CardStatus, string> = {
  Active: "bg-green-500/20 text-green-400",
  "Partially Used": "bg-yellow-500/20 text-yellow-400",
  "Fully Redeemed": "bg-gray-500/20 text-gray-400",
  Expired: "bg-red-500/20 text-red-400",
};

export default function GiftCards() {
  const [cards, setCards] = useState<GiftCard[]>(INITIAL_CARDS);
  const [issueOpen, setIssueOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCardId, setRedeemCardId] = useState<number | null>(null);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [newCard, setNewCard] = useState({
    recipient: "",
    phone: "",
    amount: "",
    expiry: "",
  });

  function issueCard() {
    if (!newCard.recipient || !newCard.amount || !newCard.expiry) {
      toast.error("Fill all fields");
      return;
    }
    const amt = Number(newCard.amount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setCards((prev) => [
      ...prev,
      {
        id: Date.now(),
        code: generateCode(),
        recipient: newCard.recipient,
        phone: newCard.phone,
        amount: amt,
        balance: amt,
        issued: new Date().toISOString().split("T")[0],
        expiry: newCard.expiry,
        status: "Active",
      },
    ]);
    toast.success("Gift card issued");
    setIssueOpen(false);
    setNewCard({ recipient: "", phone: "", amount: "", expiry: "" });
  }

  function redeemCard() {
    const amt = Number(redeemAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid redemption amount");
      return;
    }
    const card = cards.find((c) => c.id === redeemCardId);
    if (!card) {
      toast.error("Card not found");
      return;
    }
    if (amt > card.balance) {
      toast.error(
        `Cannot redeem ₹${amt} — only ₹${card.balance} remaining on card`,
      );
      return;
    }
    const newBalance = card.balance - amt;
    const newStatus: CardStatus =
      newBalance === 0 ? "Fully Redeemed" : "Partially Used";
    setCards((prev) =>
      prev.map((c) =>
        c.id === redeemCardId
          ? { ...c, balance: newBalance, status: newStatus }
          : c,
      ),
    );
    toast.success(`Redeemed ₹${amt} from card ${card.code}`);
    setRedeemOpen(false);
    setRedeemAmount("");
  }

  const totalIssued = cards.reduce((s, c) => s + c.amount, 0);
  const totalActive = cards.filter(
    (c) => c.status === "Active" || c.status === "Partially Used",
  ).length;
  const redeemedValue = cards.reduce((s, c) => s + (c.amount - c.balance), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Gift Cards</h1>
        <Button onClick={() => setIssueOpen(true)}>
          <Gift className="h-4 w-4 mr-2" /> Issue New Gift Card
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Cards Issued",
            value: cards.length,
            icon: CreditCard,
            color: "text-blue-400",
          },
          {
            label: "Active Cards",
            value: totalActive,
            icon: CheckCircle,
            color: "text-green-400",
          },
          {
            label: "Total Value Issued",
            value: `₹${totalIssued.toLocaleString()}`,
            icon: TrendingUp,
            color: "text-purple-400",
          },
          {
            label: "Redeemed Value",
            value: `₹${redeemedValue.toLocaleString()}`,
            icon: Gift,
            color: "text-orange-400",
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

      <Card>
        <CardHeader>
          <CardTitle>Gift Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card Code</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-medium">
                    {c.code}
                  </TableCell>
                  <TableCell>
                    {c.recipient}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {c.phone}
                    </span>
                  </TableCell>
                  <TableCell>₹{c.amount}</TableCell>
                  <TableCell className="font-semibold">₹{c.balance}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.issued}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.expiry}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor[c.status]}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {(c.status === "Active" ||
                        c.status === "Partially Used") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRedeemCardId(c.id);
                            setRedeemAmount("");
                            setRedeemOpen(true);
                          }}
                        >
                          Redeem
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Issue Dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue New Gift Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recipient Name</Label>
              <Input
                placeholder="Name"
                value={newCard.recipient}
                onChange={(e) =>
                  setNewCard((p) => ({ ...p, recipient: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Recipient Phone</Label>
              <Input
                placeholder="Phone"
                value={newCard.phone}
                onChange={(e) =>
                  setNewCard((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                placeholder="500"
                value={newCard.amount}
                onChange={(e) =>
                  setNewCard((p) => ({ ...p, amount: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={newCard.expiry}
                onChange={(e) =>
                  setNewCard((p) => ({ ...p, expiry: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button onClick={issueCard}>Issue Card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>Redeem Gift Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {redeemCardId !== null &&
              (() => {
                const c = cards.find((x) => x.id === redeemCardId);
                return c ? (
                  <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                    <p className="font-mono font-medium">{c.code}</p>
                    <p className="text-muted-foreground">
                      Recipient:{" "}
                      <strong className="text-foreground">{c.recipient}</strong>
                    </p>
                    <p className="text-muted-foreground">
                      Balance:{" "}
                      <strong className="text-green-400">₹{c.balance}</strong>
                    </p>
                  </div>
                ) : null;
              })()}
            <div>
              <Label>Redemption Amount (₹)</Label>
              <Input
                type="number"
                min="1"
                placeholder="0"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
              />
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
            <Button onClick={redeemCard}>Redeem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { GiftCards };
