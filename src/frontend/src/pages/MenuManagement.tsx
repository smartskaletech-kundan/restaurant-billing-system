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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MenuItem } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActorExtended as useActor } from "../hooks/useActorExtended";
import { getXLSX } from "../lib/xlsx-shim";

function getCatKey(rid: string) {
  return `${rid}_menu_categories`;
}
const DEFAULT_CATEGORIES = ["Starters", "Mains", "Beverages", "Desserts"];

function loadCategories(rid: string): string[] {
  try {
    const stored = localStorage.getItem(getCatKey(rid));
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  localStorage.setItem(getCatKey(rid), JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

function saveCategories(cats: string[], rid: string) {
  localStorage.setItem(getCatKey(rid), JSON.stringify(cats));
}

const UNITS = [
  "plate",
  "piece",
  "glass",
  "bowl",
  "kg",
  "L",
  "half",
  "full",
  "portion",
];
const GST_SLABS = ["0", "5", "12", "18", "28"];

function getUnitsKey(rid: string) {
  return `${rid}_menu_units`;
}
function getHSNKey(rid: string) {
  return `${rid}_menu_hsn`;
}
function getTaxKey(rid: string) {
  return `${rid}_menu_tax`;
}

function loadUnitMap(rid: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(getUnitsKey(rid)) || "{}");
  } catch {
    return {};
  }
}

function saveUnitMap(map: Record<string, string>, rid: string) {
  localStorage.setItem(getUnitsKey(rid), JSON.stringify(map));
}

function loadHsnMap(rid: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(getHSNKey(rid)) || "{}");
  } catch {
    return {};
  }
}

function saveHsnMap(map: Record<string, string>, rid: string) {
  localStorage.setItem(getHSNKey(rid), JSON.stringify(map));
}

function loadTaxMap(rid: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(getTaxKey(rid)) || "{}");
  } catch {
    return {};
  }
}

function saveTaxMap(map: Record<string, string>, rid: string) {
  localStorage.setItem(getTaxKey(rid), JSON.stringify(map));
}

const SAMPLE_ITEMS = [
  {
    category: "Starters",
    name: "Paneer Tikka",
    price: 280,
    description: "Marinated cottage cheese grilled to perfection",
  },
  {
    category: "Starters",
    name: "Veg Spring Rolls",
    price: 180,
    description: "Crispy rolls filled with seasonal vegetables",
  },
  {
    category: "Mains",
    name: "Dal Makhani",
    price: 320,
    description: "Slow-cooked black lentils in creamy tomato sauce",
  },
  {
    category: "Mains",
    name: "Butter Chicken",
    price: 380,
    description: "Tender chicken in rich buttery tomato gravy",
  },
  {
    category: "Mains",
    name: "Palak Paneer",
    price: 290,
    description: "Fresh spinach curry with cottage cheese",
  },
  {
    category: "Beverages",
    name: "Mango Lassi",
    price: 120,
    description: "Chilled yogurt drink with alphonso mango",
  },
  {
    category: "Beverages",
    name: "Masala Chai",
    price: 60,
    description: "Spiced Indian tea with milk",
  },
  {
    category: "Desserts",
    name: "Gulab Jamun",
    price: 140,
    description: "Soft milk solids dumplings in rose sugar syrup",
  },
  {
    category: "Desserts",
    name: "Rasmalai",
    price: 160,
    description: "Chenna patties soaked in flavored milk",
  },
];

type FormState = {
  category: string;
  name: string;
  price: string;
  description: string;
  available: boolean;
  unit: string;
  hsn: string;
  tax: string;
};

export function MenuManagement() {
  const { actor, isFetching } = useActor();
  const { restaurantId } = useRestaurant();
  const rid = restaurantId || "default";
  const [categories, setCategories] = useState<string[]>(() =>
    loadCategories(rid),
  );
  const [items, setItems] = useState<MenuItem[]>([]);
  const [unitMap, setUnitMap] = useState<Record<string, string>>(() =>
    loadUnitMap(rid),
  );
  const [hsnMap, setHsnMap] = useState<Record<string, string>>(() =>
    loadHsnMap(rid),
  );
  const [taxMap, setTaxMap] = useState<Record<string, string>>(() =>
    loadTaxMap(rid),
  );
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<FormState>({
    category: categories[0] ?? "Starters",
    name: "",
    price: "",
    description: "",
    available: true,
    unit: "plate",
    hsn: "",
    tax: "5",
  });
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null);
  const [editingCatValue, setEditingCatValue] = useState("");

  const updateCategories = (cats: string[]) => {
    setCategories(cats);
    saveCategories(cats, rid);
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
        `Category "${cat}" is used by menu items. Reassign items first.`,
      );
      return;
    }
    if (!confirm(`Delete category "${cat}"?`)) return;
    updateCategories(categories.filter((_, i) => i !== idx));
    toast.success("Category deleted");
  };

  const load = useCallback(
    async (skipSeed = false) => {
      if (!actor) return;
      setLoading(true);
      try {
        const result = await actor.getMenuItemsR(restaurantId);
        setItems(result);
        if (result.length === 0 && !seeded && !skipSeed) {
          setSeeded(true);
          await Promise.all(
            SAMPLE_ITEMS.map((s) =>
              actor.addMenuItemR(
                restaurantId,
                s.category,
                s.name,
                s.price,
                s.description,
              ),
            ),
          );
          const refreshed = await actor.getMenuItemsR(restaurantId);
          setItems(refreshed);
        }
      } finally {
        setLoading(false);
      }
    },
    [actor, seeded, restaurantId],
  );

  useEffect(() => {
    if (!actor || isFetching) return;
    load();
  }, [actor, isFetching, load]);

  const openAdd = () => {
    setEditItem(null);
    setForm({
      category: categories[0] ?? "",
      name: "",
      price: "",
      description: "",
      available: true,
      unit: "plate",
      hsn: "",
      tax: "5",
    });
    setShowModal(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditItem(item);
    setForm({
      category: item.category,
      name: item.name,
      price: item.price.toString(),
      description: item.description,
      available: item.available,
      unit: unitMap[item.id] ?? "plate",
      hsn: hsnMap[item.id] ?? "",
      tax: taxMap[item.id] ?? "5",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!actor || !form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      if (editItem) {
        await actor.updateMenuItemR(restaurantId, {
          ...editItem,
          ...form,
          price: Number.parseFloat(form.price),
        });
        const newUnitMap = { ...unitMap, [editItem.id]: form.unit };
        const newHsnMap = { ...hsnMap, [editItem.id]: form.hsn };
        const newTaxMap = { ...taxMap, [editItem.id]: form.tax };
        setUnitMap(newUnitMap);
        saveUnitMap(newUnitMap, rid);
        setHsnMap(newHsnMap);
        saveHsnMap(newHsnMap, rid);
        setTaxMap(newTaxMap);
        saveTaxMap(newTaxMap, rid);
        toast.success("Item updated");
      } else {
        await actor.addMenuItemR(
          restaurantId,
          form.category,
          form.name.trim(),
          Number.parseFloat(form.price),
          form.description,
        );
        const refreshed = await actor.getMenuItemsR(restaurantId);
        const added = refreshed.find(
          (i) => i.name === form.name.trim() && i.category === form.category,
        );
        if (added) {
          const newUnitMap = { ...unitMap, [added.id]: form.unit };
          const newHsnMap = { ...hsnMap, [added.id]: form.hsn };
          const newTaxMap = { ...taxMap, [added.id]: form.tax };
          setUnitMap(newUnitMap);
          saveUnitMap(newUnitMap, rid);
          setHsnMap(newHsnMap);
          saveHsnMap(newHsnMap, rid);
          setTaxMap(newTaxMap);
          saveTaxMap(newTaxMap, rid);
        }
        toast.success("Item added");
      }
      setShowModal(false);
      await load(true);
    } catch {
      toast.error("Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: MenuItem) => {
    if (!actor) return;
    if (!confirm(`Delete ${item.name}?`)) return;
    try {
      await actor.deleteMenuItemR(restaurantId, item.id);
      const newUnitMap = { ...unitMap };
      delete newUnitMap[item.id];
      setUnitMap(newUnitMap);
      saveUnitMap(newUnitMap, rid);
      const newHsnMap = { ...hsnMap };
      delete newHsnMap[item.id];
      setHsnMap(newHsnMap);
      saveHsnMap(newHsnMap, rid);
      const newTaxMap = { ...taxMap };
      delete newTaxMap[item.id];
      setTaxMap(newTaxMap);
      saveTaxMap(newTaxMap, rid);
      toast.success("Item deleted");
      await load(true);
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const handleToggleAvailable = async (item: MenuItem) => {
    if (!actor) return;
    try {
      await actor.updateMenuItemR(restaurantId, {
        ...item,
        available: !item.available,
      });
      await load(true);
    } catch {
      toast.error("Failed to update item");
    }
  };

  const downloadTemplate = async () => {
    const XLSX = await getXLSX();
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "category", "price", "description", "unit", "hsn", "tax"],
      [
        "Butter Chicken",
        "Mains",
        380,
        "Tender chicken in rich buttery tomato gravy",
        "plate",
        "1905",
        "5",
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Menu");
    XLSX.writeFile(wb, "menu_import_template.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const XLSX = await getXLSX();
    if (!actor) return;
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
    const newUnitMap = { ...unitMap };
    const newHsnMap = { ...hsnMap };
    const newTaxMap = { ...taxMap };
    try {
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const name = (r.name || "").toString().trim();
        const category = (r.category || "Mains").toString().trim();
        const price = Number(r.price) || 0;
        const description = (r.description || "").toString().trim();
        const unit = (r.unit || "plate").toString().trim();
        const hsn = (r.hsn || "").toString().trim();
        const tax = (r.tax || "5").toString().trim();
        if (!name) continue;
        await actor.addMenuItemR(
          restaurantId,
          category,
          name,
          price,
          description,
        );
        count++;
        newUnitMap[`_pending_${name}`] = unit;
        newHsnMap[`_pending_${name}`] = hsn;
        newTaxMap[`_pending_${name}`] = tax;
      }
      const refreshed = await actor.getMenuItemsR(restaurantId);
      for (const item of refreshed) {
        const pendingKey = `_pending_${item.name}`;
        if (newUnitMap[pendingKey] && !unitMap[item.id]) {
          newUnitMap[item.id] = newUnitMap[pendingKey];
          delete newUnitMap[pendingKey];
        }
        if (newHsnMap[pendingKey] !== undefined && !hsnMap[item.id]) {
          newHsnMap[item.id] = newHsnMap[pendingKey];
          delete newHsnMap[pendingKey];
        }
        if (newTaxMap[pendingKey] !== undefined && !taxMap[item.id]) {
          newTaxMap[item.id] = newTaxMap[pendingKey];
          delete newTaxMap[pendingKey];
        }
      }
      setUnitMap(newUnitMap);
      saveUnitMap(newUnitMap, rid);
      setHsnMap(newHsnMap);
      saveHsnMap(newHsnMap, rid);
      setTaxMap(newTaxMap);
      saveTaxMap(newTaxMap, rid);
      setItems(refreshed);
      toast.success(`Imported ${count} items successfully`);
    } catch {
      toast.error("Import failed — check your Excel format");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Build byCategory including uncategorised items
  const allCats = [...categories];
  for (const item of items) {
    if (!allCats.includes(item.category)) allCats.push(item.category);
  }
  const byCategory = allCats.reduce(
    (acc, cat) => {
      acc[cat] = items.filter((i) => i.category === cat);
      return acc;
    },
    {} as Record<string, MenuItem[]>,
  );

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="menu.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="menu.page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Menu Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} items across {categories.length} categories
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            data-ocid="menu.template_button"
          >
            ↓ Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            data-ocid="menu.import_button"
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
            data-ocid="menu.manage_categories_button"
          >
            Manage Categories
          </Button>
          <Button data-ocid="menu.add_button" onClick={openAdd}>
            + Add Item
          </Button>
        </div>
      </div>

      {allCats.map((cat) => (
        <div
          key={cat}
          className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        >
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{cat}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {byCategory[cat]?.length ?? 0} items
            </span>
          </div>
          {byCategory[cat]?.length === 0 ? (
            <div
              className="p-6 text-center"
              data-ocid={`menu.${cat.toLowerCase().replace(/\s+/g, "_")}.empty_state`}
            >
              <p className="text-muted-foreground text-sm">
                No {cat.toLowerCase()} items
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {byCategory[cat]?.map((item, i) => (
                <div
                  key={item.id}
                  data-ocid={`menu.item.${i + 1}`}
                  className="px-5 py-3 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {item.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {unitMap[item.id] && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          Unit: {unitMap[item.id]}
                        </span>
                      )}
                      {hsnMap[item.id] && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          HSN: {hsnMap[item.id]}
                        </span>
                      )}
                      {taxMap[item.id] && (
                        <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-full">
                          GST: {taxMap[item.id]}%
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-semibold text-foreground whitespace-nowrap">
                    ₹{item.price.toFixed(2)}
                    {unitMap[item.id] && (
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        / {unitMap[item.id]}
                      </span>
                    )}
                  </span>
                  <Switch
                    data-ocid={`menu.available.switch.${i + 1}`}
                    checked={item.available}
                    onCheckedChange={() => handleToggleAvailable(item)}
                  />
                  <Button
                    data-ocid={`menu.edit_button.${i + 1}`}
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(item)}
                  >
                    Edit
                  </Button>
                  <Button
                    data-ocid={`menu.delete_button.${i + 1}`}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Add/Edit Item Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg" data-ocid="menu.item.dialog">
          <DialogHeader>
            <DialogTitle>
              {editItem ? "Edit Menu Item" : "Add Menu Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="h-9" data-ocid="menu.category.select">
                  <SelectValue />
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
            <div className="space-y-1.5">
              <Label>Item Name</Label>
              <Input
                data-ocid="menu.name.input"
                className="h-9"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Butter Chicken"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price (₹)</Label>
                <Input
                  data-ocid="menu.price.input"
                  className="h-9"
                  type="number"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}
                >
                  <SelectTrigger className="h-9" data-ocid="menu.unit.select">
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>HSN Code</Label>
                <Input
                  data-ocid="menu.hsn.input"
                  className="h-9"
                  value={form.hsn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hsn: e.target.value }))
                  }
                  placeholder="e.g. 1905"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tax / GST %</Label>
                <Select
                  value={form.tax}
                  onValueChange={(v) => setForm((f) => ({ ...f, tax: v }))}
                >
                  <SelectTrigger className="h-9" data-ocid="menu.tax.select">
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
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                data-ocid="menu.description.textarea"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Brief description..."
                className="resize-none h-20"
              />
            </div>
            {editItem && (
              <div className="flex items-center gap-2">
                <Switch
                  data-ocid="menu.available_edit.switch"
                  checked={form.available}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, available: v }))
                  }
                />
                <Label>Available</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              data-ocid="menu.cancel_button"
              variant="ghost"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="menu.submit_button"
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.price}
            >
              {saving ? "Saving..." : editItem ? "Update Item" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          data-ocid="menu.categories.dialog"
        >
          <DialogHeader>
            <DialogTitle>Menu Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                className="h-9 flex-1"
                placeholder="New category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                data-ocid="menu.new_category.input"
              />
              <Button
                onClick={handleAddCategory}
                data-ocid="menu.add_category.button"
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
                        data-ocid={`menu.category.edit_input.${idx + 1}`}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveCategory(idx)}
                        data-ocid={`menu.category.save_button.${idx + 1}`}
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
                        data-ocid={`menu.category.edit_button.${idx + 1}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCategory(idx)}
                        data-ocid={`menu.category.delete_button.${idx + 1}`}
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
              data-ocid="menu.categories.close_button"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
