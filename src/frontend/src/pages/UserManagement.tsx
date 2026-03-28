import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Edit, KeyRound, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRestaurant } from "../context/RestaurantContext";
import {
  MAX_STAFF_USERS,
  type StaffUser,
  getStaffUsers,
  hashStaffPassword,
  saveStaffUsers,
} from "../utils/staffUsers";

const EMPTY_FORM = {
  displayName: "",
  username: "",
  password: "",
  confirmPassword: "",
  billing: true,
  reports: true,
  menu: false,
  business: false,
  active: true,
};

export function UserManagement() {
  const { restaurantId, restaurantName, currentUser, updateOwnerPassword } =
    useRestaurant();

  const [users, setUsers] = useState<StaffUser[]>(() =>
    getStaffUsers(restaurantId),
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [resetPw, setResetPw] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  // Profile tab
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmNewPw, setConfirmNewPw] = useState("");

  const reload = () => setUsers(getStaffUsers(restaurantId));

  const openAdd = () => {
    setEditingUser(null);
    setForm({ ...EMPTY_FORM });
    setShowAddDialog(true);
  };

  const openEdit = (u: StaffUser) => {
    setEditingUser(u);
    setForm({
      displayName: u.displayName,
      username: u.username,
      password: "",
      confirmPassword: "",
      billing: u.permissions.billing,
      reports: u.permissions.reports,
      menu: u.permissions.menu,
      business: u.permissions.business,
      active: u.active,
    });
    setShowAddDialog(true);
  };

  const saveUser = () => {
    if (!form.displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }
    const uname = form.username.toLowerCase().replace(/\s+/g, "");
    const existing = getStaffUsers(restaurantId);

    if (!editingUser) {
      // Adding
      if (existing.length >= MAX_STAFF_USERS) {
        toast.error("Maximum 4 staff users allowed");
        return;
      }
      if (!form.password) {
        toast.error("Password is required");
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (existing.some((u) => u.username === uname)) {
        toast.error("Username already exists");
        return;
      }
      const newUser: StaffUser = {
        id: `staff_${Date.now()}`,
        username: uname,
        displayName: form.displayName.trim(),
        passwordHash: hashStaffPassword(form.password, restaurantId, uname),
        role: "staff",
        permissions: {
          billing: form.billing,
          reports: form.reports,
          menu: form.menu,
          business: form.business,
        },
        active: form.active,
        createdAt: new Date().toISOString(),
      };
      saveStaffUsers(restaurantId, [...existing, newUser]);
      toast.success("Staff user created");
    } else {
      // Editing
      if (form.password && form.password !== form.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      const updated = existing.map((u) => {
        if (u.id !== editingUser.id) return u;
        return {
          ...u,
          displayName: form.displayName.trim(),
          username: uname,
          passwordHash: form.password
            ? hashStaffPassword(form.password, restaurantId, uname)
            : u.passwordHash,
          permissions: {
            billing: form.billing,
            reports: form.reports,
            menu: form.menu,
            business: form.business,
          },
          active: form.active,
        };
      });
      saveStaffUsers(restaurantId, updated);
      toast.success("Staff user updated");
    }
    reload();
    setShowAddDialog(false);
  };

  const doResetPassword = () => {
    if (!resetTarget) return;
    if (!resetPw) {
      toast.error("Enter a new password");
      return;
    }
    if (resetPw !== resetConfirm) {
      toast.error("Passwords do not match");
      return;
    }
    const existing = getStaffUsers(restaurantId);
    const updated = existing.map((u) =>
      u.id === resetTarget.id
        ? {
            ...u,
            passwordHash: hashStaffPassword(
              resetPw,
              restaurantId,
              resetTarget.username,
            ),
          }
        : u,
    );
    saveStaffUsers(restaurantId, updated);
    toast.success("Password reset successfully");
    reload();
    setShowResetDialog(false);
    setResetPw("");
    setResetConfirm("");
  };

  const doDelete = () => {
    if (!deleteTarget) return;
    const existing = getStaffUsers(restaurantId);
    saveStaffUsers(
      restaurantId,
      existing.filter((u) => u.id !== deleteTarget.id),
    );
    toast.success("User deleted");
    reload();
    setShowDeleteDialog(false);
  };

  const handleChangePassword = () => {
    if (!currentPw) {
      toast.error("Enter your current password");
      return;
    }
    if (!newPw) {
      toast.error("Enter a new password");
      return;
    }
    if (newPw !== confirmNewPw) {
      toast.error("New passwords do not match");
      return;
    }

    if (currentUser) {
      // Staff user changing own password
      const existing = getStaffUsers(restaurantId);
      const me = existing.find((u) => u.id === currentUser.id);
      if (!me) return;
      const currentHash = hashStaffPassword(
        currentPw,
        restaurantId,
        me.username,
      );
      if (currentHash !== me.passwordHash) {
        toast.error("Current password is incorrect");
        return;
      }
      const updated = existing.map((u) =>
        u.id === me.id
          ? {
              ...u,
              passwordHash: hashStaffPassword(newPw, restaurantId, me.username),
            }
          : u,
      );
      saveStaffUsers(restaurantId, updated);
      toast.success("Password changed successfully");
    } else {
      // Owner changing password
      const result = updateOwnerPassword(currentPw, newPw);
      if (result === "invalid") {
        toast.error("Current password is incorrect");
        return;
      }
      toast.success("Password changed successfully");
    }

    setCurrentPw("");
    setNewPw("");
    setConfirmNewPw("");
  };

  const isOwner = currentUser === null;

  return (
    <div className="space-y-6">
      <Tabs defaultValue={isOwner ? "staff" : "profile"}>
        <TabsList>
          {isOwner && <TabsTrigger value="staff">Staff Users</TabsTrigger>}
          <TabsTrigger value="profile">My Profile</TabsTrigger>
        </TabsList>

        {isOwner && (
          <TabsContent value="staff" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Staff Users</CardTitle>
                <div className="flex items-center gap-3">
                  {users.length >= MAX_STAFF_USERS && (
                    <span className="text-xs text-amber-500">
                      Maximum 4 staff users allowed
                    </span>
                  )}
                  <Button
                    data-ocid="user_management.add_user.button"
                    onClick={openAdd}
                    disabled={users.length >= MAX_STAFF_USERS}
                    size="sm"
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <div
                    data-ocid="user_management.empty_state"
                    className="text-center py-10 text-muted-foreground"
                  >
                    <p>No staff users yet. Add up to 4 staff users.</p>
                  </div>
                ) : (
                  <Table data-ocid="user_management.table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u, idx) => (
                        <TableRow
                          key={u.id}
                          data-ocid={`user_management.item.${idx + 1}`}
                        >
                          <TableCell className="font-medium">
                            {u.displayName}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {u.username}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.permissions.billing && (
                                <Badge variant="secondary" className="text-xs">
                                  Billing
                                </Badge>
                              )}
                              {u.permissions.reports && (
                                <Badge variant="secondary" className="text-xs">
                                  Reports
                                </Badge>
                              )}
                              {u.permissions.menu && (
                                <Badge variant="secondary" className="text-xs">
                                  Menu
                                </Badge>
                              )}
                              {u.permissions.business && (
                                <Badge variant="secondary" className="text-xs">
                                  Business
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={u.active ? "default" : "outline"}
                              className="text-xs"
                            >
                              {u.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                data-ocid={`user_management.edit_button.${idx + 1}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(u)}
                                title="Edit User"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                data-ocid={`user_management.reset_password.${idx + 1}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setResetTarget(u);
                                  setResetPw("");
                                  setResetConfirm("");
                                  setShowResetDialog(true);
                                }}
                                title="Reset Password"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                data-ocid={`user_management.delete_button.${idx + 1}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeleteTarget(u);
                                  setShowDeleteDialog(true);
                                }}
                                title="Delete User"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="profile" className="mt-4">
          <div className="grid gap-4 max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-28">
                    Name:
                  </span>
                  <span className="font-medium">
                    {currentUser ? currentUser.displayName : "Owner / Admin"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-28">
                    Role:
                  </span>
                  <Badge variant={currentUser ? "secondary" : "default"}>
                    {currentUser ? "Staff" : "Admin"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-28">
                    Restaurant:
                  </span>
                  <span className="text-sm">{restaurantName}</span>
                </div>
                {currentUser && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-28">
                      Username:
                    </span>
                    <span className="font-mono text-sm">
                      {currentUser.username}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Current Password</Label>
                  <Input
                    data-ocid="user_management.current_password.input"
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-1">
                  <Label>New Password</Label>
                  <Input
                    data-ocid="user_management.new_password.input"
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Confirm New Password</Label>
                  <Input
                    data-ocid="user_management.confirm_password.input"
                    type="password"
                    value={confirmNewPw}
                    onChange={(e) => setConfirmNewPw(e.target.value)}
                    placeholder="Repeat new password"
                  />
                </div>
                <Button
                  data-ocid="user_management.change_password.submit_button"
                  onClick={handleChangePassword}
                  className="w-full"
                >
                  Update Password
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent data-ocid="user_management.dialog" className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit Staff User" : "Add Staff User"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Display Name *</Label>
              <Input
                data-ocid="user_management.display_name.input"
                value={form.displayName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayName: e.target.value }))
                }
                placeholder="e.g. Rahul Sharma"
              />
            </div>
            <div className="space-y-1">
              <Label>Username * (lowercase, no spaces)</Label>
              <Input
                data-ocid="user_management.username.input"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                  }))
                }
                placeholder="e.g. rahul"
              />
            </div>
            <div className="space-y-1">
              <Label>
                {editingUser
                  ? "New Password (leave blank to keep)"
                  : "Password *"}
              </Label>
              <Input
                data-ocid="user_management.password.input"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder="Password"
              />
            </div>
            <div className="space-y-1">
              <Label>Confirm Password</Label>
              <Input
                data-ocid="user_management.confirm_password_field.input"
                type="password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm((f) => ({ ...f, confirmPassword: e.target.value }))
                }
                placeholder="Confirm password"
              />
            </div>

            <div>
              <Label className="mb-2 block">Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["billing", "Billing"],
                    ["reports", "Reports"],
                    ["menu", "Menu Management"],
                    ["business", "Business"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`perm_${key}`}
                      checked={form[key]}
                      onCheckedChange={(v) =>
                        setForm((f) => ({ ...f, [key]: !!v }))
                      }
                    />
                    <label htmlFor={`perm_${key}`} className="text-sm">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="active_toggle"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label htmlFor="active_toggle">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              data-ocid="user_management.dialog.cancel_button"
              onClick={() => setShowAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="user_management.dialog.save_button"
              onClick={saveUser}
            >
              {editingUser ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent data-ocid="user_management.reset_dialog">
          <DialogHeader>
            <DialogTitle>
              Reset Password — {resetTarget?.displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input
                type="password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="New password"
              />
            </div>
            <div className="space-y-1">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              data-ocid="user_management.reset_dialog.cancel_button"
              onClick={() => setShowResetDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="user_management.reset_dialog.confirm_button"
              onClick={doResetPassword}
            >
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent data-ocid="user_management.delete_dialog">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.displayName}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              data-ocid="user_management.delete_dialog.cancel_button"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-ocid="user_management.delete_dialog.confirm_button"
              onClick={doDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
