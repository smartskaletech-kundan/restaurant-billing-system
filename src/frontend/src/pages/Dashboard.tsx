import { useEffect, useState } from "react";
import type { Page } from "../App";
import type { Bill, Order, Table } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";

interface Props {
  navigateTo: (page: Page) => void;
}

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

function formatTime(createdAt: bigint) {
  const ms = Number(createdAt) / 1_000_000;
  return new Date(ms).toLocaleString();
}

function isToday(createdAt: bigint) {
  const ms = Number(createdAt) / 1_000_000;
  const d = new Date(ms);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function Dashboard({ navigateTo }: Props) {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const [bills, setBills] = useState<Bill[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!actor || isFetching) return;
    setLoading(true);
    Promise.all([
      actor.getBillsByRestaurant(restaurantId) as Promise<Bill[]>,
      actor.getOrders(),
      actor.getTables(),
    ])
      .then(([b, o, t]) => {
        setBills(b);
        setOrders(o);
        setTables(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [actor, isFetching, restaurantId]);

  const todayBills = bills.filter((b) => isToday(b.createdAt));
  const todaySales = todayBills.reduce((sum, b) => sum + b.total, 0);
  const todayOrders = orders.filter((o) => isToday(o.createdAt)).length;
  const occupiedTables = tables.filter((t) => t.status === "occupied").length;
  const availableTables = tables.filter((t) => t.status === "available").length;
  const recentBills = [...bills]
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, 10);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="dashboard.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="dashboard.page">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of today&apos;s restaurant activity
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <p className="text-muted-foreground text-sm">Today&apos;s Sales</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {formatCurrency(todaySales)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {todayBills.length} bills generated
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <p className="text-muted-foreground text-sm">Orders Today</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {todayOrders}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total orders placed
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <p className="text-muted-foreground text-sm">Occupied Tables</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {occupiedTables}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Currently serving
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <p className="text-muted-foreground text-sm">Available Tables</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {availableTables}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Ready to seat</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          data-ocid="dashboard.tables.button"
          onClick={() => navigateTo("tables")}
          className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 hover:shadow-card transition-all"
        >
          <span className="text-2xl">⬛</span>
          <p className="font-medium text-sm mt-2 text-foreground">
            Manage Tables
          </p>
        </button>
        <button
          type="button"
          data-ocid="dashboard.orders.button"
          onClick={() => navigateTo("orders")}
          className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 hover:shadow-card transition-all"
        >
          <span className="text-2xl">📋</span>
          <p className="font-medium text-sm mt-2 text-foreground">Take Order</p>
        </button>
        <button
          type="button"
          data-ocid="dashboard.kitchen.button"
          onClick={() => navigateTo("kitchen")}
          className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 hover:shadow-card transition-all"
        >
          <span className="text-2xl">🍳</span>
          <p className="font-medium text-sm mt-2 text-foreground">
            Kitchen Display
          </p>
        </button>
        <button
          type="button"
          data-ocid="dashboard.billing.button"
          onClick={() => navigateTo("billing")}
          className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/50 hover:shadow-card transition-all"
        >
          <span className="text-2xl">💰</span>
          <p className="font-medium text-sm mt-2 text-foreground">
            Generate Bill
          </p>
        </button>
      </div>

      {/* Recent Bills */}
      <div
        className="bg-card border border-border rounded-xl shadow-card"
        data-ocid="dashboard.table"
      >
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Recent Bills</h3>
        </div>
        {recentBills.length === 0 ? (
          <div
            className="text-center py-12 text-muted-foreground"
            data-ocid="dashboard.empty_state"
          >
            <p className="text-4xl mb-2">📄</p>
            <p>No bills generated yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Bill #
                  </th>
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Table
                  </th>
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Items
                  </th>
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Total
                  </th>
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Time
                  </th>
                  <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentBills.map((bill, i) => (
                  <tr
                    key={bill.id}
                    className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    data-ocid={`dashboard.item.${i + 1}`}
                  >
                    <td className="px-5 py-3 font-medium text-foreground">
                      #{Number(bill.billNumber)}
                    </td>
                    <td className="px-5 py-3 text-foreground">
                      {bill.tableName}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {bill.items.length} items
                    </td>
                    <td className="px-5 py-3 font-semibold text-foreground">
                      {formatCurrency(bill.total)}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatTime(bill.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          bill.settled ? "status-ready" : "status-pending"
                        }`}
                      >
                        {bill.settled ? "Settled" : "Unsettled"}
                      </span>
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
