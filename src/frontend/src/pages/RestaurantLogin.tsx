import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { ADMIN_EMAIL, useRestaurant } from "../context/RestaurantContext";

interface Props {
  onSetupClick: () => void;
  onAdminClick: () => void;
}

export function RestaurantLogin({ onSetupClick, onAdminClick }: Props) {
  const { login, staffLogin } = useRestaurant();

  // Owner login
  const [restaurantId, setRestaurantId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Staff login
  const [staffRestaurantId, setStaffRestaurantId] = useState("");
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !password) {
      toast.error("Please enter your Restaurant ID and password");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = login(restaurantId.toLowerCase().trim(), password);
    if (result === "invalid") {
      toast.error("Invalid Restaurant ID or password");
    } else if (result === "pending") {
      toast.warning(
        "Your account is pending approval. Please wait for the software developer to approve your registration.",
        { duration: 6000 },
      );
    } else if (result === "rejected") {
      toast.error(
        `Your registration was rejected. Please contact ${ADMIN_EMAIL} for assistance.`,
        { duration: 8000 },
      );
    }
    setLoading(false);
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffRestaurantId || !staffUsername || !staffPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    setStaffLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = staffLogin(
      staffRestaurantId.toLowerCase().trim(),
      staffUsername.trim(),
      staffPassword,
    );
    if (result === "invalid") {
      toast.error(
        "Invalid credentials. Check Restaurant ID, username, and password.",
      );
    } else if (result === "inactive") {
      toast.error("Your account is inactive. Please contact your admin.");
    } else if (result === "pending") {
      toast.warning("This restaurant is pending approval.", { duration: 6000 });
    } else if (result === "rejected") {
      toast.error("This restaurant registration was rejected.");
    }
    setStaffLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white text-2xl font-bold mb-4 shadow-lg">
            S
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            SmartSkale POS
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Sign in to your restaurant
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/60 backdrop-blur shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Welcome Back</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="owner" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger
                  value="owner"
                  className="flex-1"
                  data-ocid="login.owner_tab"
                >
                  Owner Login
                </TabsTrigger>
                <TabsTrigger
                  value="staff"
                  className="flex-1"
                  data-ocid="login.staff_tab"
                >
                  Staff Login
                </TabsTrigger>
              </TabsList>

              {/* Owner Login */}
              <TabsContent value="owner">
                <form onSubmit={handleOwnerSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Restaurant ID</Label>
                    <Input
                      data-ocid="login.restaurant_id.input"
                      value={restaurantId}
                      onChange={(e) =>
                        setRestaurantId(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        )
                      }
                      placeholder="your-restaurant-id"
                      className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Password</Label>
                    <Input
                      data-ocid="login.password.input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                      required
                    />
                  </div>
                  <Button
                    data-ocid="login.submit_button"
                    type="submit"
                    className="w-full mt-2"
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "🔑 Sign In"}
                  </Button>
                </form>
              </TabsContent>

              {/* Staff Login */}
              <TabsContent value="staff">
                <form onSubmit={handleStaffSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Restaurant ID</Label>
                    <Input
                      data-ocid="login.staff_restaurant_id.input"
                      value={staffRestaurantId}
                      onChange={(e) =>
                        setStaffRestaurantId(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        )
                      }
                      placeholder="your-restaurant-id"
                      className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Username</Label>
                    <Input
                      data-ocid="login.staff_username.input"
                      value={staffUsername}
                      onChange={(e) =>
                        setStaffUsername(e.target.value.toLowerCase())
                      }
                      placeholder="Staff username"
                      className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Password</Label>
                    <Input
                      data-ocid="login.staff_password.input"
                      type="password"
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Your password"
                      className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                      required
                    />
                  </div>
                  <Button
                    data-ocid="login.staff_submit_button"
                    type="submit"
                    className="w-full mt-2"
                    size="lg"
                    disabled={staffLoading}
                  >
                    {staffLoading ? "Signing in..." : "🔑 Staff Sign In"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onSetupClick}
                data-ocid="login.setup.link"
                className="text-sm text-slate-400 hover:text-primary transition-colors"
              >
                New restaurant?{" "}
                <span className="text-primary font-medium">
                  Set up your account
                </span>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700/50 text-center">
              <button
                type="button"
                onClick={onAdminClick}
                data-ocid="login.admin.link"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Shield className="h-3 w-3" />
                Developer Admin Login
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
