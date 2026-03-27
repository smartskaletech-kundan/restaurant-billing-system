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

interface Props {
  onSetupClick: () => void;
}

export function RestaurantLogin({ onSetupClick }: Props) {
  const { login } = useRestaurant();
  const [restaurantId, setRestaurantId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !password) {
      toast.error("Please enter your Restaurant ID and password");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const success = login(restaurantId.toLowerCase().trim(), password);
    if (!success) {
      toast.error("Invalid Restaurant ID or password");
    }
    setLoading(false);
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
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">Welcome Back</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Restaurant ID</Label>
                <Input
                  data-ocid="login.restaurant_id.input"
                  value={restaurantId}
                  onChange={(e) =>
                    setRestaurantId(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
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
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
