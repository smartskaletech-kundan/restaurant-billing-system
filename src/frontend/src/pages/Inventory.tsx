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
import { Package, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRestaurant } from "../context/RestaurantContext";
import { getXLSX } from "../lib/xlsx-shim";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  costPrice: number;
  updatedAt: number;
  hsn: string;
  tax: string;
}

const DEFAULT_CATEGORIES = [
  "Vegetables",
  "Dairy",
  "Beverages",
  "Dry Goods",
  "Other",
];
const UNITS = ["kg", "L", "pcs", "box"];
const GST_SLABS = ["0", "5", "12", "18", "28"];

function load(key: string): InventoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function save(key: string, list: InventoryItem[]) {
  localStorage.setItem(key, JSON.stringify(list));
}

function loadCategories(key: string): string[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  localStorage.setItem(key, JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

function saveCategories(key: string, cats: string[]) {
  localStorage.setItem(key, JSON.stringify(cats));
}

const EMPTY_FORM = {
  name: "",
  category: "",
  quantity: "",
  unit: "pcs",
  reorderLevel: "",
  costPrice: "",
  hsn: "",
  tax: "5",
};

export function Inventory() {
  const { restaurantId } = useRestaurant();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>(() =>
    loadCategories(`${restaurantId}_inventory_categories`),
  );
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category management state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null);
  const [editingCatValue, setEditingCatValue] = useState("");

  useEffect(() => {
    setItems(load(`${restaurantId}_inventory`));
  }, [restaurantId]);

  const updateCategories = (cats: string[]) => {
    setCategories(cats);
    saveCategories(`${restaurantId}_inventory_categories`, cats);
  };

  const handleAddCategory = () => {
    const name = newCatName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    if (categories.includes(name)) {
      toast.error("Category already exists");
      return;
    }
    updateCategories([...categories, name]);
    setNewCatName("");
    toast.success(`Category "${name}" added`);
  };

  const handleSaveCategory = (idx: number) => {
    const name = editingCatValue.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    if (categories.includes(name) && categories[idx] !== name) {
      toast.error("Category already exists");
      return;
    }
    const updated = categories.map((c, i) => (i === idx ? name : c));
    updateCategories(updated);
    setEditingCatIdx(null);
    toast.success("Category updated");
  };

  const handleDeleteCategory = (idx: number) => {
    const cat = categories[idx];
    const inUse = items.some((it) => it.category === cat);
    if (inUse) {
      toast.warning(
        `Category "${cat}" is used by inventory items. Reassign them first.`,
      );
      return;
    }
    if (!confirm(`Delete category "${cat}"?`)) return;
    updateCategories(categories.filter((_, i) => i !== idx));
    toast.success("Category deleted");
  };

  const filtered = items.filter(
    (it) =>
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.category.toLowerCase().includes(search.toLowerCase()),
  );

  function openAdd() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, category: categories[0] ?? "" });
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
      hsn: it.hsn ?? "",
      tax: it.tax ?? "5",
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
      hsn: form.hsn,
      tax: form.tax,
    };
    if (editTarget) {
      const updated = items.map((it) =>
        it.id === editTarget.id ? { ...it, ...payload } : it,
      );
      setItems(updated);
      save(`${restaurantId}_inventory`, updated);
      toast.success("Item updated");
    } else {
      const newIt: InventoryItem = { id: Date.now().toString(), ...payload };
      const updated = [...items, newIt];
      setItems(updated);
      save(`${restaurantId}_inventory`, updated);
      toast.success("Item added");
    }
    setDialogOpen(false);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const updated = items.filter((it) => it.id !== deleteTarget.id);
    setItems(updated);
    save(`${restaurantId}_inventory`, updated);
    setDeleteTarget(null);
    toast.success("Item deleted");
  }

  const downloadTemplate = async () => {
    const XLSX = await getXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "name",
        "category",
        "quantity",
        "unit",
        "reorderLevel",
        "costPrice",
        "hsn",
        "tax",
      ],
      ["Tomatoes", "Vegetables", 50, "kg", 10, 30, "0702", "5"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "inventory_import_template.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const XLSX = await getXLSX();
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (rows.length === 0) {
      toast.error("Excel file is empty or has no data rows");
      return;
    }
    let count = 0;
    const existing = load(`${restaurantId}_inventory`);
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const name = (r.name || "").toString().trim();
      if (!name) continue;
      existing.push({
        id: `${Date.now()}_${count}`,
        name,
        category: (r.category || "").toString().trim(),
        quantity: Number(r.quantity) || 0,
        unit: (r.unit || "pcs").toString().trim(),
        reorderLevel: Number(r.reorderLevel) || 0,
        costPrice: Number(r.costPrice) || 0,
        updatedAt: Date.now(),
        hsn: (r.hsn || "").toString().trim(),
        tax: (r.tax || "5").toString().trim(),
      });
      count++;
    }
    setItems(existing);
    save(`${restaurantId}_inventory`, existing);
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCatDialogOpen(true)}
            data-ocid="inventory.manage_categories_button"
          >
            Manage Categories
          </Button>
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
                    "Unit",
                    "HSN",
                    "Tax %",
                    "Reorder Level",
                    "Cost Price",
                    "Updated",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-muted-foreground font-medium whitespace-nowrap"
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
                    <td className="px-4 py-3 text-foreground">{it.quantity}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {it.unit}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {it.hsn || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {it.tax ? (
                        <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-full">
                          {it.tax}%
                        </span>
                      ) : (
                        "—"
                      )}
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

      {/* Add/Edit Item Dialog */}
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
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger
                  className="h-9"
                  data-ocid="inventory.category_select"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="inv-hsn">HSN Code</Label>
              <Input
                id="inv-hsn"
                className="h-9"
                data-ocid="inventory.hsn_input"
                value={form.hsn}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hsn: e.target.value }))
                }
                placeholder="e.g. 0702"
              />
            </div>
            <div className="space-y-1">
              <Label>Tax / GST %</Label>
              <Select
                value={form.tax}
                onValueChange={(v) => setForm((p) => ({ ...p, tax: v }))}
              >
                <SelectTrigger className="h-9" data-ocid="inventory.tax_select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GST_SLABS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}%
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

      {/* Delete Confirm */}
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

      {/* Manage Categories Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          data-ocid="inventory.categories.dialog"
        >
          <DialogHeader>
            <DialogTitle>Inventory Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                className="h-9 flex-1"
                placeholder="New category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                data-ocid="inventory.new_category.input"
              />
              <Button
                onClick={handleAddCategory}
                data-ocid="inventory.add_category.button"
              >
                Add
              </Button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {categories.map((cat, idx) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/40"
                >
                  {editingCatIdx === idx ? (
                    <>
                      <Input
                        className="h-8 flex-1"
                        value={editingCatValue}
                        onChange={(e) => setEditingCatValue(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleSaveCategory(idx)
                        }
                        autoFocus
                        data-ocid={`inventory.category.edit_input.${idx + 1}`}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveCategory(idx)}
                        data-ocid={`inventory.category.save_button.${idx + 1}`}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingCatIdx(null)}
                      >
                        ✕
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-foreground">
                        {cat}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingCatIdx(idx);
                          setEditingCatValue(cat);
                        }}
                        data-ocid={`inventory.category.edit_button.${idx + 1}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCategory(idx)}
                        data-ocid={`inventory.category.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCatDialogOpen(false)}
              data-ocid="inventory.categories.close_button"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
