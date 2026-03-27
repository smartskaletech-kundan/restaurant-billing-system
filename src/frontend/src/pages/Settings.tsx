import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { RestaurantSettings } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActor } from "../hooks/useActor";

const DEFAULT_SETTINGS: RestaurantSettings = {
  name: "Spice Garden Restaurant",
  address: "123 MG Road, Bangalore, Karnataka 560001",
  phone: "+91 98765 43210",
  taxRate: 18,
  currency: "INR",
  footerMessage: "Thank you for dining with us! Visit again.",
};

export function Settings() {
  const { actor, isFetching } = useActor();
  const { restaurantId, ownerName } = useRestaurant();
  const [form, setForm] = useState<RestaurantSettings>(DEFAULT_SETTINGS);
  const [gstNumber, setGstNumber] = useState("");
  const [card1Name, setCard1Name] = useState("HDFC Card");
  const [card2Name, setCard2Name] = useState("SBI Card");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const gstinKey = restaurantId
    ? `${restaurantId}_restaurant_gstin`
    : "restaurant_gstin";
  const card1Key = `${restaurantId}_card1_name`;
  const card2Key = `${restaurantId}_card2_name`;

  // Load GSTIN and card names from localStorage
  useEffect(() => {
    try {
      setGstNumber(localStorage.getItem(gstinKey) || "");
      setCard1Name(localStorage.getItem(card1Key) || "HDFC Card");
      setCard2Name(localStorage.getItem(card2Key) || "SBI Card");
    } catch {
      // ignore
    }
  }, [gstinKey, card1Key, card2Key]);

  // Load settings: try backend first, fall back to localStorage
  useEffect(() => {
    if (!restaurantId) return;

    // Load from localStorage as immediate values
    const lsName = localStorage.getItem(`${restaurantId}_settings_name`);
    const lsAddress = localStorage.getItem(`${restaurantId}_settings_address`);
    const lsPhone = localStorage.getItem(`${restaurantId}_settings_phone`);
    const lsTaxRate = localStorage.getItem(`${restaurantId}_settings_taxRate`);
    const lsCurrency = localStorage.getItem(
      `${restaurantId}_settings_currency`,
    );
    const lsFooter = localStorage.getItem(
      `${restaurantId}_settings_footerMessage`,
    );

    if (lsName || lsAddress || lsPhone) {
      setForm({
        name: lsName || DEFAULT_SETTINGS.name,
        address: lsAddress || DEFAULT_SETTINGS.address,
        phone: lsPhone || DEFAULT_SETTINGS.phone,
        taxRate: lsTaxRate ? Number(lsTaxRate) : DEFAULT_SETTINGS.taxRate,
        currency: lsCurrency || DEFAULT_SETTINGS.currency,
        footerMessage: lsFooter || DEFAULT_SETTINGS.footerMessage,
      });
    }

    if (!actor || isFetching) {
      setLoading(false);
      return;
    }

    setLoading(true);
    actor
      .getSettings()
      .then((s) => {
        if (s.name) setForm(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [actor, isFetching, restaurantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save all settings to localStorage FIRST — this always succeeds
      if (restaurantId) {
        localStorage.setItem(`${restaurantId}_settings_name`, form.name);
        localStorage.setItem(`${restaurantId}_settings_address`, form.address);
        localStorage.setItem(`${restaurantId}_settings_phone`, form.phone);
        localStorage.setItem(
          `${restaurantId}_settings_taxRate`,
          String(form.taxRate),
        );
        localStorage.setItem(
          `${restaurantId}_settings_currency`,
          form.currency,
        );
        localStorage.setItem(
          `${restaurantId}_settings_footerMessage`,
          form.footerMessage,
        );
      }
      localStorage.setItem(gstinKey, gstNumber);
      localStorage.setItem(card1Key, card1Name || "HDFC Card");
      localStorage.setItem(card2Key, card2Name || "SBI Card");

      // Show success immediately
      setSaveSuccess(true);
      toast.success("Settings saved successfully!");
      setTimeout(() => setSaveSuccess(false), 3000);

      // Attempt backend save in background (best-effort, non-blocking)
      if (actor) {
        actor.updateSettings(form).catch((err) => {
          console.log("Background settings sync failed (non-critical):", err);
        });
      }
    } catch (err) {
      console.error("Unexpected settings save error:", err);
      toast.error("Failed to save settings locally");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof RestaurantSettings, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        data-ocid="settings.loading_state"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6" data-ocid="settings.page">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your restaurant details and billing preferences
        </p>
      </div>

      {/* Restaurant Identity */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-4">
        <h3 className="font-semibold text-foreground border-b border-border pb-3">
          Restaurant Identity
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-muted-foreground text-xs">
              Restaurant ID
            </Label>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-sm text-foreground">
                {restaurantId || "—"}
              </span>
              <Badge variant="secondary" className="ml-auto text-xs">
                Read-only
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Unique identifier for your restaurant (cannot be changed)
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">Owner Name</Label>
          <div className="bg-muted rounded-lg px-3 py-2 border border-border">
            <span className="text-sm text-foreground">{ownerName || "—"}</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-5">
        <h3 className="font-semibold text-foreground border-b border-border pb-3">
          Restaurant Information
        </h3>

        <div className="space-y-1.5">
          <Label>Restaurant Name</Label>
          <Input
            data-ocid="settings.name.input"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Your restaurant name"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Address</Label>
          <Textarea
            data-ocid="settings.address.textarea"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="Full address"
            className="resize-none h-20"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input
            data-ocid="settings.phone.input"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+91 XXXXX XXXXX"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-5">
        <h3 className="font-semibold text-foreground border-b border-border pb-3">
          Billing Configuration
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>GST / Tax Rate (%)</Label>
            <Input
              data-ocid="settings.taxrate.input"
              type="number"
              value={form.taxRate}
              onChange={(e) =>
                update("taxRate", Number.parseFloat(e.target.value) || 0)
              }
              min="0"
              max="100"
              step="0.5"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input
              data-ocid="settings.currency.input"
              value={form.currency}
              onChange={(e) => update("currency", e.target.value)}
              placeholder="INR"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>GST Number (GSTIN)</Label>
          <Input
            data-ocid="settings.gst.input"
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
            placeholder="e.g. 29AABCU9603R1ZX"
            maxLength={15}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            15-character GST Identification Number
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Card 1 Name</Label>
            <Input
              data-ocid="settings.card1.input"
              value={card1Name}
              onChange={(e) => setCard1Name(e.target.value)}
              placeholder="e.g. HDFC Card"
            />
            <p className="text-xs text-muted-foreground">
              First bank card name shown at billing
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Card 2 Name</Label>
            <Input
              data-ocid="settings.card2.input"
              value={card2Name}
              onChange={(e) => setCard2Name(e.target.value)}
              placeholder="e.g. SBI Card"
            />
            <p className="text-xs text-muted-foreground">
              Second bank card name shown at billing
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Bill Footer Message</Label>
          <Textarea
            data-ocid="settings.footer.textarea"
            value={form.footerMessage}
            onChange={(e) => update("footerMessage", e.target.value)}
            placeholder="Thank you for dining with us!"
            className="resize-none h-20"
          />
        </div>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm font-medium">
          ✅ Settings saved successfully!
        </div>
      )}

      <Button
        data-ocid="settings.submit_button"
        onClick={handleSave}
        disabled={saving}
        size="lg"
        className="w-full"
      >
        {saving ? "Saving..." : "💾 Save Settings"}
      </Button>
    </div>
  );
}
