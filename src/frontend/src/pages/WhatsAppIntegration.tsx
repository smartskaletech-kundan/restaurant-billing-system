import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  ExternalLink,
  MessageSquare,
  Plus,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Template {
  id: number;
  name: string;
  message: string;
  usageCount: number;
  active: boolean;
}

interface MessageLog {
  id: number;
  to: string;
  customer: string;
  template: string;
  sentAt: string;
  status: "Sent" | "Delivered" | "Failed";
}

const INITIAL_TEMPLATES: Template[] = [
  {
    id: 1,
    name: "Bill Receipt",
    message:
      "Dear {name}, your bill of ₹{amount} has been generated. Thank you for dining with us!",
    usageCount: 142,
    active: true,
  },
  {
    id: 2,
    name: "Order Confirmation",
    message:
      "Hi {name}! Your order #{order_id} is confirmed and will be ready in {time} minutes.",
    usageCount: 89,
    active: true,
  },
  {
    id: 3,
    name: "Promotional Offer",
    message: "Hi {name}! 🎉 Special offer: {offer_details}. Valid till {date}.",
    usageCount: 34,
    active: false,
  },
  {
    id: 4,
    name: "Booking Confirmation",
    message:
      "Dear {name}, your table for {guests} guests is confirmed for {date} at {time}.",
    usageCount: 67,
    active: true,
  },
];

const INITIAL_LOGS: MessageLog[] = [
  {
    id: 1,
    to: "9812345678",
    customer: "Anita Gupta",
    template: "Bill Receipt",
    sentAt: "2026-03-27 14:32",
    status: "Delivered",
  },
  {
    id: 2,
    to: "9876543210",
    customer: "Rajesh Kumar",
    template: "Order Confirmation",
    sentAt: "2026-03-27 14:15",
    status: "Delivered",
  },
  {
    id: 3,
    to: "9845671234",
    customer: "Sunita Sharma",
    template: "Promotional Offer",
    sentAt: "2026-03-27 12:00",
    status: "Sent",
  },
  {
    id: 4,
    to: "9901234567",
    customer: "Mohan Das",
    template: "Bill Receipt",
    sentAt: "2026-03-27 11:45",
    status: "Delivered",
  },
  {
    id: 5,
    to: "9765432109",
    customer: "Kavita Patel",
    template: "Booking Confirmation",
    sentAt: "2026-03-26 19:30",
    status: "Failed",
  },
  {
    id: 6,
    to: "9812349999",
    customer: "Suresh Nair",
    template: "Bill Receipt",
    sentAt: "2026-03-26 18:10",
    status: "Delivered",
  },
  {
    id: 7,
    to: "9999012345",
    customer: "Pooja Verma",
    template: "Promotional Offer",
    sentAt: "2026-03-26 10:00",
    status: "Sent",
  },
  {
    id: 8,
    to: "9811122233",
    customer: "Arun Pillai",
    template: "Order Confirmation",
    sentAt: "2026-03-25 20:45",
    status: "Delivered",
  },
];

const statusColor: Record<string, string> = {
  Sent: "bg-blue-500/20 text-blue-400",
  Delivered: "bg-green-500/20 text-green-400",
  Failed: "bg-red-500/20 text-red-400",
};

export default function WhatsAppIntegration() {
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [logs] = useState<MessageLog[]>(INITIAL_LOGS);
  const [connected, setConnected] = useState(false);
  const [settings, setSettings] = useState({ phone: "", apiKey: "" });
  const [testPhone, setTestPhone] = useState("");
  const [testTemplate, setTestTemplate] = useState("");
  const [logFilter, setLogFilter] = useState<
    "All" | "Sent" | "Delivered" | "Failed"
  >("All");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplMessage, setNewTplMessage] = useState("");

  const webhookUrl =
    `https://api.smartskale.com/webhook/whatsapp/${settings.phone || "<your-number>"}`.replace(
      /\s/g,
      "",
    );

  function saveSettings() {
    if (!settings.phone || !settings.apiKey) {
      toast.error("Fill all fields");
      return;
    }
    setConnected(true);
    toast.success("WhatsApp settings saved. Connected!");
  }

  function sendTest() {
    if (!testPhone || !testTemplate) {
      toast.error("Select phone and template");
      return;
    }
    toast.success(`Test message sent to ${testPhone}`);
  }

  function saveEdit(id: number) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, message: editMessage } : t)),
    );
    setEditingId(null);
    toast.success("Template updated");
  }

  function saveNewTemplate() {
    if (!newTplName.trim() || !newTplMessage.trim()) {
      toast.error("Fill template name and message");
      return;
    }
    const newTpl: Template = {
      id: Date.now(),
      name: newTplName.trim(),
      message: newTplMessage.trim(),
      usageCount: 0,
      active: true,
    };
    setTemplates((prev) => [...prev, newTpl]);
    setShowNewTemplate(false);
    setNewTplName("");
    setNewTplMessage("");
    toast.success("New template created");
  }

  const filteredLogs =
    logFilter === "All" ? logs : logs.filter((l) => l.status === logFilter);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-7 w-7 text-green-400" />
        <h1 className="text-2xl font-bold text-foreground">
          WhatsApp Integration
        </h1>
        {connected ? (
          <Badge className="bg-green-500/20 text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Connected
          </Badge>
        ) : (
          <Badge className="bg-red-500/20 text-red-400 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Disconnected
          </Badge>
        )}
      </div>

      <Tabs defaultValue="setup">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="log">Message Log</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4 space-y-6">
          {/* Web WhatsApp button */}
          <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div>
              <p className="font-semibold text-foreground">Open Web WhatsApp</p>
              <p className="text-sm text-muted-foreground">
                Send messages directly from your browser via WhatsApp Web
              </p>
            </div>
            <Button
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={() => window.open("https://web.whatsapp.com", "_blank")}
            >
              <ExternalLink className="h-4 w-4" />🌐 Open Web WhatsApp
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Business API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Business Phone Number</Label>
                  <Input
                    placeholder="+91 98xxx xxxxx"
                    value={settings.phone}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>WhatsApp Business API Key</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={settings.apiKey}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, apiKey: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Webhook URL (Read-only)</Label>
                <Input
                  readOnly
                  className="bg-muted font-mono text-xs"
                  value={webhookUrl}
                />
              </div>
              <Button onClick={saveSettings}>Save &amp; Connect</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send Test Message</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="+91 98xxx xxxxx"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </div>
                <div className="w-48">
                  <Label>Template</Label>
                  <Select value={testTemplate} onValueChange={setTestTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates
                        .filter((t) => t.active)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.name}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={sendTest}>Send Test</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setShowNewTemplate((v) => !v)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </div>

          {showNewTemplate && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-sm">Create New Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Template Name</Label>
                  <Input
                    placeholder="e.g. Loyalty Points"
                    value={newTplName}
                    onChange={(e) => setNewTplName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Use {name}, {amount}, {date} as variables..."
                    value={newTplMessage}
                    onChange={(e) => setNewTplMessage(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNewTemplate}>
                    Save Template
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNewTemplate(false);
                      setNewTplName("");
                      setNewTplMessage("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{t.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {t.usageCount} uses
                      </Badge>
                      <Badge
                        className={
                          t.active
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        }
                      >
                        {t.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {editingId === t.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(t.id)}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                        {t.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end shrink-0">
                    <Switch
                      checked={t.active}
                      onCheckedChange={(v) =>
                        setTemplates((prev) =>
                          prev.map((x) =>
                            x.id === t.id ? { ...x, active: v } : x,
                          ),
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(t.id);
                        setEditMessage(t.message);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <div className="flex gap-2 mb-4">
            {(["All", "Sent", "Delivered", "Failed"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={logFilter === f ? "default" : "outline"}
                onClick={() => setLogFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>To</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-sm">
                        {l.to}
                      </TableCell>
                      <TableCell>{l.customer}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.template}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.sentAt}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor[l.status]}>
                          {l.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { WhatsAppIntegration };
