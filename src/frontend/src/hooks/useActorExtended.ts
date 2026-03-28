import { useMemo } from "react";
import type {
  Bill,
  BillItem,
  MenuItem,
  Order,
  OrderItem,
  RestaurantSettings,
  Table,
} from "../backend";
import { useActor } from "./useActor";

// Extended backend interface that includes per-restaurant (R-suffix) methods
// added to the Motoko backend. These are not yet in the generated backend.ts wrapper.
export interface BackendExtended {
  // Legacy methods (pass-through)
  getTables(): Promise<Array<Table>>;
  getOrders(): Promise<Array<Order>>;
  getMenuItems(): Promise<Array<MenuItem>>;
  getSettings(): Promise<RestaurantSettings>;
  updateSettings(settings: RestaurantSettings): Promise<void>;
  updateTableStatus(tableId: string, status: string): Promise<Table | null>;
  updateOrderStatus(orderId: string, status: string): Promise<Order | null>;
  getBillsByRestaurant(restaurantId: string): Promise<Array<Bill>>;
  clearRestaurantBills(restaurantId: string): Promise<bigint>;
  resettleBill(billId: string, newMode: string): Promise<Bill | null>;
  updateBill(bill: Bill): Promise<Bill | null>;
  deleteBill(billId: string): Promise<boolean>;
  getBills(): Promise<Array<Bill>>;
  getDueBills(): Promise<Array<Bill>>;
  markBillSettled(billId: string): Promise<Bill | null>;

  // Restaurant-scoped table methods
  getTablesR(restaurantId: string): Promise<Array<Table>>;
  addTableR(restaurantId: string, name: string, seats: bigint): Promise<Table>;
  deleteTableR(restaurantId: string, tableId: string): Promise<boolean>;

  // Restaurant-scoped menu methods
  getMenuItemsR(restaurantId: string): Promise<Array<MenuItem>>;
  addMenuItemR(
    restaurantId: string,
    category: string,
    name: string,
    price: number,
    description: string,
  ): Promise<MenuItem>;
  updateMenuItemR(
    restaurantId: string,
    item: MenuItem,
  ): Promise<[] | [MenuItem]>;
  deleteMenuItemR(restaurantId: string, itemId: string): Promise<boolean>;

  // Restaurant-scoped order methods
  getOrdersR(restaurantId: string): Promise<Array<Order>>;
  getOrderByTableR(
    restaurantId: string,
    tableId: string,
  ): Promise<[] | [Order]>;
  createOrderR(
    restaurantId: string,
    tableId: string,
    tableName: string,
    items: Array<OrderItem>,
    instructions: string,
  ): Promise<Order>;
  updateOrderItemsR(
    restaurantId: string,
    orderId: string,
    items: Array<OrderItem>,
  ): Promise<[] | [Order]>;
  updateOrderStatusR(
    restaurantId: string,
    orderId: string,
    status: string,
  ): Promise<[] | [Order]>;

  // Restaurant-scoped settings
  getSettingsR(restaurantId: string): Promise<RestaurantSettings>;
  updateSettingsR(
    restaurantId: string,
    settings: RestaurantSettings,
  ): Promise<undefined>;

  // Restaurant-scoped billing
  createBillR(
    restaurantId: string,
    orderId: string,
    tableId: string,
    tableName: string,
    items: Array<BillItem>,
    subtotal: number,
    taxAmount: number,
    discount: number,
    total: number,
    settlementMode: string,
    cashierName: string,
  ): Promise<Bill>;
  clearRestaurantBillsAndReset(restaurantId: string): Promise<bigint>;
  resetBillCounter(): Promise<undefined>;
}

/**
 * Returns the actor with a Proxy that first checks the Backend wrapper,
 * then falls back to the raw Candid actor for R-suffix methods.
 *
 * IMPORTANT: The proxy is memoized with useMemo so the actor reference is
 * stable across renders. Without this, every render creates a new Proxy
 * object which causes useEffect hooks depending on `actor` to re-run on
 * every render, resulting in infinite loading loops.
 */
export function useActorExtended() {
  const { actor, isFetching } = useActor();

  const extendedActor = useMemo(() => {
    if (!actor) return null;

    const rawActor = (actor as unknown as { actor: unknown }).actor;

    return new Proxy(actor as object, {
      get(target, prop, receiver) {
        // First try the Backend wrapper (handles legacy methods like getBills, etc.)
        const wrapperVal = Reflect.get(target, prop, receiver);
        if (wrapperVal !== undefined) return wrapperVal;
        // Fall back to the raw Candid actor for R-suffix methods
        if (rawActor && typeof prop === "string") {
          const rawVal = (rawActor as Record<string, unknown>)[prop];
          if (typeof rawVal === "function") {
            return rawVal.bind(rawActor);
          }
        }
        return undefined;
      },
    }) as unknown as BackendExtended;
  }, [actor]);

  return {
    actor: extendedActor,
    isFetching,
  };
}
