import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface BillItem {
    name: string;
    quantity: bigint;
    price: number;
    subtotal: number;
}
export interface MenuItem {
    id: string;
    name: string;
    description: string;
    available: boolean;
    category: string;
    price: number;
}
export interface Table {
    id: string;
    status: string;
    name: string;
    seats: bigint;
}
export interface RestaurantSettings {
    name: string;
    footerMessage: string;
    currency: string;
    address: string;
    phone: string;
    taxRate: number;
}
export interface Bill {
    id: string;
    total: number;
    settled: boolean;
    createdAt: bigint;
    tableId: string;
    orderId: string;
    billNumber: bigint;
    discount: number;
    tableName: string;
    items: Array<BillItem>;
    taxAmount: number;
    subtotal: number;
    settlementMode: string;
    cashierName: string;
    restaurantId: string;
}
export interface OrderItem {
    name: string;
    note: string;
    quantity: bigint;
    price: number;
    menuItemId: string;
}
export interface Order {
    id: string;
    status: string;
    createdAt: bigint;
    tableId: string;
    specialInstructions: string;
    tableName: string;
    items: Array<OrderItem>;
}
export interface backendInterface {
    addMenuItem(category: string, itemName: string, itemPrice: number, itemDescription: string): Promise<MenuItem>;
    addTable(tableName: string, seatsCount: bigint): Promise<Table>;
    createBill(orderId: string, tableId: string, tableName: string, billItems: Array<BillItem>, subtotal: number, taxAmount: number, discount: number, total: number, settlementMode: string, cashierName: string, restaurantId: string): Promise<Bill>;
    createOrder(tableId: string, tableName: string, orderItems: Array<OrderItem>, instructions: string): Promise<Order>;
    deleteMenuItem(itemId: string): Promise<boolean>;
    deleteTable(tableId: string): Promise<boolean>;
    getBills(): Promise<Array<Bill>>;
    getBillsByRestaurant(restaurantId: string): Promise<Array<Bill>>;
    clearRestaurantBills(restaurantId: string): Promise<bigint>;
    getMenuItems(): Promise<Array<MenuItem>>;
    getOrderByTable(tableId: string): Promise<Order | null>;
    getOrders(): Promise<Array<Order>>;
    getSettings(): Promise<RestaurantSettings>;
    getTables(): Promise<Array<Table>>;
    markBillSettled(billId: string): Promise<Bill | null>;
    resettleBill(billId: string, newMode: string): Promise<Bill | null>;
    updateBill(bill: Bill): Promise<Bill | null>;
    deleteBill(billId: string): Promise<boolean>;
    updateMenuItem(item: MenuItem): Promise<MenuItem | null>;
    updateOrderItems(orderId: string, items: Array<OrderItem>): Promise<Order | null>;
    updateOrderStatus(orderId: string, newStatus: string): Promise<Order | null>;
    updateSettings(newSettings: RestaurantSettings): Promise<void>;
    updateTableStatus(tableId: string, newStatus: string): Promise<Table | null>;
}
