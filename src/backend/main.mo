import Text "mo:core/Text";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Iter "mo:core/Iter";
import Float "mo:core/Float";
import Outcall "./http-outcalls/outcall";

actor {
  // ─── Types ────────────────────────────────────────────────
  type Table = { id : Text; name : Text; seats : Nat; status : Text };

  type MenuItem = {
    id : Text; category : Text; name : Text;
    price : Float; description : Text; available : Bool;
  };

  type OrderItem = {
    menuItemId : Text; name : Text; quantity : Nat;
    price : Float; note : Text;
  };

  type Order = {
    id : Text; tableId : Text; tableName : Text;
    items : [OrderItem]; status : Text;
    createdAt : Int; specialInstructions : Text;
  };

  type BillItem = { name : Text; quantity : Nat; price : Float; subtotal : Float };

  // BillCore: original schema — MUST NOT be changed to preserve stable-memory compatibility
  type BillCore = {
    id : Text; billNumber : Nat; orderId : Text;
    tableId : Text; tableName : Text; items : [BillItem];
    subtotal : Float; taxAmount : Float; discount : Float; total : Float;
    createdAt : Int; settled : Bool;
  };

  // BillMeta: settlement mode + cashier (separate map, added in v2)
  type BillMeta = { settlementMode : Text; cashierName : Text };

  // Bill: full public type returned to frontend
  type Bill = {
    id : Text; billNumber : Nat; orderId : Text;
    tableId : Text; tableName : Text; items : [BillItem];
    subtotal : Float; taxAmount : Float; discount : Float; total : Float;
    createdAt : Int; settled : Bool;
    settlementMode : Text; cashierName : Text; restaurantId : Text;
  };

  type RestaurantSettings = {
    name : Text; address : Text; phone : Text;
    taxRate : Float; currency : Text; footerMessage : Text;
  };

  type Customer = {
    id : Text; name : Text; phone : Text; email : Text;
    address : Text; loyaltyPoints : Nat; visitCount : Nat; createdAt : Int;
  };

  type InventoryItem = {
    id : Text; name : Text; category : Text; quantity : Float;
    unit : Text; reorderLevel : Float; costPrice : Float; updatedAt : Int;
  };

  type Expense = {
    id : Text; category : Text; description : Text;
    amount : Float; date : Int; paidBy : Text;
  };

  type Vendor = {
    id : Text; name : Text; contactPerson : Text; phone : Text;
    email : Text; address : Text; category : Text;
    balanceDue : Float; createdAt : Int;
  };

  type PurchaseItem = {
    name : Text; quantity : Float; unit : Text;
    unitPrice : Float; subtotal : Float;
  };

  type Purchase = {
    id : Text; vendorId : Text; vendorName : Text;
    items : [PurchaseItem]; totalAmount : Float;
    date : Int; paymentStatus : Text; notes : Text;
  };

  type SmsConfig = {
    provider : Text;
    apiKey : Text;
    accountSid : Text;
    senderId : Text;
    templateId : Text;
    enabled : Bool;
  };

  type OtpResult = { success : Bool; response : Text };

  // ─── Seed Data ──────────────────────────────────────────────────
  func generateDefaultTables() : [Table] {
    let tableIter = Nat.range(1, 10);
    tableIter.map(func(i) {
      { id = "T" # i.toText(); name = "Table " # i.toText(); seats = 4; status = "available" }
    }).toArray();
  };

  let defaultMenuItems : [MenuItem] = [
    { id = "ITEM-1"; category = "Starters"; name = "Spring Rolls"; price = 5.99; description = "Crispy vegetable spring rolls"; available = true },
    { id = "ITEM-2"; category = "Starters"; name = "Chicken Wings"; price = 7.49; description = "Spicy buffalo wings"; available = true },
    { id = "ITEM-3"; category = "Starters"; name = "Bruschetta"; price = 6.25; description = "Grilled bread with tomato topping"; available = true },
    { id = "ITEM-4"; category = "Mains"; name = "Grilled Salmon"; price = 14.99; description = "Salmon fillet with lemon butter"; available = true },
    { id = "ITEM-5"; category = "Mains"; name = "Ribeye Steak"; price = 18.75; description = "Juicy ribeye steak"; available = true },
    { id = "ITEM-6"; category = "Mains"; name = "Vegetarian Pasta"; price = 12.50; description = "Pasta with fresh vegetables"; available = true },
    { id = "ITEM-7"; category = "Mains"; name = "Paneer Tikka Masala"; price = 12.50; description = "Indian cottage cheese in spicy gravy"; available = true },
    { id = "ITEM-8"; category = "Beverages"; name = "Coffee"; price = 2.99; description = "Hot brewed coffee"; available = true },
    { id = "ITEM-9"; category = "Beverages"; name = "Lemonade"; price = 3.25; description = "Freshly squeezed lemonade"; available = true },
    { id = "ITEM-10"; category = "Beverages"; name = "Soft Drink"; price = 2.50; description = "Assorted sodas"; available = true },
    { id = "ITEM-11"; category = "Desserts"; name = "Chocolate Cake"; price = 6.99; description = "Rich chocolate cake"; available = true },
    { id = "ITEM-12"; category = "Desserts"; name = "Ice Cream Sundae"; price = 5.75; description = "Ice cream with toppings"; available = true },
  ];

  let defaultSettings : RestaurantSettings = {
    name = "SMARTSKALE";
    address = "NOIDA (UP) INDIA - 201301";
    phone = "";
    taxRate = 5.0;
    currency = "INR";
    footerMessage = "Thank you for dining with us!";
  };

  let defaultSmsConfig : SmsConfig = {
    provider = "msg91";
    apiKey = "";
    accountSid = "";
    senderId = "RESTAL";
    templateId = "";
    enabled = false;
  };

  // ─── Persistent State (existing — do not reorder) ─────────────────────
  let tables = Map.empty<Text, Table>();
  let menuItems = Map.empty<Text, MenuItem>();
  let orders = Map.empty<Text, Order>();
  let bills = Map.empty<Text, BillCore>();
  let billMeta = Map.empty<Text, BillMeta>();
  let billRestaurantIds = Map.empty<Text, Text>();
  let customers = Map.empty<Text, Customer>();
  let inventoryItems = Map.empty<Text, InventoryItem>();
  let expenses = Map.empty<Text, Expense>();
  let vendors = Map.empty<Text, Vendor>();
  let purchases = Map.empty<Text, Purchase>();
  var settings = defaultSettings;
  var billCounter = 1;
  var smsConfig = defaultSmsConfig;

  // ─── NEW: Per-restaurant isolation maps (v4) ────────────────────────
  let tableRestaurantIds = Map.empty<Text, Text>();      // tableId → restaurantId
  let menuItemRestaurantIds = Map.empty<Text, Text>();   // itemId → restaurantId
  let orderRestaurantIds = Map.empty<Text, Text>();      // orderId → restaurantId
  let restaurantSettingsMap = Map.empty<Text, RestaurantSettings>(); // restaurantId → settings
  let restaurantBillCounters = Map.empty<Text, Nat>();   // restaurantId → billCounter

  // ─── Helpers ─────────────────────────────────────────────────────
  func mergeBill(core : BillCore) : Bill {
    let meta = switch (billMeta.get(core.id)) {
      case (?m) { m };
      case (null) { { settlementMode = "Cash"; cashierName = "Admin" } };
    };
    let rid = switch (billRestaurantIds.get(core.id)) {
      case (?r) { r };
      case (null) { "" };
    };
    {
      id = core.id; billNumber = core.billNumber; orderId = core.orderId;
      tableId = core.tableId; tableName = core.tableName; items = core.items;
      subtotal = core.subtotal; taxAmount = core.taxAmount; discount = core.discount;
      total = core.total; createdAt = core.createdAt; settled = core.settled;
      settlementMode = meta.settlementMode; cashierName = meta.cashierName;
      restaurantId = rid;
    };
  };

  func upsertMeta(billId : Text, meta : BillMeta) {
    if (billMeta.containsKey(billId)) { billMeta.remove(billId) };
    billMeta.add(billId, meta);
  };

  func upsertRestaurantId(billId : Text, restaurantId : Text) {
    if (billRestaurantIds.containsKey(billId)) { billRestaurantIds.remove(billId) };
    billRestaurantIds.add(billId, restaurantId);
  };

  func getRestaurantBillCounter(restaurantId : Text) : Nat {
    switch (restaurantBillCounters.get(restaurantId)) {
      case (?n) { n };
      case (null) { 1 };
    };
  };

  func incrementRestaurantBillCounter(restaurantId : Text) {
    let current = getRestaurantBillCounter(restaurantId);
    if (restaurantBillCounters.containsKey(restaurantId)) { restaurantBillCounters.remove(restaurantId) };
    restaurantBillCounters.add(restaurantId, current + 1);
  };

  // ─── Lifecycle ────────────────────────────────────────────────────
  system func preupgrade() {};
  system func postupgrade() {
    // NOTE: Do NOT reset settings or billCounter — that would wipe data on every deployment.
  };

  // ─── Table Functions (Legacy — global, kept for backward compat) ─────────
  public query func getTables() : async [Table] { tables.values().toArray() };

  public shared func addTable(tableName : Text, seatsCount : Nat) : async Table {
    let tableId = "T" # (Time.now().toText());
    let table : Table = { id = tableId; name = tableName; seats = seatsCount; status = "available" };
    tables.add(tableId, table);
    table;
  };

  public shared func updateTableStatus(tableId : Text, newStatus : Text) : async ?Table {
    switch (tables.get(tableId)) {
      case (null) { null };
      case (?table) {
        let updated : Table = { id = tableId; name = table.name; seats = table.seats; status = newStatus };
        if (tables.containsKey(tableId)) { tables.remove(tableId) };
        tables.add(tableId, updated);
        ?updated;
      };
    };
  };

  public shared func deleteTable(tableId : Text) : async Bool {
    if (not tables.containsKey(tableId)) { return false };
    tables.remove(tableId);
    true;
  };

  // ─── Table Functions (Restaurant-scoped) ────────────────────────────
  public query func getTablesR(restaurantId : Text) : async [Table] {
    tables.values()
      .filter(func(t) {
        switch (tableRestaurantIds.get(t.id)) {
          case (?rid) { rid == restaurantId };
          case (null) { false };
        };
      })
      .toArray();
  };

  public shared func addTableR(restaurantId : Text, tableName : Text, seatsCount : Nat) : async Table {
    let tableId = restaurantId # "-T-" # (Time.now().toText());
    let table : Table = { id = tableId; name = tableName; seats = seatsCount; status = "available" };
    tables.add(tableId, table);
    tableRestaurantIds.add(tableId, restaurantId);
    table;
  };

  public shared func deleteTableR(restaurantId : Text, tableId : Text) : async Bool {
    switch (tableRestaurantIds.get(tableId)) {
      case (?rid) {
        if (rid != restaurantId) { return false };
        tables.remove(tableId);
        tableRestaurantIds.remove(tableId);
        true;
      };
      case (null) { false };
    };
  };

  // ─── MenuItem Functions (Legacy) ───────────────────────────────────
  public query func getMenuItems() : async [MenuItem] { menuItems.values().toArray() };

  public shared func addMenuItem(category : Text, itemName : Text, itemPrice : Float, itemDescription : Text) : async MenuItem {
    let itemId = "ITEM-" # (Time.now().toText());
    let newItem : MenuItem = { id = itemId; category; name = itemName; price = itemPrice; description = itemDescription; available = true };
    menuItems.add(itemId, newItem);
    newItem;
  };

  public shared func updateMenuItem(item : MenuItem) : async ?MenuItem {
    switch (menuItems.get(item.id)) {
      case (null) { null };
      case (?_) {
        if (menuItems.containsKey(item.id)) { menuItems.remove(item.id) };
        menuItems.add(item.id, item);
        ?item;
      };
    };
  };

  public shared func deleteMenuItem(itemId : Text) : async Bool {
    if (not menuItems.containsKey(itemId)) { return false };
    menuItems.remove(itemId);
    true;
  };

  // ─── MenuItem Functions (Restaurant-scoped) ─────────────────────────
  public query func getMenuItemsR(restaurantId : Text) : async [MenuItem] {
    menuItems.values()
      .filter(func(item) {
        switch (menuItemRestaurantIds.get(item.id)) {
          case (?rid) { rid == restaurantId };
          case (null) { false };
        };
      })
      .toArray();
  };

  public shared func addMenuItemR(restaurantId : Text, category : Text, itemName : Text, itemPrice : Float, itemDescription : Text) : async MenuItem {
    let itemId = restaurantId # "-ITEM-" # (Time.now().toText());
    let newItem : MenuItem = { id = itemId; category; name = itemName; price = itemPrice; description = itemDescription; available = true };
    menuItems.add(itemId, newItem);
    menuItemRestaurantIds.add(itemId, restaurantId);
    newItem;
  };

  public shared func updateMenuItemR(restaurantId : Text, item : MenuItem) : async ?MenuItem {
    switch (menuItems.get(item.id)) {
      case (null) { null };
      case (?_) {
        if (menuItems.containsKey(item.id)) { menuItems.remove(item.id) };
        menuItems.add(item.id, item);
        // Ensure restaurant association is set
        if (not menuItemRestaurantIds.containsKey(item.id)) {
          menuItemRestaurantIds.add(item.id, restaurantId);
        };
        ?item;
      };
    };
  };

  public shared func deleteMenuItemR(restaurantId : Text, itemId : Text) : async Bool {
    switch (menuItemRestaurantIds.get(itemId)) {
      case (?rid) {
        if (rid != restaurantId) { return false };
        menuItems.remove(itemId);
        menuItemRestaurantIds.remove(itemId);
        true;
      };
      case (null) {
        // Item has no restaurant association — still delete if it exists
        if (menuItems.containsKey(itemId)) {
          menuItems.remove(itemId);
          true;
        } else { false };
      };
    };
  };

  // ─── Order Functions (Legacy) ─────────────────────────────────────
  public query func getOrders() : async [Order] { orders.values().toArray() };

  public query func getOrderByTable(tableId : Text) : async ?Order {
    orders.values().find(func(o) { o.tableId == tableId and o.status != "billed" });
  };

  public shared func createOrder(tableId : Text, tableName : Text, orderItems : [OrderItem], instructions : Text) : async Order {
    let orderId = "ORDER-" # (Time.now().toText());
    let newOrder : Order = {
      id = orderId; tableId; tableName; items = orderItems;
      status = "pending"; createdAt = Time.now(); specialInstructions = instructions;
    };
    orders.add(orderId, newOrder);
    newOrder;
  };

  public shared func updateOrderItems(orderId : Text, items : [OrderItem]) : async ?Order {
    switch (orders.get(orderId)) {
      case (null) { null };
      case (?order) {
        let updated : Order = {
          id = order.id; tableId = order.tableId; tableName = order.tableName;
          items; status = order.status; createdAt = order.createdAt;
          specialInstructions = order.specialInstructions;
        };
        if (orders.containsKey(orderId)) { orders.remove(orderId) };
        orders.add(orderId, updated);
        ?updated;
      };
    };
  };

  public shared func updateOrderStatus(orderId : Text, newStatus : Text) : async ?Order {
    switch (orders.get(orderId)) {
      case (null) { null };
      case (?order) {
        let updated : Order = {
          id = order.id; tableId = order.tableId; tableName = order.tableName;
          items = order.items; status = newStatus; createdAt = order.createdAt;
          specialInstructions = order.specialInstructions;
        };
        if (orders.containsKey(orderId)) { orders.remove(orderId) };
        orders.add(orderId, updated);
        ?updated;
      };
    };
  };

  // ─── Order Functions (Restaurant-scoped) ───────────────────────────
  public query func getOrdersR(restaurantId : Text) : async [Order] {
    orders.values()
      .filter(func(o) {
        switch (orderRestaurantIds.get(o.id)) {
          case (?rid) { rid == restaurantId };
          case (null) { false };
        };
      })
      .toArray();
  };

  public query func getOrderByTableR(restaurantId : Text, tableId : Text) : async ?Order {
    orders.values().find(func(o) {
      o.tableId == tableId and
      o.status != "billed" and
      (switch (orderRestaurantIds.get(o.id)) {
        case (?rid) { rid == restaurantId };
        case (null) { false };
      });
    });
  };

  public shared func createOrderR(restaurantId : Text, tableId : Text, tableName : Text, orderItems : [OrderItem], instructions : Text) : async Order {
    let orderId = restaurantId # "-ORD-" # (Time.now().toText());
    let newOrder : Order = {
      id = orderId; tableId; tableName; items = orderItems;
      status = "pending"; createdAt = Time.now(); specialInstructions = instructions;
    };
    orders.add(orderId, newOrder);
    orderRestaurantIds.add(orderId, restaurantId);
    newOrder;
  };

  public shared func updateOrderItemsR(restaurantId : Text, orderId : Text, items : [OrderItem]) : async ?Order {
    switch (orders.get(orderId)) {
      case (null) { null };
      case (?order) {
        let updated : Order = {
          id = order.id; tableId = order.tableId; tableName = order.tableName;
          items; status = order.status; createdAt = order.createdAt;
          specialInstructions = order.specialInstructions;
        };
        if (orders.containsKey(orderId)) { orders.remove(orderId) };
        orders.add(orderId, updated);
        // Ensure restaurant association
        if (not orderRestaurantIds.containsKey(orderId)) {
          orderRestaurantIds.add(orderId, restaurantId);
        };
        ?updated;
      };
    };
  };

  public shared func updateOrderStatusR(restaurantId : Text, orderId : Text, newStatus : Text) : async ?Order {
    switch (orders.get(orderId)) {
      case (null) { null };
      case (?order) {
        let updated : Order = {
          id = order.id; tableId = order.tableId; tableName = order.tableName;
          items = order.items; status = newStatus; createdAt = order.createdAt;
          specialInstructions = order.specialInstructions;
        };
        if (orders.containsKey(orderId)) { orders.remove(orderId) };
        orders.add(orderId, updated);
        ?updated;
      };
    };
  };

  // ─── Bill Functions ────────────────────────────────────────────────
  public query func getBills() : async [Bill] {
    bills.values().map(mergeBill).toArray();
  };

  public query func getBillsByRestaurant(restaurantId : Text) : async [Bill] {
    bills.values()
      .filter(func(b) {
        switch (billRestaurantIds.get(b.id)) {
          case (?rid) { rid == restaurantId };
          case (null) { false };
        };
      })
      .map(mergeBill)
      .toArray();
  };

  public shared func clearRestaurantBills(restaurantId : Text) : async Nat {
    let toDelete = bills.values()
      .filter(func(b) {
        switch (billRestaurantIds.get(b.id)) {
          case (?rid) { rid == restaurantId };
          case (null) { false };
        };
      })
      .toArray();
    for (b in toDelete.values()) {
      bills.remove(b.id);
      if (billMeta.containsKey(b.id)) { billMeta.remove(b.id) };
      if (billRestaurantIds.containsKey(b.id)) { billRestaurantIds.remove(b.id) };
    };
    toDelete.size();
  };

  // Clear all bills for a restaurant AND reset that restaurant's bill counter to 1
  public shared func clearRestaurantBillsAndReset(restaurantId : Text) : async Nat {
    let toDelete = bills.values()
      .filter(func(b) {
        switch (billRestaurantIds.get(b.id)) {
          case (?rid) { rid == restaurantId };
          case (null) { false };
        };
      })
      .toArray();
    for (b in toDelete.values()) {
      bills.remove(b.id);
      if (billMeta.containsKey(b.id)) { billMeta.remove(b.id) };
      if (billRestaurantIds.containsKey(b.id)) { billRestaurantIds.remove(b.id) };
    };
    // Reset this restaurant's bill counter to 1
    if (restaurantBillCounters.containsKey(restaurantId)) {
      restaurantBillCounters.remove(restaurantId);
    };
    restaurantBillCounters.add(restaurantId, 1);
    toDelete.size();
  };

  public shared func resetBillCounter() : async () {
    billCounter := 1;
  };

  // Legacy createBill — uses global billCounter
  public shared func createBill(
    orderId : Text, tableId : Text, tableName : Text,
    billItems : [BillItem], subtotal : Float, taxAmount : Float,
    discount : Float, total : Float,
    settlementMode : Text, cashierName : Text, restaurantId : Text
  ) : async Bill {
    let billId = "BILL-" # (Time.now().toText());
    let rCounter = getRestaurantBillCounter(restaurantId);
    let core : BillCore = {
      id = billId; billNumber = rCounter; orderId; tableId; tableName;
      items = billItems; subtotal; taxAmount; discount; total;
      createdAt = Time.now(); settled = true;
    };
    let meta : BillMeta = { settlementMode; cashierName };
    bills.add(billId, core);
    upsertMeta(billId, meta);
    upsertRestaurantId(billId, restaurantId);
    incrementRestaurantBillCounter(restaurantId);
    billCounter += 1;
    mergeBill(core);
  };

  // Restaurant-scoped createBill — uses per-restaurant counter
  public shared func createBillR(
    restaurantId : Text,
    orderId : Text, tableId : Text, tableName : Text,
    billItems : [BillItem], subtotal : Float, taxAmount : Float,
    discount : Float, total : Float,
    settlementMode : Text, cashierName : Text
  ) : async Bill {
    let billId = restaurantId # "-BILL-" # (Time.now().toText());
    let rCounter = getRestaurantBillCounter(restaurantId);
    let core : BillCore = {
      id = billId; billNumber = rCounter; orderId; tableId; tableName;
      items = billItems; subtotal; taxAmount; discount; total;
      createdAt = Time.now(); settled = true;
    };
    let meta : BillMeta = { settlementMode; cashierName };
    bills.add(billId, core);
    upsertMeta(billId, meta);
    upsertRestaurantId(billId, restaurantId);
    incrementRestaurantBillCounter(restaurantId);
    mergeBill(core);
  };

  public shared func resettleBill(billId : Text, newMode : Text) : async ?Bill {
    switch (bills.get(billId)) {
      case (null) { null };
      case (?core) {
        let oldMeta = switch (billMeta.get(billId)) {
          case (?m) { m };
          case (null) { { settlementMode = "Cash"; cashierName = "Admin" } };
        };
        let newMeta : BillMeta = { settlementMode = newMode; cashierName = oldMeta.cashierName };
        upsertMeta(billId, newMeta);
        ?mergeBill(core);
      };
    };
  };

  public shared func markBillSettled(billId : Text) : async ?Bill {
    switch (bills.get(billId)) {
      case (null) { null };
      case (?core) {
        let updated : BillCore = {
          id = core.id; billNumber = core.billNumber; orderId = core.orderId;
          tableId = core.tableId; tableName = core.tableName; items = core.items;
          subtotal = core.subtotal; taxAmount = core.taxAmount; discount = core.discount;
          total = core.total; createdAt = core.createdAt; settled = true;
        };
        if (bills.containsKey(billId)) { bills.remove(billId) };
        bills.add(billId, updated);
        ?mergeBill(updated);
      };
    };
  };

  public shared func updateBill(b : Bill) : async ?Bill {
    switch (bills.get(b.id)) {
      case (null) { null };
      case (?core) {
        let updatedCore : BillCore = {
          id = core.id; billNumber = core.billNumber; orderId = core.orderId;
          tableId = core.tableId; tableName = core.tableName; items = b.items;
          subtotal = b.subtotal; taxAmount = b.taxAmount; discount = b.discount;
          total = b.total; createdAt = core.createdAt; settled = core.settled;
        };
        if (bills.containsKey(b.id)) { bills.remove(b.id) };
        bills.add(b.id, updatedCore);
        let newMeta : BillMeta = { settlementMode = b.settlementMode; cashierName = b.cashierName };
        upsertMeta(b.id, newMeta);
        upsertRestaurantId(b.id, b.restaurantId);
        ?mergeBill(updatedCore);
      };
    };
  };

  public shared func deleteBill(billId : Text) : async Bool {
    if (not bills.containsKey(billId)) { return false };
    bills.remove(billId);
    if (billMeta.containsKey(billId)) { billMeta.remove(billId) };
    if (billRestaurantIds.containsKey(billId)) { billRestaurantIds.remove(billId) };
    true;
  };

  public query func getDueBills() : async [Bill] {
    bills.values().filter(func(b) { not b.settled }).map(mergeBill).toArray();
  };

  // ─── Settings Functions ──────────────────────────────────────────────
  // Legacy — global settings
  public query func getSettings() : async RestaurantSettings { settings };

  public shared func updateSettings(newSettings : RestaurantSettings) : async () {
    settings := newSettings;
  };

  // Restaurant-scoped settings
  public query func getSettingsR(restaurantId : Text) : async RestaurantSettings {
    switch (restaurantSettingsMap.get(restaurantId)) {
      case (?s) { s };
      case (null) { defaultSettings };
    };
  };

  public shared func updateSettingsR(restaurantId : Text, newSettings : RestaurantSettings) : async () {
    if (restaurantSettingsMap.containsKey(restaurantId)) {
      restaurantSettingsMap.remove(restaurantId);
    };
    restaurantSettingsMap.add(restaurantId, newSettings);
    // Also update global settings for backward compat
    settings := newSettings;
  };

  // ─── SMS / WhatsApp Gateway ─────────────────────────────────────────
  public query func getSmsConfig() : async SmsConfig { smsConfig };

  public shared func updateSmsConfig(config : SmsConfig) : async () {
    smsConfig := config;
  };

  public shared func sendOtp(mobile : Text, otpCode : Text) : async OtpResult {
    if (not smsConfig.enabled) {
      return { success = false; response = "SMS gateway not configured. Please enable it in Settings." };
    };
    if (smsConfig.apiKey == "") {
      return { success = false; response = "API key is missing. Please configure SMS gateway in Settings." };
    };
    let message = "Your coupon redemption OTP is: " # otpCode # ". Valid for 5 minutes. Do not share with anyone.";
    try {
      let response = if (smsConfig.provider == "msg91") {
        let url = "https://api.msg91.com/api/v5/otp?template_id=" # smsConfig.templateId # "&mobile=91" # mobile # "&authkey=" # smsConfig.apiKey # "&otp=" # otpCode;
        await Outcall.httpGetRequest(url, [
          { name = "Content-Type"; value = "application/json" }
        ], transform);
      } else if (smsConfig.provider == "fast2sms") {
        let url = "https://www.fast2sms.com/dev/bulkV2?authorization=" # smsConfig.apiKey # "&variables_values=" # otpCode # "&route=dlt&numbers=" # mobile # "&flash=0";
        await Outcall.httpGetRequest(url, [
          { name = "cache-control"; value = "no-cache" }
        ], transform);
      } else if (smsConfig.provider == "twilio") {
        let url = "https://api.twilio.com/2010-04-01/Accounts/" # smsConfig.accountSid # "/Messages.json";
        let body = "To=%2B" # mobile # "&From=" # smsConfig.senderId # "&Body=" # message;
        let credentials = smsConfig.accountSid # ":" # smsConfig.apiKey;
        await Outcall.httpPostRequest(url, [
          { name = "Content-Type"; value = "application/x-www-form-urlencoded" },
          { name = "Authorization"; value = "Basic " # credentials }
        ], body, transform);
      } else {
        return { success = false; response = "Unknown provider: " # smsConfig.provider };
      };
      { success = true; response };
    } catch (e) {
      { success = false; response = "Failed to send OTP. Check gateway settings and try again." };
    };
  };

  public query func transform(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    Outcall.transform(input);
  };

  // ─── Customer Functions ───────────────────────────────────────────────
  public query func getCustomers() : async [Customer] { customers.values().toArray() };

  public shared func addCustomer(name : Text, phone : Text, email : Text, address : Text) : async Customer {
    let id = "CUST-" # (Time.now().toText());
    let c : Customer = { id; name; phone; email; address; loyaltyPoints = 0; visitCount = 0; createdAt = Time.now() };
    customers.add(id, c);
    c;
  };

  public shared func updateCustomer(c : Customer) : async ?Customer {
    switch (customers.get(c.id)) {
      case (null) { null };
      case (?_) {
        if (customers.containsKey(c.id)) { customers.remove(c.id) };
        customers.add(c.id, c);
        ?c;
      };
    };
  };

  public shared func deleteCustomer(id : Text) : async Bool {
    if (not customers.containsKey(id)) { return false };
    customers.remove(id);
    true;
  };

  // ─── Inventory Functions ──────────────────────────────────────────────
  public query func getInventoryItems() : async [InventoryItem] { inventoryItems.values().toArray() };

  public shared func addInventoryItem(name : Text, category : Text, quantity : Float, unit : Text, reorderLevel : Float, costPrice : Float) : async InventoryItem {
    let id = "INV-" # (Time.now().toText());
    let item : InventoryItem = { id; name; category; quantity; unit; reorderLevel; costPrice; updatedAt = Time.now() };
    inventoryItems.add(id, item);
    item;
  };

  public shared func updateInventoryItem(item : InventoryItem) : async ?InventoryItem {
    switch (inventoryItems.get(item.id)) {
      case (null) { null };
      case (?_) {
        let updated : InventoryItem = {
          id = item.id; name = item.name; category = item.category;
          quantity = item.quantity; unit = item.unit; reorderLevel = item.reorderLevel;
          costPrice = item.costPrice; updatedAt = Time.now();
        };
        if (inventoryItems.containsKey(item.id)) { inventoryItems.remove(item.id) };
        inventoryItems.add(item.id, updated);
        ?updated;
      };
    };
  };

  public shared func deleteInventoryItem(id : Text) : async Bool {
    if (not inventoryItems.containsKey(id)) { return false };
    inventoryItems.remove(id);
    true;
  };

  // ─── Expense Functions ───────────────────────────────────────────────
  public query func getExpenses() : async [Expense] { expenses.values().toArray() };

  public shared func addExpense(category : Text, description : Text, amount : Float, paidBy : Text) : async Expense {
    let id = "EXP-" # (Time.now().toText());
    let e : Expense = { id; category; description; amount; date = Time.now(); paidBy };
    expenses.add(id, e);
    e;
  };

  public shared func deleteExpense(id : Text) : async Bool {
    if (not expenses.containsKey(id)) { return false };
    expenses.remove(id);
    true;
  };

  // ─── Vendor Functions ────────────────────────────────────────────────
  public query func getVendors() : async [Vendor] { vendors.values().toArray() };

  public shared func addVendor(name : Text, contactPerson : Text, phone : Text, email : Text, address : Text, category : Text) : async Vendor {
    let id = "VEN-" # (Time.now().toText());
    let v : Vendor = { id; name; contactPerson; phone; email; address; category; balanceDue = 0.0; createdAt = Time.now() };
    vendors.add(id, v);
    v;
  };

  public shared func updateVendor(v : Vendor) : async ?Vendor {
    switch (vendors.get(v.id)) {
      case (null) { null };
      case (?_) {
        if (vendors.containsKey(v.id)) { vendors.remove(v.id) };
        vendors.add(v.id, v);
        ?v;
      };
    };
  };

  public shared func deleteVendor(id : Text) : async Bool {
    if (not vendors.containsKey(id)) { return false };
    vendors.remove(id);
    true;
  };

  // ─── Purchase Functions ──────────────────────────────────────────────
  public query func getPurchases() : async [Purchase] { purchases.values().toArray() };

  public shared func addPurchase(vendorId : Text, vendorName : Text, items : [PurchaseItem], totalAmount : Float, paymentStatus : Text, notes : Text) : async Purchase {
    let id = "PUR-" # (Time.now().toText());
    let p : Purchase = { id; vendorId; vendorName; items; totalAmount; date = Time.now(); paymentStatus; notes };
    purchases.add(id, p);
    p;
  };

  public shared func updatePurchaseStatus(id : Text, status : Text) : async ?Purchase {
    switch (purchases.get(id)) {
      case (null) { null };
      case (?p) {
        let updated : Purchase = {
          id = p.id; vendorId = p.vendorId; vendorName = p.vendorName;
          items = p.items; totalAmount = p.totalAmount; date = p.date;
          paymentStatus = status; notes = p.notes;
        };
        if (purchases.containsKey(id)) { purchases.remove(id) };
        purchases.add(id, updated);
        ?updated;
      };
    };
  };

  public shared func deletePurchase(id : Text) : async Bool {
    if (not purchases.containsKey(id)) { return false };
    purchases.remove(id);
    true;
  };
};
