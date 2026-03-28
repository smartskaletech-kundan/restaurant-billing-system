import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  ChevronLeft,
  LogOut,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  ADMIN_EMAIL,
  type RestaurantProfile,
  getAdminPassword,
  useRestaurant,
} from "../context/RestaurantContext";

interface Props {
  onBack: () => void;
}

export function AdminPanel({ onBack }: Props) {
  const { approveRestaurant, rejectRestaurant, getAllRestaurants } =
    useRestaurant();
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => {
    return localStorage.getItem("rms_admin_auth") === "true";
  });
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<RestaurantProfile[]>(() =>
    getAllRestaurants(),
  );
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const refreshData = () => {
    setRestaurants(getAllRestaurants());
    toast.success("Data refreshed");
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    if (email === ADMIN_EMAIL && password === getAdminPassword()) {
      localStorage.setItem("rms_admin_auth", "true");
      setAdminLoggedIn(true);
      setRestaurants(getAllRestaurants());
    } else {
      toast.error("Invalid admin credentials");
    }
    setLoginLoading(false);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("rms_admin_auth");
    setAdminLoggedIn(false);
  };

  const handleApprove = (id: string) => {
    approveRestaurant(id);
    setRestaurants(getAllRestaurants());
    toast.success(`Restaurant "${id}" approved successfully`);
  };

  const handleRejectConfirm = () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }
    rejectRestaurant(rejectTarget, rejectReason.trim());
    setRestaurants(getAllRestaurants());
    toast.success(`Restaurant "${rejectTarget}" rejected`);
    setRejectTarget(null);
    setRejectReason("");
  };

  const pending = restaurants.filter((r) => r.approvalStatus === "pending");

  const statusBadge = (r: RestaurantProfile) => {
    if (r.approvalStatus === "approved" || !r.approvalStatus) {
      return (
        <Badge className="bg-green-600/20 text-green-400 border-green-600/30 border">
          Approved
        </Badge>
      );
    }
    if (r.approvalStatus === "rejected") {
      return (
        <Badge className="bg-red-600/20 text-red-400 border-red-600/30 border">
          Rejected
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 border">
        Pending
      </Badge>
    );
  };

  if (!adminLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-700 text-slate-300 mb-4 shadow-lg">
              <Shield className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Developer Admin
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              SmartSkale POS — Admin Portal
            </p>
          </div>

          <Card className="border-slate-700 bg-slate-800/60 backdrop-blur shadow-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-lg">Admin Login</CardTitle>
              <CardDescription className="text-slate-400">
                Restricted to authorized developers only
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Admin Email</Label>
                  <Input
                    data-ocid="admin.email.input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Password</Label>
                  <Input
                    data-ocid="admin.password.input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Admin password"
                    className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                    required
                  />
                </div>
                <Button
                  data-ocid="admin.login.submit_button"
                  type="submit"
                  className="w-full mt-2"
                  size="lg"
                  disabled={loginLoading}
                >
                  {loginLoading ? "Verifying..." : "🔐 Admin Sign In"}
                </Button>
              </form>
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={onBack}
                  data-ocid="admin.back.link"
                  className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-primary transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back to Restaurant Login
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-white font-bold text-lg">
            Developer Admin Panel
          </h1>
          {pending.length > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 border ml-2">
              {pending.length} Pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshData}
            data-ocid="admin.refresh.button"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdminLogout}
            data-ocid="admin.logout.button"
            className="border-slate-600 text-slate-300 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Logout
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {restaurants.length === 0 ? (
          <div
            data-ocid="admin.restaurants.empty_state"
            className="text-center py-16 text-slate-500"
          >
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No restaurant registrations yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-400 text-sm mb-4">
              {restaurants.length} restaurant
              {restaurants.length !== 1 ? "s" : ""} registered
              {pending.length > 0 && (
                <span className="text-amber-400 ml-2">
                  • {pending.length} awaiting approval
                </span>
              )}
            </p>

            {restaurants.map((r, i) => (
              <motion.div
                key={r.restaurantId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                data-ocid={`admin.restaurants.item.${i + 1}`}
              >
                <Card className="border-slate-700 bg-slate-800/50">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-semibold text-sm">
                            {r.restaurantName}
                          </h3>
                          {statusBadge(r)}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span>
                            ID:{" "}
                            <span className="font-mono text-slate-300">
                              {r.restaurantId}
                            </span>
                          </span>
                          <span>Owner: {r.ownerName}</span>
                          {r.registeredAt && (
                            <span>
                              Registered:{" "}
                              {new Date(r.registeredAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          )}
                          {r.approvalStatus === "rejected" &&
                            r.rejectionReason && (
                              <span className="text-red-400">
                                Reason: {r.rejectionReason}
                              </span>
                            )}
                        </div>
                      </div>

                      {(r.approvalStatus === "pending" ||
                        !r.approvalStatus) && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(r.restaurantId)}
                            data-ocid={`admin.approve.button.${i + 1}`}
                            className="bg-green-600 hover:bg-green-500 text-white text-xs h-8"
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setRejectTarget(r.restaurantId);
                              setRejectReason("");
                            }}
                            data-ocid={`admin.reject.button.${i + 1}`}
                            className="text-xs h-8"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent
          data-ocid="admin.reject.dialog"
          className="bg-slate-800 border-slate-700 text-white"
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              Reject Registration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-400">
              Rejecting restaurant:{" "}
              <span className="text-slate-200 font-mono">{rejectTarget}</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Rejection Reason</Label>
              <Textarea
                data-ocid="admin.reject.textarea"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              data-ocid="admin.reject.cancel_button"
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              data-ocid="admin.reject.confirm_button"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
