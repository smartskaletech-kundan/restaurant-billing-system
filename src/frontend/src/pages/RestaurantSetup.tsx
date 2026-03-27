import { Badge } from "@/components/ui/badge";
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
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useRestaurant } from "../context/RestaurantContext";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 20)
    .replace(/^-+|-+$/g, "");
}

interface Props {
  onLoginClick: () => void;
}

export function RestaurantSetup({ onLoginClick }: Props) {
  const { setupRestaurant } = useRestaurant();
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleNameChange = (val: string) => {
    setRestaurantName(val);
    setRestaurantId(slugify(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !restaurantName || !ownerName || !password) {
      toast.error("Please fill all fields");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{0,19}$/.test(restaurantId)) {
      toast.error(
        "Restaurant ID must be lowercase alphanumeric with hyphens, max 20 chars",
      );
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const success = setupRestaurant(
      restaurantId,
      restaurantName,
      ownerName,
      password,
    );
    if (!success) {
      toast.error(
        `Restaurant ID "${restaurantId}" is already taken. Please choose a different ID.`,
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
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
            Restaurant Management Platform
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/60 backdrop-blur shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">
              Set Up Your Restaurant
            </CardTitle>
            <CardDescription className="text-slate-400">
              Create your restaurant account to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Restaurant Name</Label>
                <Input
                  data-ocid="setup.name.input"
                  value={restaurantName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Spice Garden Restaurant"
                  className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300">Restaurant ID</Label>
                <Input
                  data-ocid="setup.id.input"
                  value={restaurantId}
                  onChange={(e) =>
                    setRestaurantId(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "")
                        .slice(0, 20),
                    )
                  }
                  placeholder="auto-generated-from-name"
                  className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary font-mono"
                  required
                />
                {restaurantId && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className="text-xs border-primary/40 text-primary"
                    >
                      ID Preview: {restaurantId}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      This cannot be changed later
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300">Owner Name</Label>
                <Input
                  data-ocid="setup.owner.input"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Your full name"
                  className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300">Password</Label>
                <Input
                  data-ocid="setup.password.input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300">Confirm Password</Label>
                <Input
                  data-ocid="setup.confirm_password.input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                  required
                />
              </div>

              <Button
                data-ocid="setup.submit_button"
                type="submit"
                className="w-full mt-2"
                size="lg"
                disabled={loading}
              >
                {loading
                  ? "Creating Account..."
                  : "🚀 Create Restaurant Account"}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onLoginClick}
                data-ocid="setup.login.link"
                className="text-sm text-slate-400 hover:text-primary transition-colors"
              >
                Already have an account?{" "}
                <span className="text-primary font-medium">Sign In</span>
              </button>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-slate-700/40 border border-slate-600/50">
              <p className="text-xs text-slate-500 text-center">
                🔒 Each restaurant deployment is fully isolated
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
