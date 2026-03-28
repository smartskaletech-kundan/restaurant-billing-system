import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useMemo } from "react";
import type { Bill } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";

type Filter = "all" | "settled" | "pending";

export function ReceiptRegister() {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const taxRate = useMemo(() => {
    const t = localStorage.getItem(`${restaurantId}_settings_taxRate`);
    return t ? Number(t) : 5;
  }, [restaurantId]);

  useEffect(() => {
    if (!actor || isFetching) return;
    setLoading(true);
    actor
      .getBillsByRestaurant(restaurantId)
      .then((b) => {
        setBills(b.sort((a, c) => Number(c.createdAt) - Number(a.createdAt)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [actor, isFetching, restaurantId]);

  const filtered = bills.filter((b) => {
    if (filter === "settled") return b.settled;
    if (filter === "pending") return !b.settled;
    return true;
  });

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="receipt.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-ocid="receipt.page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Receipt Register
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {bills.length} receipts total
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "settled", "pending"] as Filter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              data-ocid={`receipt.${f}.tab`}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <div
        className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        data-ocid="receipt.table"
      >
        {filtered.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="receipt.empty_state"
          >
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>No receipts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Receipt #",
                    "Table",
                    "Items",
                    "Subtotal",
                    `Tax (${taxRate}%)`,
                    "Discount",
                    "Total (₹)",
                    "Date",
                    "Status",
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
                {filtered.map((b, i) => (
                  <tr
                    key={b.id}
                    data-ocid={`receipt.item.${i + 1}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      #{Number(b.billNumber)}
                    </td>
                    <td className="px-4 py-3 text-foreground">{b.tableName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.items.length}
                    </td>
                    <td className="px-4 py-3">₹{b.subtotal.toFixed(2)}</td>
                    <td className="px-4 py-3">₹{b.taxAmount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      ₹{(b.discount ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      ₹{b.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(
                        Number(b.createdAt) / 1_000_000,
                      ).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={b.settled ? "default" : "secondary"}>
                        {b.settled ? "Settled" : "Pending"}
                      </Badge>
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
