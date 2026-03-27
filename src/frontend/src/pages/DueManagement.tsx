import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Bill } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";

export function DueManagement() {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  useEffect(() => {
    if (!actor || isFetching) return;
    setLoading(true);
    actor
      .getBillsByRestaurant(restaurantId)
      .then((b) => {
        setBills(
          b
            .filter((bill) => !bill.settled)
            .sort((a, c) => Number(c.createdAt) - Number(a.createdAt)),
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [actor, isFetching, restaurantId]);

  const totalDue = bills.reduce((s, b) => s + b.total, 0);

  async function markSettled(billId: string) {
    if (!actor) return;
    setSettlingId(billId);
    try {
      // Attempt backend call via unknown cast (markBillSettled may exist at runtime)
      // biome-ignore lint/suspicious/noExplicitAny: runtime feature detection
      const fn = (actor as unknown as Record<string, unknown>).markBillSettled;
      if (typeof fn === "function") {
        await (fn as (id: string) => Promise<unknown>).call(actor, billId);
      }
      setBills((prev) => prev.filter((b) => b.id !== billId));
      toast.success("Marked as settled");
    } catch {
      toast.error("Failed to update. Please try again.");
    } finally {
      setSettlingId(null);
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="due.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-ocid="due.page">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Due Management</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {bills.length} outstanding bills
        </p>
      </div>

      <Card data-ocid="due.summary.card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Outstanding Amount
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-destructive">
            ₹{totalDue.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <div
        className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        data-ocid="due.table"
      >
        {bills.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="due.empty_state"
          >
            <AlertCircle className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>No outstanding dues. All bills are settled! 🎉</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Bill #",
                    "Table",
                    "Total Due (₹)",
                    "Date",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-muted-foreground font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bills.map((b, i) => (
                  <tr
                    key={b.id}
                    data-ocid={`due.item.${i + 1}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      #{Number(b.billNumber)}
                    </td>
                    <td className="px-4 py-3 text-foreground">{b.tableName}</td>
                    <td className="px-4 py-3 font-semibold text-destructive">
                      ₹{b.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(
                        Number(b.createdAt) / 1_000_000,
                      ).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive">Pending</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        data-ocid={`due.settle_button.${i + 1}`}
                        size="sm"
                        disabled={settlingId === b.id}
                        onClick={() => markSettled(b.id)}
                      >
                        {settlingId === b.id ? "Settling..." : "Mark Settled"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
