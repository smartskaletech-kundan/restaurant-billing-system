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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Page, SelectedTable } from "../App";
import type { Table as BackendTable, Order } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";

interface Props {
  navigateTo: (page: Page, table?: SelectedTable) => void;
  selectedTable: SelectedTable | null;
  setSelectedTable: (t: SelectedTable | null) => void;
}

export interface Waiter {
  id: number;
  name: string;
  phone: string;
  assignedTable: string;
}

function getWaitersKey(restaurantId?: string): string {
  return restaurantId
    ? `${restaurantId}_restaurant_waiters`
    : "restaurant_waiters";
}

export function loadWaitersFromStorage(restaurantId?: string): Waiter[] {
  try {
    const stored = localStorage.getItem(getWaitersKey(restaurantId));
    if (stored) return JSON.parse(stored) as Waiter[];
  } catch {
    // ignore
  }
  return [
    {
      id: 1,
      name: "Sunil Kumar",
      phone: "9812340001",
      assignedTable: "Table 1, Table 2",
    },
    {
      id: 2,
      name: "Priti Sharma",
      phone: "9876540002",
      assignedTable: "Table 3",
    },
    {
      id: 3,
      name: "Mohit Verma",
      phone: "9845670003",
      assignedTable: "Table 4, Table 5",
    },
  ];
}

function saveWaitersToStorage(waiters: Waiter[], restaurantId?: string) {
  try {
    localStorage.setItem(getWaitersKey(restaurantId), JSON.stringify(waiters));
  } catch {
    // ignore
  }
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    occupied: "bg-red-100 text-red-700",
    ordered: "bg-amber-100 text-amber-700",
    reserved: "bg-blue-100 text-blue-700",
    active: "bg-orange-100 text-orange-700",
    kotSent: "bg-purple-100 text-purple-700",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
        colorMap[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

export function TableManagement({ navigateTo, setSelectedTable }: Props) {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const [tables, setTables] = useState<BackendTable[]>([]);
  const [ordersMap, setOrdersMap] = useState<Record<string, Order>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<BackendTable | null>(null);
  const [selectedCardOrder, setSelectedCardOrder] = useState<Order | null>(
    null,
  );
  const [showTableModal, setShowTableModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSeats, setAddSeats] = useState("4");
  const [saving, setSaving] = useState(false);

  // Waiters state — persisted to localStorage
  const [waiters, setWaiters] = useState<Waiter[]>(() =>
    loadWaitersFromStorage(restaurantId),
  );
  const [showWaiterDialog, setShowWaiterDialog] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<Waiter | null>(null);
  const [waiterForm, setWaiterForm] = useState({
    name: "",
    phone: "",
    assignedTable: "",
  });

  // Persist waiters to localStorage on every change
  useEffect(() => {
    saveWaitersToStorage(waiters, restaurantId);
  }, [waiters, restaurantId]);

  const load = useCallback(async () => {
    if (!actor) return;
    setLoading(true);
    try {
      const [t, allOrders] = await Promise.all([
        actor.getTables(),
        actor.getOrders(),
      ]);
      setTables(t);
      // Build a map tableId -> active order
      const map: Record<string, Order> = {};
      for (const o of allOrders) {
        if (o.status !== "billed" && o.status !== "closed") {
          map[o.tableId] = o;
        }
      }
      setOrdersMap(map);
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    if (!actor || isFetching) return;
    load();
  }, [actor, isFetching, load]);

  const isOccupied = (table: BackendTable) =>
    table.status === "occupied" ||
    table.status === "ordered" ||
    table.status === "active" ||
    table.status === "kotSent";

  const handleCardClick = (table: BackendTable) => {
    setSelectedCard(table);
    setSelectedCardOrder(ordersMap[table.id] ?? null);
    setShowTableModal(true);
  };

  const handleStatusChange = async (status: string) => {
    if (!actor || !selectedCard) return;
    setSaving(true);
    try {
      await actor.updateTableStatus(selectedCard.id, status);
      setShowTableModal(false);
      toast.success(`Table ${selectedCard.name} marked as ${status}`);
      await load();
    } catch {
      toast.error("Failed to update table status");
    } finally {
      setSaving(false);
    }
  };

  const handleStartOrder = async () => {
    if (!actor || !selectedCard) return;
    setSaving(true);
    try {
      await actor.updateTableStatus(selectedCard.id, "occupied");
      setSelectedTable({ id: selectedCard.id, name: selectedCard.name });
      setShowTableModal(false);
      navigateTo("orders", { id: selectedCard.id, name: selectedCard.name });
    } catch {
      toast.error("Failed to start order");
    } finally {
      setSaving(false);
    }
  };

  const handleAddKOT = () => {
    if (!selectedCard) return;
    setSelectedTable({ id: selectedCard.id, name: selectedCard.name });
    setShowTableModal(false);
    navigateTo("orders", { id: selectedCard.id, name: selectedCard.name });
  };

  const handleGenerateBill = () => {
    if (!selectedCard) return;
    setSelectedTable({ id: selectedCard.id, name: selectedCard.name });
    setShowTableModal(false);
    navigateTo("billing", { id: selectedCard.id, name: selectedCard.name });
  };

  const handleDeleteTable = async (
    table: BackendTable,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!actor) return;
    if (!confirm(`Delete ${table.name}?`)) return;
    try {
      await actor.deleteTable(table.id);
      toast.success("Table deleted");
      await load();
    } catch {
      toast.error("Failed to delete table");
    }
  };

  const handleAddTable = async () => {
    if (!actor || !addName.trim()) return;
    setSaving(true);
    try {
      await actor.addTable(
        addName.trim(),
        BigInt(Number.parseInt(addSeats) || 4),
      );
      toast.success(`Table ${addName} added`);
      setShowAddModal(false);
      setAddName("");
      setAddSeats("4");
      await load();
    } catch {
      toast.error("Failed to add table");
    } finally {
      setSaving(false);
    }
  };

  function openAddWaiter() {
    setEditingWaiter(null);
    setWaiterForm({ name: "", phone: "", assignedTable: "" });
    setShowWaiterDialog(true);
  }

  function openEditWaiter(w: Waiter) {
    setEditingWaiter(w);
    setWaiterForm({
      name: w.name,
      phone: w.phone,
      assignedTable: w.assignedTable,
    });
    setShowWaiterDialog(true);
  }

  function saveWaiter() {
    if (!waiterForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (editingWaiter) {
      setWaiters((prev) =>
        prev.map((w) =>
          w.id === editingWaiter.id ? { ...w, ...waiterForm } : w,
        ),
      );
      toast.success("Waiter updated");
    } else {
      setWaiters((prev) => [...prev, { id: Date.now(), ...waiterForm }]);
      toast.success("Waiter added");
    }
    setShowWaiterDialog(false);
  }

  function deleteWaiter(id: number) {
    if (!confirm("Delete this waiter?")) return;
    setWaiters((prev) => prev.filter((w) => w.id !== id));
    toast.success("Waiter deleted");
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="tables.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const occupiedCount = tables.filter(isOccupied).length;
  const availableCount = tables.filter((t) => t.status === "available").length;

  return (
    <div className="space-y-6" data-ocid="tables.page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Table Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage tables and waiters
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-center">
            <p className="text-xs text-red-500 font-medium">RUNNING</p>
            <p className="text-lg font-bold text-red-600">{occupiedCount}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-center">
            <p className="text-xs text-green-600 font-medium">AVAILABLE</p>
            <p className="text-lg font-bold text-green-700">{availableCount}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tables">
        <TabsList>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="waiters">Waiters</TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm">
              {tables.length} tables total
            </p>
            <Button
              data-ocid="tables.add_button"
              onClick={() => setShowAddModal(true)}
            >
              + Add Table
            </Button>
          </div>

          {tables.length === 0 ? (
            <div
              className="bg-card border border-border rounded-xl text-center py-16"
              data-ocid="tables.empty_state"
            >
              <p className="text-4xl mb-3">⬛</p>
              <p className="text-muted-foreground">No tables added yet</p>
              <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                Add Your First Table
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tables.map((table, i) => {
                const activeOrder = ordersMap[table.id];
                const occupied = isOccupied(table);
                return (
                  <div
                    key={table.id}
                    data-ocid={`tables.item.${i + 1}`}
                    onClick={() => handleCardClick(table)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCardClick(table)
                    }
                    className={`bg-card border-2 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all relative group ${
                      occupied
                        ? "border-red-400 bg-red-50/40"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <button
                      type="button"
                      data-ocid={`tables.delete_button.${i + 1}`}
                      onClick={(e) => handleDeleteTable(table, e)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded p-1 transition-all text-xs"
                    >
                      ✕
                    </button>

                    <div className="flex items-start justify-between mb-2">
                      <p className="font-bold text-foreground text-base">
                        {table.name}
                      </p>
                    </div>

                    <StatusBadge status={table.status} />

                    <p className="text-muted-foreground text-xs mt-2">
                      {Number(table.seats)} seats
                    </p>

                    {/* Running order info on occupied tables */}
                    {occupied && activeOrder ? (
                      <div className="mt-3 pt-3 border-t border-red-200 space-y-1">
                        <p className="text-xs font-semibold text-red-700">
                          🛒 {activeOrder.items.length} item
                          {activeOrder.items.length !== 1 ? "s" : ""} in order
                        </p>
                        <div className="space-y-0.5 max-h-16 overflow-hidden">
                          {activeOrder.items.slice(0, 3).map((item) => (
                            <p
                              key={item.menuItemId}
                              className="text-xs text-muted-foreground truncate"
                            >
                              {item.name} ×{Number(item.quantity)}
                            </p>
                          ))}
                          {activeOrder.items.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{activeOrder.items.length - 3} more...
                            </p>
                          )}
                        </div>
                        <p className="text-xs font-bold text-red-600">
                          ₹
                          {activeOrder.items
                            .reduce(
                              (s, i) => s + i.price * Number(i.quantity),
                              0,
                            )
                            .toFixed(2)}
                        </p>
                        <div className="flex gap-1 mt-2">
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                            KOT
                          </span>
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                            BILL
                          </span>
                        </div>
                      </div>
                    ) : occupied ? (
                      <p className="text-xs text-amber-600 mt-2">
                        Loading order...
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="waiters" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {waiters.length} waiters registered
            </p>
            <Button data-ocid="waiters.add_button" onClick={openAddWaiter}>
              + Add Waiter
            </Button>
          </div>

          {waiters.length === 0 ? (
            <div
              className="bg-card border border-border rounded-xl text-center py-16"
              data-ocid="waiters.empty_state"
            >
              <p className="text-4xl mb-3">🧑‍🍽️</p>
              <p className="text-muted-foreground">No waiters added yet</p>
              <Button className="mt-4" onClick={openAddWaiter}>
                Add First Waiter
              </Button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Assigned Tables</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waiters.map((w, i) => (
                    <TableRow key={w.id} data-ocid={`waiters.item.${i + 1}`}>
                      <TableCell className="text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {w.phone}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {w.assignedTable || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            data-ocid={`waiters.edit_button.${i + 1}`}
                            onClick={() => openEditWaiter(w)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            data-ocid={`waiters.delete_button.${i + 1}`}
                            onClick={() => deleteWaiter(w.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Table Action Modal */}
      <Dialog open={showTableModal} onOpenChange={setShowTableModal}>
        <DialogContent data-ocid="tables.dialog">
          <DialogHeader>
            <DialogTitle>{selectedCard?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-muted-foreground text-sm mb-4">
              {Number(selectedCard?.seats)} seats · Current status:{" "}
              <strong>{selectedCard?.status}</strong>
            </p>

            {/* Running order summary in modal */}
            {selectedCard && isOccupied(selectedCard) && selectedCardOrder && (
              <div className="bg-muted/40 border border-border rounded-lg p-3 mb-4 text-sm space-y-1">
                <p className="font-semibold text-foreground">
                  📋 Running Order
                </p>
                <div className="space-y-0.5 mt-1">
                  {selectedCardOrder.items.map((item) => (
                    <div
                      key={item.menuItemId}
                      className="flex justify-between text-xs"
                    >
                      <span className="text-foreground">
                        {item.name} ×{Number(item.quantity)}
                      </span>
                      <span className="text-muted-foreground">
                        ₹{(item.price * Number(item.quantity)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border mt-2 pt-2 flex justify-between font-semibold text-sm">
                  <span>Total</span>
                  <span className="text-primary">
                    ₹
                    {selectedCardOrder.items
                      .reduce((s, i) => s + i.price * Number(i.quantity), 0)
                      .toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Order #{selectedCardOrder.id.slice(-6)} ·{" "}
                  {selectedCardOrder.status}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              {selectedCard && isOccupied(selectedCard) ? (
                <>
                  <Button
                    data-ocid="tables.add_kot.button"
                    onClick={handleAddKOT}
                    disabled={saving}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    🍳 Add / View KOT
                  </Button>
                  <Button
                    data-ocid="tables.generate_bill.button"
                    onClick={handleGenerateBill}
                    disabled={saving}
                    className="w-full"
                  >
                    💰 Generate Bill
                  </Button>
                  <Button
                    data-ocid="tables.mark_available.button"
                    variant="outline"
                    onClick={() => handleStatusChange("available")}
                    disabled={saving}
                    className="w-full"
                  >
                    ✅ Mark Available
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    data-ocid="tables.start_order.button"
                    onClick={handleStartOrder}
                    disabled={saving}
                    className="w-full"
                  >
                    🛒 Start Order
                  </Button>
                  <Button
                    data-ocid="tables.mark_reserved.button"
                    variant="outline"
                    onClick={() => handleStatusChange("reserved")}
                    disabled={saving}
                    className="w-full"
                  >
                    📌 Mark Reserved
                  </Button>
                  <Button
                    data-ocid="tables.mark_available.button"
                    variant="outline"
                    onClick={() => handleStatusChange("available")}
                    disabled={saving}
                    className="w-full"
                  >
                    ✅ Mark Available
                  </Button>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="tables.close_button"
              variant="ghost"
              onClick={() => setShowTableModal(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Table Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent
          className="sm:max-w-md"
          data-ocid="tables.add_table.dialog"
        >
          <DialogHeader>
            <DialogTitle>Add New Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Table Name</Label>
              <Input
                data-ocid="tables.name.input"
                className="h-9"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Table 1, VIP Room"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Seats</Label>
              <Input
                data-ocid="tables.seats.input"
                className="h-9"
                type="number"
                value={addSeats}
                onChange={(e) => setAddSeats(e.target.value)}
                min="1"
                max="20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="tables.cancel_button"
              variant="ghost"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="tables.submit_button"
              onClick={handleAddTable}
              disabled={saving || !addName.trim()}
            >
              {saving ? "Adding..." : "Add Table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Waiter Dialog */}
      <Dialog open={showWaiterDialog} onOpenChange={setShowWaiterDialog}>
        <DialogContent className="sm:max-w-md" data-ocid="waiters.dialog">
          <DialogHeader>
            <DialogTitle>
              {editingWaiter ? "Edit Waiter" : "Add New Waiter"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                data-ocid="waiters.name.input"
                className="h-9"
                placeholder="Full name"
                value={waiterForm.name}
                onChange={(e) =>
                  setWaiterForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                data-ocid="waiters.phone.input"
                className="h-9"
                placeholder="Phone number"
                value={waiterForm.phone}
                onChange={(e) =>
                  setWaiterForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned Tables</Label>
              <Input
                data-ocid="waiters.table.input"
                className="h-9"
                placeholder="e.g. Table 1, Table 2"
                value={waiterForm.assignedTable}
                onChange={(e) =>
                  setWaiterForm((p) => ({
                    ...p,
                    assignedTable: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="waiters.cancel_button"
              variant="ghost"
              onClick={() => setShowWaiterDialog(false)}
            >
              Cancel
            </Button>
            <Button data-ocid="waiters.submit_button" onClick={saveWaiter}>
              {editingWaiter ? "Save Changes" : "Add Waiter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
