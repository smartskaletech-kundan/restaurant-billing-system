import { createContext, useContext, useEffect, useState } from "react";

export interface RestaurantProfile {
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  passwordHash: string;
}

interface RestaurantContextType {
  restaurantId: string;
  restaurantName: string;
  ownerName: string;
  isLoggedIn: boolean;
  isSetupComplete: boolean;
  setupRestaurant: (
    restaurantId: string,
    restaurantName: string,
    ownerName: string,
    password: string,
  ) => boolean;
  login: (restaurantId: string, password: string) => boolean;
  logout: () => void;
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
  // Track all restaurant IDs
  const allIds = getAllRestaurantIds();
  if (!allIds.includes(profile.restaurantId)) {
    localStorage.setItem(
      "rms_all_ids",
      JSON.stringify([...allIds, profile.restaurantId]),
    );
  }
}

function getAllRestaurantIds(): string[] {
  try {
    const raw = localStorage.getItem("rms_all_ids");
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
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
  const [initialized, setInitialized] = useState(false);

  // Restore session on mount
  useEffect(() => {
    try {
      const authRaw = localStorage.getItem("rms_auth");
      if (authRaw) {
        const auth = JSON.parse(authRaw) as {
          restaurantId: string;
          isLoggedIn: boolean;
        };
        if (auth.restaurantId && auth.isLoggedIn) {
          const profile = loadProfile(auth.restaurantId);
          if (profile) {
            setRestaurantId(profile.restaurantId);
            setRestaurantName(profile.restaurantName);
            setOwnerName(profile.ownerName);
            setIsLoggedIn(true);
            setIsSetupComplete(true);
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
  ): boolean => {
    const existing = loadProfile(id);
    if (existing) return false; // Already registered
    const profile: RestaurantProfile = {
      restaurantId: id,
      restaurantName: name,
      ownerName: owner,
      passwordHash: hashPassword(password, id),
    };
    saveProfile(profile);
    setRestaurantId(id);
    setRestaurantName(name);
    setOwnerName(owner);
    setIsLoggedIn(true);
    setIsSetupComplete(true);
    localStorage.setItem(
      "rms_auth",
      JSON.stringify({ restaurantId: id, isLoggedIn: true }),
    );
    return true;
  };

  const login = (id: string, password: string): boolean => {
    const profile = loadProfile(id);
    if (!profile) return false;
    if (profile.passwordHash !== hashPassword(password, id)) return false;
    setRestaurantId(profile.restaurantId);
    setRestaurantName(profile.restaurantName);
    setOwnerName(profile.ownerName);
    setIsLoggedIn(true);
    setIsSetupComplete(true);
    localStorage.setItem(
      "rms_auth",
      JSON.stringify({ restaurantId: id, isLoggedIn: true }),
    );
    return true;
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("rms_auth");
  };

  if (!initialized) return null;

  return (
    <RestaurantContext.Provider
      value={{
        restaurantId,
        restaurantName,
        ownerName,
        isLoggedIn,
        isSetupComplete,
        setupRestaurant,
        login,
        logout,
      }}
    >
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
