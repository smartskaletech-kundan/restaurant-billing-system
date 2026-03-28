import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  type StaffUser,
  findStaffUser,
  getStaffUsers,
} from "../utils/staffUsers";

export const ADMIN_EMAIL = "1982rashmikr@gmail.com";
const ADMIN_PW_KEY = "rms_admin_pw";
const DEFAULT_ADMIN_PW = "SmartSkale@2024";

export interface RestaurantProfile {
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  passwordHash: string;
  approvalStatus: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  registeredAt?: string;
}

export type SetupResult = "success" | "duplicate";
export type LoginResult = "approved" | "pending" | "rejected" | "invalid";
export type StaffLoginResult =
  | "success"
  | "invalid"
  | "inactive"
  | "pending"
  | "rejected";
export type UpdatePasswordResult = "success" | "invalid";

interface RestaurantContextType {
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  isLoggedIn: boolean;
  isSetupComplete: boolean;
  currentUser: StaffUser | null;
  setupRestaurant: (
    restaurantId: string,
    restaurantName: string,
    ownerName: string,
    password: string,
  ) => SetupResult;
  login: (restaurantId: string, password: string) => LoginResult;
  staffLogin: (
    restaurantId: string,
    username: string,
    password: string,
  ) => StaffLoginResult;
  logout: () => void;
  updateOwnerPassword: (
    currentPassword: string,
    newPassword: string,
  ) => UpdatePasswordResult;
  approveRestaurant: (id: string) => void;
  rejectRestaurant: (id: string, reason: string) => void;
  getPendingRestaurants: () => RestaurantProfile[];
  getAllRestaurants: () => RestaurantProfile[];
}

const RestaurantContext = createContext<RestaurantContextType | null>(null);

function hashPassword(password: string, restaurantId: string): string {
  return btoa(password + restaurantId);
}

function getProfileKey(restaurantId: string): string {
  return `rms_profile_${restaurantId}`;
}

function loadProfile(restaurantId: string): RestaurantProfile | null {
  try {
    const raw = localStorage.getItem(getProfileKey(restaurantId));
    return raw ? (JSON.parse(raw) as RestaurantProfile) : null;
  } catch {
    return null;
  }
}

function saveProfile(profile: RestaurantProfile): void {
  localStorage.setItem(
    getProfileKey(profile.restaurantId),
    JSON.stringify(profile),
  );
  const allIds = getAllRestaurantIds();
  if (!allIds.includes(profile.restaurantId)) {
    localStorage.setItem(
      "rms_all_ids",
      JSON.stringify([...allIds, profile.restaurantId]),
    );
  }
}

export function getAllRestaurantIds(): string[] {
  try {
    const raw = localStorage.getItem("rms_all_ids");
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function getAdminPassword(): string {
  return localStorage.getItem(ADMIN_PW_KEY) || DEFAULT_ADMIN_PW;
}

export function setAdminPassword(pw: string): void {
  localStorage.setItem(ADMIN_PW_KEY, pw);
}

export function RestaurantProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    try {
      const authRaw = localStorage.getItem("rms_auth");
      if (authRaw) {
        const auth = JSON.parse(authRaw) as {
          restaurantId: string;
          isLoggedIn: boolean;
          staffUserId?: string;
        };
        if (auth.restaurantId && auth.isLoggedIn) {
          const profile = loadProfile(auth.restaurantId);
          if (profile) {
            const status = profile.approvalStatus ?? "approved";
            if (status === "approved") {
              setRestaurantId(profile.restaurantId);
              setRestaurantName(profile.restaurantName);
              setOwnerName(profile.ownerName);
              setIsLoggedIn(true);
              setIsSetupComplete(true);
              // Restore staff user if applicable
              if (auth.staffUserId) {
                const staffUsers = getStaffUsers(profile.restaurantId);
                const staffUser = staffUsers.find(
                  (u) => u.id === auth.staffUserId,
                );
                if (staffUser?.active) {
                  setCurrentUser(staffUser);
                }
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
    setInitialized(true);
  }, []);

  const setupRestaurant = (
    id: string,
    name: string,
    owner: string,
    password: string,
  ): SetupResult => {
    const existing = loadProfile(id);
    if (existing) return "duplicate";
    const profile: RestaurantProfile = {
      restaurantId: id,
      restaurantName: name,
      ownerName: owner,
      passwordHash: hashPassword(password, id),
      approvalStatus: "pending",
      registeredAt: new Date().toISOString(),
    };
    saveProfile(profile);
    return "success";
  };

  const login = (id: string, password: string): LoginResult => {
    const profile = loadProfile(id);
    if (!profile) return "invalid";
    if (profile.passwordHash !== hashPassword(password, id)) return "invalid";
    const status = profile.approvalStatus ?? "approved";
    if (status === "pending") return "pending";
    if (status === "rejected") return "rejected";
    setRestaurantId(profile.restaurantId);
    setRestaurantName(profile.restaurantName);
    setOwnerName(profile.ownerName);
    setIsLoggedIn(true);
    setIsSetupComplete(true);
    setCurrentUser(null);
    localStorage.setItem(
      "rms_auth",
      JSON.stringify({ restaurantId: id, isLoggedIn: true }),
    );
    return "approved";
  };

  const staffLogin = (
    id: string,
    username: string,
    password: string,
  ): StaffLoginResult => {
    const profile = loadProfile(id);
    if (!profile) return "invalid";
    const status = profile.approvalStatus ?? "approved";
    if (status === "pending") return "pending";
    if (status === "rejected") return "rejected";
    const user = findStaffUser(id, username, password);
    if (!user) return "invalid";
    if (!user.active) return "inactive";
    setRestaurantId(profile.restaurantId);
    setRestaurantName(profile.restaurantName);
    setOwnerName(profile.ownerName);
    setIsLoggedIn(true);
    setIsSetupComplete(true);
    setCurrentUser(user);
    localStorage.setItem(
      "rms_auth",
      JSON.stringify({
        restaurantId: id,
        isLoggedIn: true,
        staffUserId: user.id,
      }),
    );
    return "success";
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem("rms_auth");
  };

  const updateOwnerPassword = (
    currentPassword: string,
    newPassword: string,
  ): UpdatePasswordResult => {
    const profile = loadProfile(restaurantId);
    if (!profile) return "invalid";
    if (profile.passwordHash !== hashPassword(currentPassword, restaurantId))
      return "invalid";
    saveProfile({
      ...profile,
      passwordHash: hashPassword(newPassword, restaurantId),
    });
    return "success";
  };

  const approveRestaurant = (id: string) => {
    const profile = loadProfile(id);
    if (!profile) return;
    saveProfile({
      ...profile,
      approvalStatus: "approved",
      rejectionReason: undefined,
    });
  };

  const rejectRestaurant = (id: string, reason: string) => {
    const profile = loadProfile(id);
    if (!profile) return;
    saveProfile({
      ...profile,
      approvalStatus: "rejected",
      rejectionReason: reason,
    });
  };

  const getPendingRestaurants = (): RestaurantProfile[] => {
    return getAllRestaurantIds()
      .map(loadProfile)
      .filter(
        (p): p is RestaurantProfile =>
          p !== null && p.approvalStatus === "pending",
      );
  };

  const getAllRestaurants = (): RestaurantProfile[] => {
    return getAllRestaurantIds()
      .map(loadProfile)
      .filter((p): p is RestaurantProfile => p !== null);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: stable inline functions
  const value = useMemo(
    () => ({
      restaurantId,
      restaurantName,
      ownerName,
      isLoggedIn,
      isSetupComplete,
      currentUser,
      setupRestaurant,
      login,
      staffLogin,
      logout,
      updateOwnerPassword,
      approveRestaurant,
      rejectRestaurant,
      getPendingRestaurants,
      getAllRestaurants,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      restaurantId,
      restaurantName,
      ownerName,
      isLoggedIn,
      isSetupComplete,
      currentUser,
    ],
  );

  if (!initialized)
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant(): RestaurantContextType {
  const ctx = useContext(RestaurantContext);
  if (!ctx)
    throw new Error("useRestaurant must be used within RestaurantProvider");
  return ctx;
}
