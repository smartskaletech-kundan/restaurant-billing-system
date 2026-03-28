import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Info, Lock, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { RestaurantSettings } from "../backend";
import { useRestaurant } from "../context/RestaurantContext";
import { useActorExtended as useActor } from "../hooks/useActorExtended";

const DEFAULT_SETTINGS: RestaurantSettings = {
  name: "Spice Garden Restaurant",
  address: "123 MG Road, Bangalore, Karnataka 560001",
  phone: "+91 98765 43210",
  taxRate: 18,
  currency: "INR",
  footerMessage: "Thank you for dining with us! Visit again.",
};

interface SmsConfig {
  provider: string;
  apiKey: string;
  accountSid: string;
  senderId: string;
  templateId: string;
  enabled: boolean;
}

const DEFAULT_SMS_CONFIG: SmsConfig = {
  provider: "msg91",
  apiKey: "",
  accountSid: "",
  senderId: "",
  templateId: "",
  enabled: false,
};

export function Settings() {
  const { actor, isFetching } = useActor();
  const { restaurantId, ownerName } = useRestaurant();
  const [form, setForm] = useState<RestaurantSettings>(DEFAULT_SETTINGS);
  const [gstNumber, setGstNumber] = useState("");
  const [card1Name, setCard1Name] = useState("HDFC Card");
  const [card2Name, setCard2Name] = useState("SBI Card");
  const [ownerWhatsAppNumber, setOwnerWhatsAppNumber] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [banquetPrefix, setBanquetPrefix] = useState("BANQ");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // SMS Gateway
  const [smsConfig, setSmsConfig] = useState<SmsConfig>(DEFAULT_SMS_CONFIG);
  const [smsSaving, setSmsSaving] = useState(false);

  const gstinKey = restaurantId
    ? `${restaurantId}_restaurant_gstin`
    : "restaurant_gstin";
  const card1Key = `${restaurantId}_card1_name`;
  const card2Key = `${restaurantId}_card2_name`;

  // Load GSTIN, card names, and SMS config from localStorage
  useEffect(() => {
    try {
      setGstNumber(localStorage.getItem(gstinKey) || "");
      setCard1Name(localStorage.getItem(card1Key) || "HDFC Card");
      setCard2Name(localStorage.getItem(card2Key) || "SBI Card");
      setOwnerWhatsAppNumber(
        localStorage.getItem(`${restaurantId}_owner_whatsapp_number`) || "",
      );
      setInvoicePrefix(
        localStorage.getItem(`${restaurantId}_invoice_prefix`) || "INV",
      );
      setBanquetPrefix(
        localStorage.getItem(`${restaurantId}_banquet_prefix`) || "BANQ",
      );
      const lsSms = localStorage.getItem(`${restaurantId}_sms_config`);
      if (lsSms) {
        try {
          setSmsConfig(JSON.parse(lsSms));
        } catch {
          // ignore parse error
        }
      }
    } catch {
      // ignore
    }
  }, [gstinKey, card1Key, card2Key, restaurantId]);

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
    Promise.all([actor.getSettingsR(restaurantId).catch(() => null)])
      .then(([s]) => {
        if (s?.name) setForm(s);
      })
      .catch((err) => {
        console.log("Settings load error (non-critical):", err);
      })
      .finally(() => {
        setLoading(false);
      });
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
      localStorage.setItem(
        `${restaurantId}_owner_whatsapp_number`,
        ownerWhatsAppNumber,
      );

      // Notify same-tab listeners about card name change
      window.dispatchEvent(new Event("cardNamesUpdated"));

      // Show success immediately
      setSaveSuccess(true);
      toast.success("Settings saved successfully!");
      setTimeout(() => setSaveSuccess(false), 3000);

      // Attempt backend save in background (best-effort, non-blocking)
      if (actor) {
        actor.updateSettingsR(restaurantId, form).catch((err) => {
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

  const handleSaveSmsConfig = () => {
    setSmsSaving(true);
    try {
      localStorage.setItem(
        `${restaurantId}_sms_config`,
        JSON.stringify(smsConfig),
      );
      toast.success("SMS/WhatsApp gateway settings saved!");
    } catch (err) {
      console.error("SMS config save error:", err);
      toast.error("Failed to save gateway settings");
    } finally {
      setSmsSaving(false);
    }
  };

  const update = (key: keyof RestaurantSettings, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateSms = (key: keyof SmsConfig, value: string | boolean) =>
    setSmsConfig((s) => ({ ...s, [key]: value }));

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

        <div className="space-y-1.5">
          <Label>Owner WhatsApp Number</Label>
          <Input
            data-ocid="settings.owner_whatsapp.input"
            value={ownerWhatsAppNumber}
            onChange={(e) => setOwnerWhatsAppNumber(e.target.value)}
            placeholder="+91 XXXXX XXXXX"
          />
          <p className="text-xs text-muted-foreground">
            Pre-filled when sending WhatsApp summary reports to the owner
          </p>
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

      {/* Invoice Series */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-4">
        <h3 className="font-semibold text-foreground border-b border-border pb-3">
          🧾 Invoice Series
        </h3>
        <p className="text-sm text-muted-foreground">
          Set custom prefixes for your bill invoice numbers. Changes apply to
          new bills only.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Restaurant Bill Prefix</Label>
            <Input
              data-ocid="settings.invoice_prefix.input"
              value={invoicePrefix}
              maxLength={8}
              onChange={(e) =>
                setInvoicePrefix(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                )
              }
              placeholder="INV"
            />
            <p className="text-xs text-muted-foreground">
              e.g. INV → INV/2025-26/001
            </p>
          </div>
          <div className="space-y-1">
            <Label>Banquet Bill Prefix</Label>
            <Input
              data-ocid="settings.banquet_prefix.input"
              value={banquetPrefix}
              maxLength={8}
              onChange={(e) =>
                setBanquetPrefix(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                )
              }
              placeholder="BANQ"
            />
            <p className="text-xs text-muted-foreground">
              e.g. BANQ → BANQ/2025-26/001
            </p>
          </div>
        </div>
        <Button
          data-ocid="settings.invoice_series.save_button"
          onClick={() => {
            const pfx = invoicePrefix.trim() || "INV";
            const bpfx = banquetPrefix.trim() || "BANQ";
            localStorage.setItem(`${restaurantId}_invoice_prefix`, pfx);
            localStorage.setItem(`${restaurantId}_banquet_prefix`, bpfx);
            setInvoicePrefix(pfx);
            setBanquetPrefix(bpfx);
            toast.success("Invoice settings saved!");
          }}
          variant="outline"
        >
          💾 Save Invoice Settings
        </Button>
      </div>

      {/* SMS / WhatsApp Gateway */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-5">
        <h3 className="font-semibold text-foreground border-b border-border pb-3">
          📲 SMS / WhatsApp Gateway
        </h3>

        {/* Info box */}
        <div className="flex gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="space-y-1 text-muted-foreground">
            <p className="font-medium text-foreground">
              How to get your API key:
            </p>
            <p>
              • <span className="font-medium">MSG91</span>: Register at{" "}
              <span className="font-mono text-xs">msg91.com</span>, get your
              Auth Key, and register a DLT template.
            </p>
            <p>
              • <span className="font-medium">Fast2SMS</span>: Sign up at{" "}
              <span className="font-mono text-xs">fast2sms.com</span> and copy
              your Authorization key.
            </p>
            <p>
              • <span className="font-medium">Twilio</span>: Get your Account
              SID + Auth Token from{" "}
              <span className="font-mono text-xs">console.twilio.com</span>.
            </p>
          </div>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Enable SMS/WhatsApp Gateway</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send OTP and notifications to customers via SMS/WhatsApp
            </p>
          </div>
          <Switch
            data-ocid="settings.sms_gateway.switch"
            checked={smsConfig.enabled}
            onCheckedChange={(v) => updateSms("enabled", v)}
          />
        </div>

        {/* Provider */}
        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select
            value={smsConfig.provider}
            onValueChange={(v) => updateSms("provider", v)}
          >
            <SelectTrigger
              data-ocid="settings.sms_provider.select"
              className="h-9"
            >
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="msg91">MSG91</SelectItem>
              <SelectItem value="fast2sms">Fast2SMS</SelectItem>
              <SelectItem value="twilio">Twilio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <Label>
            {smsConfig.provider === "twilio"
              ? "Auth Token"
              : smsConfig.provider === "fast2sms"
                ? "Authorization Key"
                : "Auth Key"}
          </Label>
          <Input
            data-ocid="settings.sms_apikey.input"
            type="password"
            className="h-9 font-mono"
            value={smsConfig.apiKey}
            onChange={(e) => updateSms("apiKey", e.target.value)}
            placeholder={
              smsConfig.provider === "twilio"
                ? "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                : "Enter API key"
            }
          />
        </div>

        {/* Account SID — Twilio only */}
        {smsConfig.provider === "twilio" && (
          <div className="space-y-1.5">
            <Label>Account SID</Label>
            <Input
              data-ocid="settings.sms_account_sid.input"
              className="h-9 font-mono"
              value={smsConfig.accountSid}
              onChange={(e) => updateSms("accountSid", e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>
        )}

        {/* Sender ID */}
        <div className="space-y-1.5">
          <Label>
            {smsConfig.provider === "twilio" ? "From Number" : "Sender ID"}
          </Label>
          <Input
            data-ocid="settings.sms_sender.input"
            className="h-9"
            value={smsConfig.senderId}
            onChange={(e) => updateSms("senderId", e.target.value)}
            placeholder={
              smsConfig.provider === "twilio"
                ? "+1XXXXXXXXXX"
                : smsConfig.provider === "fast2sms"
                  ? "RESTAL"
                  : "RESTAL"
            }
          />
          <p className="text-xs text-muted-foreground">
            {smsConfig.provider === "twilio"
              ? "Your Twilio phone number in E.164 format"
              : "6-character Sender ID approved in your DLT registration"}
          </p>
        </div>

        {/* DLT Template ID — not required for Twilio */}
        {smsConfig.provider !== "twilio" && (
          <div className="space-y-1.5">
            <Label>DLT Template ID</Label>
            <Input
              data-ocid="settings.sms_template.input"
              className="h-9 font-mono"
              value={smsConfig.templateId}
              onChange={(e) => updateSms("templateId", e.target.value)}
              placeholder="1234567890123456789"
            />
            <p className="text-xs text-muted-foreground">
              Required by TRAI/DLT regulations for Indian SMS delivery
            </p>
          </div>
        )}

        <Button
          data-ocid="settings.sms_gateway.save_button"
          onClick={handleSaveSmsConfig}
          disabled={smsSaving}
          className="w-full"
        >
          {smsSaving ? "Saving..." : "💾 Save Gateway Settings"}
        </Button>
      </div>

      <BanquetHallsMenuSettings restaurantId={restaurantId} />
    </div>
  );
}

// ──────────────────────────────────────────────
// Banquet Halls & Menu Settings sub-component
// ──────────────────────────────────────────────

interface BanquetHall {
  id: string;
  name: string;
  defaultCharge: number;
}

interface BanquetMenuItemBase {
  id: string;
  name: string;
  rate: number;
}

interface BanquetMenuItem extends BanquetMenuItemBase {
  type: "veg" | "nonveg";
}

const DEFAULT_BANQUET_HALLS: BanquetHall[] = [
  { id: "hall-1", name: "Main Banquet Hall", defaultCharge: 0 },
  { id: "hall-2", name: "Garden Lawn", defaultCharge: 0 },
  { id: "hall-3", name: "Rooftop Terrace", defaultCharge: 0 },
  { id: "hall-4", name: "Conference Room", defaultCharge: 0 },
  { id: "hall-5", name: "Private Dining Room", defaultCharge: 0 },
];

const DEFAULT_BANQUET_VEG: BanquetMenuItemBase[] = [
  { id: "bv-1", name: "Veg Starter Platter", rate: 250 },
  { id: "bv-2", name: "Paneer Tikka", rate: 180 },
  { id: "bv-3", name: "Veg Biryani", rate: 220 },
  { id: "bv-4", name: "Dal Makhani", rate: 120 },
  { id: "bv-5", name: "Shahi Paneer", rate: 160 },
  { id: "bv-6", name: "Mix Veg Curry", rate: 130 },
  { id: "bv-7", name: "Steamed Rice", rate: 80 },
  { id: "bv-8", name: "Butter Naan", rate: 60 },
  { id: "bv-9", name: "Veg Soup", rate: 90 },
  { id: "bv-10", name: "Veg Welcome Drink", rate: 50 },
];

const DEFAULT_BANQUET_NON_VEG: BanquetMenuItemBase[] = [
  { id: "bnv-1", name: "Non-Veg Starter Platter", rate: 350 },
  { id: "bnv-2", name: "Chicken Tikka", rate: 280 },
  { id: "bnv-3", name: "Mutton Seekh Kebab", rate: 320 },
  { id: "bnv-4", name: "Chicken Biryani", rate: 300 },
  { id: "bnv-5", name: "Mutton Curry", rate: 350 },
  { id: "bnv-6", name: "Fish Fry", rate: 280 },
  { id: "bnv-7", name: "Egg Curry", rate: 150 },
  { id: "bnv-8", name: "Chicken Soup", rate: 120 },
  { id: "bnv-9", name: "Non-Veg Welcome Drink", rate: 70 },
];

function loadBanquetHalls(restaurantId: string): BanquetHall[] {
  try {
    const raw = localStorage.getItem(`${restaurantId}_banquet_halls`);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return DEFAULT_BANQUET_HALLS;
}

function loadBanquetMenuItems(restaurantId: string): BanquetMenuItem[] {
  let vegItems: BanquetMenuItemBase[] = DEFAULT_BANQUET_VEG;
  let nonVegItems: BanquetMenuItemBase[] = DEFAULT_BANQUET_NON_VEG;
  try {
    const rawVeg = localStorage.getItem(`${restaurantId}_banquet_veg_menu`);
    if (rawVeg) vegItems = JSON.parse(rawVeg);
  } catch {
    /* ignore */
  }
  try {
    const rawNonVeg = localStorage.getItem(
      `${restaurantId}_banquet_nonveg_menu`,
    );
    if (rawNonVeg) nonVegItems = JSON.parse(rawNonVeg);
  } catch {
    /* ignore */
  }
  return [
    ...vegItems.map((i) => ({ ...i, type: "veg" as const })),
    ...nonVegItems.map((i) => ({ ...i, type: "nonveg" as const })),
  ];
}

function BanquetHallsMenuSettings({ restaurantId }: { restaurantId: string }) {
  const [halls, setHalls] = useState<BanquetHall[]>(() =>
    loadBanquetHalls(restaurantId),
  );
  const [menuItems, setMenuItems] = useState<BanquetMenuItem[]>(() =>
    loadBanquetMenuItems(restaurantId),
  );

  function addHall() {
    setHalls((prev) => [
      ...prev,
      { id: `hall-${Date.now()}`, name: "", defaultCharge: 0 },
    ]);
  }

  function updateHall(
    id: string,
    field: "name" | "defaultCharge",
    value: string | number,
  ) {
    setHalls((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)),
    );
  }

  function removeHall(id: string) {
    setHalls((prev) => prev.filter((h) => h.id !== id));
  }

  function addMenuItem() {
    setMenuItems((prev) => [
      ...prev,
      { id: `bm-${Date.now()}`, name: "", rate: 0, type: "veg" },
    ]);
  }

  function updateMenuItem(
    id: string,
    field: "name" | "rate" | "type",
    value: string | number,
  ) {
    setMenuItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    );
  }

  function removeMenuItem(id: string) {
    setMenuItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleSaveBanquetSettings() {
    localStorage.setItem(
      `${restaurantId}_banquet_halls`,
      JSON.stringify(halls),
    );
    // Split back and save to separate keys for BanquetBilling.tsx compatibility
    const vegItems = menuItems
      .filter((i) => i.type === "veg")
      .map(({ id, name, rate }) => ({ id, name, rate }));
    const nonVegItems = menuItems
      .filter((i) => i.type === "nonveg")
      .map(({ id, name, rate }) => ({ id, name, rate }));
    localStorage.setItem(
      `${restaurantId}_banquet_veg_menu`,
      JSON.stringify(vegItems),
    );
    localStorage.setItem(
      `${restaurantId}_banquet_nonveg_menu`,
      JSON.stringify(nonVegItems),
    );
    toast.success("Banquet settings saved!");
  }

  const vegItems = menuItems.filter((i) => i.type === "veg");
  const nonVegItems = menuItems.filter((i) => i.type === "nonveg");

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏛️</span>
        <h2 className="text-lg font-semibold">
          Banquet Halls &amp; Menu Settings
        </h2>
      </div>

      {/* Halls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-base">Halls / Venues</h3>
          <button
            type="button"
            data-ocid="settings.banquet_hall.button"
            onClick={addHall}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Hall
          </button>
        </div>
        <div className="space-y-2">
          {halls.map((hall, idx) => (
            <div
              key={hall.id}
              className="flex items-center gap-2"
              data-ocid={`settings.banquet_hall.item.${idx + 1}`}
            >
              <Input
                placeholder="Hall / Venue Name"
                value={hall.name}
                onChange={(e) => updateHall(hall.id, "name", e.target.value)}
                className="flex-1 h-9"
              />
              <Input
                type="number"
                min={0}
                placeholder="Default Charge (₹)"
                value={hall.defaultCharge || ""}
                onChange={(e) =>
                  updateHall(hall.id, "defaultCharge", Number(e.target.value))
                }
                className="w-40 h-9"
              />
              <button
                type="button"
                data-ocid={`settings.banquet_hall.delete_button.${idx + 1}`}
                onClick={() => removeHall(hall.id)}
                className="text-destructive hover:bg-destructive/10 rounded p-1.5 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t" />

      {/* Unified Menu Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-base">🍽️ Banquet Menu Items</h3>
          <button
            type="button"
            data-ocid="settings.banquet_menu.button"
            onClick={addMenuItem}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Menu Item
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Add items and toggle between 🟢 Veg and 🔴 Non-Veg. Items are grouped
          by type below.
        </p>

        {/* Veg Section */}
        {vegItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-700">
                🥗 Veg Menu Items ({vegItems.length})
              </span>
              <div className="flex-1 h-px bg-green-200" />
            </div>
            {vegItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-green-50/50 border border-green-100"
                data-ocid={`settings.banquet_veg.item.${idx + 1}`}
              >
                <Input
                  placeholder="Item Name"
                  value={item.name}
                  onChange={(e) =>
                    updateMenuItem(item.id, "name", e.target.value)
                  }
                  className="flex-1 h-9"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="₹/head"
                  value={item.rate || ""}
                  onChange={(e) =>
                    updateMenuItem(item.id, "rate", Number(e.target.value))
                  }
                  className="w-28 h-9"
                />
                {/* Type toggle buttons */}
                <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
                  <button
                    type="button"
                    onClick={() => updateMenuItem(item.id, "type", "veg")}
                    className="px-2.5 py-1.5 text-xs font-medium bg-green-500 text-white transition-colors"
                  >
                    🟢 Veg
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMenuItem(item.id, "type", "nonveg")}
                    className="px-2.5 py-1.5 text-xs font-medium bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    🔴 Non-Veg
                  </button>
                </div>
                <button
                  type="button"
                  data-ocid={`settings.banquet_veg.delete_button.${idx + 1}`}
                  onClick={() => removeMenuItem(item.id)}
                  className="text-destructive hover:bg-destructive/10 rounded p-1.5 transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Non-Veg Section */}
        {nonVegItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-red-700">
                🍗 Non-Veg Menu Items ({nonVegItems.length})
              </span>
              <div className="flex-1 h-px bg-red-200" />
            </div>
            {nonVegItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-red-50/50 border border-red-100"
                data-ocid={`settings.banquet_nonveg.item.${idx + 1}`}
              >
                <Input
                  placeholder="Item Name"
                  value={item.name}
                  onChange={(e) =>
                    updateMenuItem(item.id, "name", e.target.value)
                  }
                  className="flex-1 h-9"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="₹/head"
                  value={item.rate || ""}
                  onChange={(e) =>
                    updateMenuItem(item.id, "rate", Number(e.target.value))
                  }
                  className="w-28 h-9"
                />
                {/* Type toggle buttons */}
                <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
                  <button
                    type="button"
                    onClick={() => updateMenuItem(item.id, "type", "veg")}
                    className="px-2.5 py-1.5 text-xs font-medium bg-muted text-muted-foreground hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    🟢 Veg
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMenuItem(item.id, "type", "nonveg")}
                    className="px-2.5 py-1.5 text-xs font-medium bg-red-500 text-white transition-colors"
                  >
                    🔴 Non-Veg
                  </button>
                </div>
                <button
                  type="button"
                  data-ocid={`settings.banquet_nonveg.delete_button.${idx + 1}`}
                  onClick={() => removeMenuItem(item.id)}
                  className="text-destructive hover:bg-destructive/10 rounded p-1.5 transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {menuItems.length === 0 && (
          <div
            className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg"
            data-ocid="settings.banquet_menu.empty_state"
          >
            No menu items yet. Click &quot;Add Menu Item&quot; to get started.
          </div>
        )}
      </div>

      <Button
        data-ocid="settings.banquet.save_button"
        onClick={handleSaveBanquetSettings}
        className="w-full"
      >
        💾 Save Banquet Settings
      </Button>
    </div>
  );
}
