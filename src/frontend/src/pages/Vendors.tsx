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
import { Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Vendor {
  id: string;
  name: string;
  companyName: string;
  gstin: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  balanceDue: number;
  createdAt: number;
}

const STORAGE_KEY = "smartskale_vendors";
const CATEGORIES = [
  "Food Supplier",
  "Beverage Supplier",
  "Equipment",
  "Cleaning",
  "Other",
];

function load(): Vendor[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(list: Vendor[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const EMPTY_FORM = {
  name: "",
  companyName: "",
  gstin: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  category: CATEGORIES[0],
  balanceDue: "",
};

export function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  useEffect(() => {
    setVendors(load());
  }, []);

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.category.toLowerCase().includes(search.toLowerCase()) ||
      (v.companyName || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.gstin || "").toLowerCase().includes(search.toLowerCase()),
  );

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditTarget(v);
    setForm({
      name: v.name,
      companyName: v.companyName || "",
      gstin: v.gstin || "",
      contactPerson: v.contactPerson,
      phone: v.phone,
      email: v.email,
      address: v.address,
      category: v.category,
      balanceDue: v.balanceDue.toString(),
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    const payload = {
      name: form.name,
      companyName: form.companyName,
      gstin: form.gstin,
      contactPerson: form.contactPerson,
      phone: form.phone,
      email: form.email,
      address: form.address,
      category: form.category,
      balanceDue: Number(form.balanceDue) || 0,
    };
    if (editTarget) {
      const updated = vendors.map((v) =>
        v.id === editTarget.id ? { ...v, ...payload } : v,
      );
      setVendors(updated);
      save(updated);
      toast.success("Vendor updated");
    } else {
      const newV: Vendor = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        ...payload,
      };
      const updated = [...vendors, newV];
      setVendors(updated);
      save(updated);
      toast.success("Vendor added");
    }
    setDialogOpen(false);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const updated = vendors.filter((v) => v.id !== deleteTarget.id);
    setVendors(updated);
    save(updated);
    setDeleteTarget(null);
    toast.success("Vendor deleted");
  }

  return (
    <div className="space-y-5" data-ocid="vendors.page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Vendors</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {vendors.length} vendors
          </p>
        </div>
        <div className="flex gap-3">
          <Input
            data-ocid="vendors.search_input"
            placeholder="Search by name, company or GSTIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button data-ocid="vendors.add_button" onClick={openAdd}>
            + Add Vendor
          </Button>
        </div>
      </div>

      <div
        className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        data-ocid="vendors.table"
      >
        {filtered.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="vendors.empty_state"
          >
            <Truck className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>
              {search
                ? "No vendors match your search"
                : "No vendors added yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Name",
                    "Company",
                    "GSTIN",
                    "Contact Person",
                    "Phone",
                    "Email",
                    "Category",
                    "Balance Due",
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
                {filtered.map((v, i) => (
                  <tr
                    key={v.id}
                    data-ocid={`vendors.item.${i + 1}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {v.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.companyName || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {v.gstin || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.contactPerson || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {v.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <span
                        className={
                          v.balanceDue > 0
                            ? "text-destructive"
                            : "text-foreground"
                        }
                      >
                        ₹{v.balanceDue.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          data-ocid={`vendors.edit_button.${i + 1}`}
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(v)}
                        >
                          Edit
                        </Button>
                        <Button
                          data-ocid={`vendors.delete_button.${i + 1}`}
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(v)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl" data-ocid="vendors.dialog">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Vendor" : "Add Vendor"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Vendor Name *</Label>
              <Input
                data-ocid="vendors.name_input"
                className="h-9"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Vendor name"
              />
            </div>
            <div className="space-y-1">
              <Label>Company Name</Label>
              <Input
                data-ocid="vendors.companyName_input"
                className="h-9"
                value={form.companyName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, companyName: e.target.value }))
                }
                placeholder="Company / Business name"
              />
            </div>
            <div className="space-y-1">
              <Label>GSTIN</Label>
              <Input
                data-ocid="vendors.gstin_input"
                className="h-9 font-mono"
                value={form.gstin}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    gstin: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g. 07AAACB2230M1ZV"
              />
            </div>
            <div className="space-y-1">
              <Label>Contact Person</Label>
              <Input
                data-ocid="vendors.contact_input"
                className="h-9"
                value={form.contactPerson}
                onChange={(e) =>
                  setForm((p) => ({ ...p, contactPerson: e.target.value }))
                }
                placeholder="Contact name"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                data-ocid="vendors.phone_input"
                className="h-9"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                data-ocid="vendors.email_input"
                className="h-9"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="Email"
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
                  data-ocid="vendors.category_select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Address</Label>
              <Input
                data-ocid="vendors.address_input"
                className="h-9"
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="Address"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Balance Due (₹)</Label>
              <Input
                data-ocid="vendors.balance_input"
                className="h-9"
                type="number"
                min="0"
                step="0.01"
                value={form.balanceDue}
                onChange={(e) =>
                  setForm((p) => ({ ...p, balanceDue: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-ocid="vendors.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} data-ocid="vendors.save_button">
              {editTarget ? "Save Changes" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent data-ocid="vendors.delete.dialog">
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              data-ocid="vendors.delete.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              data-ocid="vendors.delete.confirm_button"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
