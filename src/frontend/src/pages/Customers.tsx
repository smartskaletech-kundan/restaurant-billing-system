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
import { Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { XLSX } from "../lib/xlsx-shim";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  companyName: string;
  gstin: string;
  loyaltyPoints: number;
  visitCount: number;
  createdAt: number;
}

const STORAGE_KEY = "smartskale_customers";

function loadCustomers(): Customer[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCustomers(list: Customer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  address: "",
  companyName: "",
  gstin: "",
};

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomers(loadCustomers());
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.companyName || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.gstin || "").toLowerCase().includes(search.toLowerCase()),
  );

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(c: Customer) {
    setEditTarget(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      companyName: c.companyName || "",
      gstin: c.gstin || "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (editTarget) {
      const updated = customers.map((c) =>
        c.id === editTarget.id ? { ...c, ...form } : c,
      );
      setCustomers(updated);
      saveCustomers(updated);
      toast.success("Customer updated");
    } else {
      const newC: Customer = {
        id: Date.now().toString(),
        ...form,
        loyaltyPoints: 0,
        visitCount: 0,
        createdAt: Date.now(),
      };
      const updated = [...customers, newC];
      setCustomers(updated);
      saveCustomers(updated);
      toast.success("Customer added");
    }
    setDialogOpen(false);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const updated = customers.filter((c) => c.id !== deleteTarget.id);
    setCustomers(updated);
    saveCustomers(updated);
    setDeleteTarget(null);
    toast.success("Customer deleted");
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "phone", "email", "address", "companyName", "gstin"],
      [
        "Rajesh Kumar",
        "9876543210",
        "rajesh@example.com",
        "Noida UP",
        "ABC Enterprises",
        "07AAACB2230M1ZV",
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "customers_import_template.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<
      string,
      string
    >[];
    if (rows.length === 0) {
      toast.error("Excel file is empty or has no data rows");
      return;
    }
    let count = 0;
    const existing = loadCustomers();
    for (const row of rows) {
      const name = (row.name || "").toString().trim();
      if (!name) continue;
      existing.push({
        id: `${Date.now()}_${count}`,
        name,
        phone: (row.phone || "").toString().trim(),
        email: (row.email || "").toString().trim(),
        address: (row.address || "").toString().trim(),
        companyName: (row.companyName || "").toString().trim(),
        gstin: (row.gstin || "").toString().trim(),
        loyaltyPoints: 0,
        visitCount: 0,
        createdAt: Date.now(),
      });
      count++;
    }
    setCustomers(existing);
    saveCustomers(existing);
    toast.success(`Imported ${count} customers successfully`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-5" data-ocid="customers.page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Customers</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {customers.length} registered customers
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            data-ocid="customers.search_input"
            placeholder="Search by name, phone, company or GSTIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            data-ocid="customers.template_button"
          >
            ↓ Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            data-ocid="customers.import_button"
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
          <Button data-ocid="customers.add_button" onClick={openAdd}>
            + Add Customer
          </Button>
        </div>
      </div>

      <div
        className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        data-ocid="customers.table"
      >
        {filtered.length === 0 ? (
          <div
            className="text-center py-16 text-muted-foreground"
            data-ocid="customers.empty_state"
          >
            <Users className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>
              {search
                ? "No customers match your search"
                : "No customers yet. Add your first customer."}
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
                    "Phone",
                    "Email",
                    "Address",
                    "Loyalty Pts",
                    "Visits",
                    "Since",
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
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    data-ocid={`customers.item.${i + 1}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.companyName || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {c.gstin || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.address || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{c.loyaltyPoints}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.visitCount}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          data-ocid={`customers.edit_button.${i + 1}`}
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(c)}
                        >
                          Edit
                        </Button>
                        <Button
                          data-ocid={`customers.delete_button.${i + 1}`}
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(c)}
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
        <DialogContent className="sm:max-w-xl" data-ocid="customers.dialog">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Customer" : "Add Customer"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="cust-name">Name *</Label>
              <Input
                id="cust-name"
                className="h-9"
                data-ocid="customers.name_input"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cust-companyName">Company Name</Label>
              <Input
                id="cust-companyName"
                className="h-9"
                data-ocid="customers.companyName_input"
                value={form.companyName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, companyName: e.target.value }))
                }
                placeholder="Company / Business name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cust-gstin">GSTIN</Label>
              <Input
                id="cust-gstin"
                className="h-9 font-mono"
                data-ocid="customers.gstin_input"
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
              <Label htmlFor="cust-phone">Phone</Label>
              <Input
                id="cust-phone"
                className="h-9"
                data-ocid="customers.phone_input"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="Phone"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cust-email">Email</Label>
              <Input
                id="cust-email"
                className="h-9"
                data-ocid="customers.email_input"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="Email"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="cust-address">Address</Label>
              <Input
                id="cust-address"
                className="h-9"
                data-ocid="customers.address_input"
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="Address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-ocid="customers.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} data-ocid="customers.save_button">
              {editTarget ? "Save Changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent data-ocid="customers.delete.dialog">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              data-ocid="customers.delete.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              data-ocid="customers.delete.confirm_button"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
