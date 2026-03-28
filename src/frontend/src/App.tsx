import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertCircle,
  BarChart2,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChefHat,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Gift,
  Grid3x3,
  History,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  Package,
  QrCode,
  Receipt,
  Settings as SettingsIcon,
  ShoppingCart,
  Smartphone,
  Tag,
  Ticket,
  Truck,
  UserCog,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { RestaurantProvider, useRestaurant } from "./context/RestaurantContext";
import { AdminPanel } from "./pages/AdminPanel";
import { AttendancePayroll } from "./pages/AttendancePayroll";
import { BanquetBilling } from "./pages/BanquetBilling";
import { BanquetReservations } from "./pages/BanquetReservations";
import { BillHistory } from "./pages/BillHistory";
import { Billing } from "./pages/Billing";
import { CouponManagement } from "./pages/CouponManagement";
import { Customers } from "./pages/Customers";
import { Dashboard } from "./pages/Dashboard";
import { DueManagement } from "./pages/DueManagement";
import { Expenses } from "./pages/Expenses";
import { GSTReports } from "./pages/GSTReports";
import { GiftCards } from "./pages/GiftCards";
import { Inventory } from "./pages/Inventory";
import { KitchenDisplay } from "./pages/KitchenDisplay";
import { LoyaltyCRM } from "./pages/LoyaltyCRM";
import { MenuManagement } from "./pages/MenuManagement";
import { NightAudit } from "./pages/NightAudit";
import { OrderManagement } from "./pages/OrderManagement";
import { Purchases } from "./pages/Purchases";
import { QRMenu } from "./pages/QRMenu";
import { ReceiptRegister } from "./pages/ReceiptRegister";
import { Reports } from "./pages/Reports";
import { RestaurantLogin } from "./pages/RestaurantLogin";
import { RestaurantSetup } from "./pages/RestaurantSetup";
import { Settings } from "./pages/Settings";
import { TableManagement } from "./pages/TableManagement";
import { UserManagement } from "./pages/UserManagement";
import { Vendors } from "./pages/Vendors";
import { WhatsAppIntegration } from "./pages/WhatsAppIntegration";
import { ZomatoSwiggy } from "./pages/ZomatoSwiggy";

export type Page =
  | "dashboard"
  | "tables"
  | "orders"
  | "kitchen"
  | "menu"
  | "billing"
  | "banquet-billing"
  | "banquet-reservations"
  | "history"
  | "settings"
  | "customers"
  | "inventory"
  | "expenses"
  | "receipt-register"
  | "due-management"
  | "vendors"
  | "purchases"
  | "reports"
  | "gst-reports"
  | "qr-menu"
  | "zomato-swiggy"
  | "loyalty-crm"
  | "gift-cards"
  | "coupon-management"
  | "attendance-payroll"
  | "whatsapp"
  | "night-audit"
  | "user-management";

export interface SelectedTable {
  id: string;
  name: string;
}

export interface SelectedOrder {
  id: string;
  tableId: string;
  tableName: string;
}

interface NavItem {
  page: Page;
  label: string;
  Icon: LucideIcon;
  permissionKey?: "billing" | "reports" | "menu" | "business";
  adminOnly?: boolean;
}

interface NavSection {
  title: string | null;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      { page: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
      {
        page: "tables",
        label: "Table Management",
        Icon: Grid3x3,
        permissionKey: "billing",
      },
      {
        page: "orders",
        label: "Order Management",
        Icon: ClipboardList,
        permissionKey: "billing",
      },
      {
        page: "kitchen",
        label: "Kitchen Display",
        Icon: ChefHat,
        permissionKey: "billing",
      },
      {
        page: "menu",
        label: "Menu Management",
        Icon: UtensilsCrossed,
        permissionKey: "menu",
      },
      {
        page: "billing",
        label: "Billing",
        Icon: Receipt,
        permissionKey: "billing",
      },
      {
        page: "history",
        label: "Bill History",
        Icon: History,
        permissionKey: "billing",
      },
      {
        page: "banquet-billing",
        label: "Banquet Billing",
        Icon: Building2,
        permissionKey: "billing",
      },
      {
        page: "banquet-reservations",
        label: "Banquet Reservations",
        Icon: CalendarCheck,
        permissionKey: "billing",
      },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      {
        page: "customers",
        label: "Customers",
        Icon: Users,
        permissionKey: "business",
      },
      {
        page: "inventory",
        label: "Inventory",
        Icon: Package,
        permissionKey: "menu",
      },
      {
        page: "expenses",
        label: "Expenses",
        Icon: CreditCard,
        permissionKey: "business",
      },
      {
        page: "receipt-register",
        label: "Receipt Register",
        Icon: FileText,
        permissionKey: "reports",
      },
      {
        page: "due-management",
        label: "Due Management",
        Icon: AlertCircle,
        permissionKey: "reports",
      },
      {
        page: "vendors",
        label: "Vendors",
        Icon: Truck,
        permissionKey: "business",
      },
      {
        page: "purchases",
        label: "Purchases",
        Icon: ShoppingCart,
        permissionKey: "business",
      },
      {
        page: "night-audit",
        label: "Night Audit",
        Icon: Moon,
        permissionKey: "reports",
      },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      {
        page: "reports",
        label: "Reports",
        Icon: BarChart2,
        permissionKey: "reports",
      },
      {
        page: "gst-reports",
        label: "GST Reports",
        Icon: FileSpreadsheet,
        permissionKey: "reports",
      },
    ],
  },
  {
    title: "INTEGRATIONS & CRM",
    items: [
      { page: "qr-menu", label: "QR Menu & Orders", Icon: QrCode },
      { page: "zomato-swiggy", label: "Zomato & Swiggy", Icon: Smartphone },
      { page: "loyalty-crm", label: "Loyalty & CRM", Icon: Gift },
      { page: "gift-cards", label: "Gift Cards", Icon: Tag },
      { page: "coupon-management", label: "Coupon Management", Icon: Ticket },
    ],
  },
  {
    title: "HR & PAYROLL",
    items: [
      {
        page: "attendance-payroll",
        label: "Attendance & Payroll",
        Icon: CalendarDays,
      },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { page: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
      {
        page: "user-management",
        label: "User Management",
        Icon: UserCog,
        adminOnly: true,
      },
    ],
  },
];

const SETTINGS_NAV: NavItem = {
  page: "settings",
  label: "Settings",
  Icon: SettingsIcon,
  adminOnly: true,
};

const ALL_ITEMS: NavItem[] = [
  ...NAV_SECTIONS.flatMap((s) => s.items),
  SETTINGS_NAV,
];

function AppShell() {
  const { restaurantId, restaurantName, isLoggedIn, logout, currentUser } =
    useRestaurant();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [showSetup, setShowSetup] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(
    null,
  );
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrder | null>(
    null,
  );

  const isOwner = currentUser === null;

  // Show admin panel
  if (showAdmin) {
    return <AdminPanel onBack={() => setShowAdmin(false)} />;
  }

  // Show setup or login page when not authenticated
  if (!isLoggedIn) {
    if (showSetup) {
      return <RestaurantSetup onLoginClick={() => setShowSetup(false)} />;
    }
    return (
      <RestaurantLogin
        onSetupClick={() => setShowSetup(true)}
        onAdminClick={() => setShowAdmin(true)}
      />
    );
  }

  const navigateTo = (
    page: Page,
    table?: SelectedTable,
    order?: SelectedOrder,
  ) => {
    setCurrentPage(page);
    if (table) {
      setSelectedTable(table);
    } else if (page !== "billing" && page !== "orders") {
      setSelectedTable(null);
    }
    if (order) {
      setSelectedOrder(order);
    } else if (page !== "billing" && page !== "orders") {
      setSelectedOrder(null);
    }
  };

  // Permission gate for nav items
  const canSee = (item: NavItem): boolean => {
    if (item.adminOnly && !isOwner) return false;
    if (item.permissionKey && !isOwner) {
      return currentUser?.permissions[item.permissionKey] === true;
    }
    return true;
  };

  const activeLabel =
    ALL_ITEMS.find((n) => n.page === currentPage)?.label ?? "";

  const avatarInitials = restaurantId.slice(0, 2).toUpperCase() || "RS";
  const displayName =
    restaurantName.length > 18
      ? `${restaurantName.slice(0, 18)}\u2026`
      : restaurantName;

  const userDisplayName = currentUser
    ? currentUser.displayName
    : restaurantName || "Admin";
  const userRole = currentUser ? "Staff" : "Admin";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className="sidebar-gradient w-64 flex-shrink-0 flex flex-col no-print"
        aria-label="Sidebar navigation"
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">
              {avatarInitials[0] || "S"}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">
                {displayName || "SMARTSKALE"}
              </p>
              <p className="text-white/50 text-xs">Restaurant POS</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(canSee);
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title ?? "pos"} className="mb-1">
                {section.title && (
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider px-3 pt-4 pb-1">
                    {section.title}
                  </p>
                )}
                {visibleItems.map(({ page, label, Icon }) => (
                  <button
                    key={page}
                    type="button"
                    data-ocid={`nav.${page}.link`}
                    onClick={() => navigateTo(page)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                      currentPage === page
                        ? "bg-white/15 text-white font-medium"
                        : "text-white/65 hover:bg-white/8 hover:text-white/90"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            );
          })}

          {/* Settings at bottom of nav — admin only */}
          {isOwner && (
            <div className="border-t border-white/10 mt-2 pt-2">
              <button
                type="button"
                data-ocid="nav.settings.link"
                onClick={() => navigateTo("settings")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  currentPage === "settings"
                    ? "bg-white/15 text-white font-medium"
                    : "text-white/65 hover:bg-white/8 hover:text-white/90"
                }`}
              >
                <SettingsIcon className="h-4 w-4 flex-shrink-0" />
                <span>Settings</span>
              </button>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          <button
            type="button"
            data-ocid="nav.logout.button"
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/8 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout</span>
          </button>
          <p className="text-white/35 text-xs text-center">
            &copy; {new Date().getFullYear()}.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/60 transition-colors"
            >
              Built with caffeine.ai
            </a>
          </p>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border h-14 flex items-center px-6 flex-shrink-0 no-print">
          <h1 className="text-foreground font-semibold text-base flex-1">
            {activeLabel}
          </h1>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                data-ocid="header.user_menu.button"
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-accent transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold">
                  {userDisplayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium leading-none">
                    {userDisplayName.length > 14
                      ? `${userDisplayName.slice(0, 14)}…`
                      : userDisplayName}
                  </p>
                </div>
                <Badge
                  variant={isOwner ? "default" : "secondary"}
                  className="text-xs"
                >
                  {userRole}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  data-ocid="header.profile.link"
                  onClick={() => navigateTo("user-management")}
                >
                  <UserCog className="h-4 w-4 mr-2" />
                  My Profile / Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-ocid="header.logout.button"
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {currentPage === "dashboard" && <Dashboard navigateTo={navigateTo} />}
          {currentPage === "tables" && (
            <TableManagement
              navigateTo={navigateTo}
              selectedTable={selectedTable}
              setSelectedTable={setSelectedTable}
            />
          )}
          {currentPage === "orders" && (
            <OrderManagement
              navigateTo={navigateTo}
              selectedTable={selectedTable}
              selectedOrder={selectedOrder}
              setSelectedOrder={setSelectedOrder}
            />
          )}
          {currentPage === "kitchen" && <KitchenDisplay />}
          {currentPage === "menu" && <MenuManagement />}
          {currentPage === "billing" && (
            <Billing
              navigateTo={navigateTo}
              selectedTable={selectedTable}
              selectedOrder={selectedOrder}
            />
          )}
          {currentPage === "history" && <BillHistory />}
          {currentPage === "banquet-billing" && <BanquetBilling />}
          {currentPage === "banquet-reservations" && <BanquetReservations />}
          {currentPage === "settings" && isOwner && <Settings />}
          {currentPage === "customers" && <Customers />}
          {currentPage === "inventory" && <Inventory />}
          {currentPage === "expenses" && <Expenses />}
          {currentPage === "receipt-register" && <ReceiptRegister />}
          {currentPage === "due-management" && <DueManagement />}
          {currentPage === "vendors" && <Vendors />}
          {currentPage === "purchases" && <Purchases />}
          {currentPage === "reports" && <Reports />}
          {currentPage === "gst-reports" && <GSTReports />}
          {currentPage === "qr-menu" && <QRMenu />}
          {currentPage === "zomato-swiggy" && <ZomatoSwiggy />}
          {currentPage === "loyalty-crm" && <LoyaltyCRM />}
          {currentPage === "gift-cards" && <GiftCards />}
          {currentPage === "coupon-management" && <CouponManagement />}
          {currentPage === "attendance-payroll" && <AttendancePayroll />}
          {currentPage === "whatsapp" && <WhatsAppIntegration />}
          {currentPage === "night-audit" && <NightAudit />}
          {currentPage === "user-management" && <UserManagement />}
        </main>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}

export default function App() {
  return (
    <RestaurantProvider>
      <AppShell />
    </RestaurantProvider>
  );
}
