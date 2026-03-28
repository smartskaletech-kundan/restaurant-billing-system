export interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: "admin" | "staff";
  permissions: {
    billing: boolean;
    reports: boolean;
    menu: boolean;
    business: boolean;
  };
  active: boolean;
  createdAt: string;
}

export const MAX_STAFF_USERS = 4;

export function getStaffUsers(restaurantId: string): StaffUser[] {
  try {
    const raw = localStorage.getItem(`${restaurantId}_staff_users`);
    return raw ? (JSON.parse(raw) as StaffUser[]) : [];
  } catch {
    return [];
  }
}

export function saveStaffUsers(restaurantId: string, users: StaffUser[]): void {
  localStorage.setItem(`${restaurantId}_staff_users`, JSON.stringify(users));
}

export function hashStaffPassword(
  password: string,
  restaurantId: string,
  username: string,
): string {
  return btoa(password + restaurantId + username);
}

export function findStaffUser(
  restaurantId: string,
  username: string,
  password: string,
): StaffUser | null {
  const users = getStaffUsers(restaurantId);
  const user = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (!user) return null;
  const hash = hashStaffPassword(password, restaurantId, user.username);
  if (user.passwordHash !== hash) return null;
  return user;
}
