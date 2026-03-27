import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { XLSX } from "../lib/xlsx-shim";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  costPrice: number;
  updatedAt: number;
}

const STORAGE_KEY = "smartskale_inventory";
const UNITS = ["kg", "L", "pcs", "box"];

function load(): InventoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(list: InventoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const EMPTY_FORM = {
  name: "",
  category: "",
  quantity: "",
  unit: "pcs",
  reorderLevel: "",
  costPrice: "",
};

export function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(load());
  }, []);

  const filtered = items.filter(
    (it) =>
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.category.toLowerCase().includes(search.toLowerCase()),
  );

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(it: InventoryItem) {
    setEditTarget(it);
    setForm({
      name: it.name,
      category: it.category,
      quantity: it.quantity.toString(),
      unit: it.unit,
      reorderLevel: it.reorderLevel.toString(),
      costPrice: it.costPrice.toString(),
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: form.name,
      category: form.category,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      reorderLevel: Number(form.reorderLevel) || 0,
      costPrice: Number(form.costPrice) || 0,
      updatedAt: Date.now(),
    };
    if (editTarget) {
      const updated = items.map((it) =>
        it.id === editTarget.id ? { ...it, ...payload } : it,
      );
      setItems(updated);
      save(updated);
      toast.success("Item updated");
    } else {
      const newIt: InventoryItem = { id: Date.now().toString(), ...payload };
      const updated = [...items, newIt];
      setItems(updated);
      save(updated);
      toast.success("Item added");
    }
    setDialogOpen(false);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const updated = items.filter((it) => it.id !== deleteTarget.id);
    setItems(updated);
    save(updated);
    setDeleteTarget(null);
    toast.success("Item deleted");
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "category", "quantity", "unit", "reorderLevel", "costPrice"],
      ["Tomatoes", "Vegetables", 50, "kg", 10, 30],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "inventory_import_template.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {
      defval: "",
    });
    if (rows.length === 0) {
      toast.error("Excel file is empty or has no data rows");
      return;
    }
    let count = 0;
    const existing = load();
    for (const row of rows) {
      const name = (row.name || "").toString().trim();
      if (!name) continue;
      existing.push({
        id: `${Date.now()}_${count}`,
        name,
        category: (row.category || "").toString().trim(),
        quantity: Number(row.quantity) || 0,
        unit: (row.unit || "pcs").toString().trim(),
        reorderLevel: Number(row.reorderLevel) || 0,
        costPrice: Number(row.costPrice) || 0,
        updatedAt: Date.now(),
      });
      count++;
    }
    setItems(existing);
    save(existing);
    toast.success(`Imported ${count} items successfully`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-5" data-ocid="inventory.page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Inventory</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} items ·{" "}
            {items.filter((it) => it.quantity <= it.reorderLevel).length} low
            stock
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            data-ocid="inventory.search_input"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            data-ocid="inventory.template_button"
          >
            ↓ Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            data-ocid="inventory.import_button"
          >
            ↑ Import Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
          <Button data-ocid="inventory.add_button" onClick={openAdd}>
            + Add Item
          </Button>
        </div>
      </div>

      <div
        className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        data-ocid="inventory.table"
      >
        {filtered.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="inventory.empty_state"
          >
            <Package className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>
              {search
                ? "No items match your search"
                : "No inventory items yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Name",
                    "Category",
                    "Quantity",
                    "Reorder Level",
                    "Cost Price",
                    "Updated",
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
                {filtered.map((it, i) => (
                  <tr
                    key={it.id}
                    data-ocid={`inventory.item.${i + 1}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {it.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {it.category || "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {it.reorderLevel} {it.unit}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      ₹{it.costPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(it.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {it.quantity <= it.reorderLevel ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          data-ocid={`inventory.edit_button.${i + 1}`}
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(it)}
                        >
                          Edit
                        </Button>
                        <Button
                          data-ocid={`inventory.delete_button.${i + 1}`}
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(it)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl" data-ocid="inventory.dialog">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Item" : "Add Inventory Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="inv-name">Name</Label>
              <Input
                id="inv-name"
                className="h-9"
                data-ocid="inventory.name_input"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Item name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-cat">Category</Label>
              <Input
                id="inv-cat"
                className="h-9"
                data-ocid="inventory.category_input"
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value }))
                }
                placeholder="e.g. Vegetables"
              />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Select
                value={form.unit}
                onValueChange={(v) => setForm((p) => ({ ...p, unit: v }))}
              >
                <SelectTrigger
                  className="h-9"
                  data-ocid="inventory.unit_select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-qty">Quantity</Label>
              <Input
                id="inv-qty"
                className="h-9"
                data-ocid="inventory.quantity_input"
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, quantity: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-reorder">Reorder Level</Label>
              <Input
                id="inv-reorder"
                className="h-9"
                data-ocid="inventory.reorder_input"
                type="number"
                min="0"
                value={form.reorderLevel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, reorderLevel: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="inv-price">Cost Price (₹)</Label>
              <Input
                id="inv-price"
                className="h-9"
                data-ocid="inventory.cost_price_input"
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(e) =>
                  setForm((p) => ({ ...p, costPrice: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-ocid="inventory.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} data-ocid="inventory.save_button">
              {editTarget ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent data-ocid="inventory.delete.dialog">
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              data-ocid="inventory.delete.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              data-ocid="inventory.delete.confirm_button"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
