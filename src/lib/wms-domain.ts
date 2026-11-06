export type Priority = "Low" | "Normal" | "High" | "Urgent";
export type OrderStatus =
  | "New"
  | "Confirmed"
  | "Picking"
  | "Ready for Dispatch"
  | "Dispatched"
  | "Cancelled";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  locationId: string;
  quantity: number;
  reserved: number;
  unit: string;
  minStock: number;
  updated: string;
}

export interface WarehouseLocation {
  id: string;
  code: string;
  warehouse: string;
  zone: string;
  rack: string;
  shelf: string;
  bin: string;
  capacity: number;
  occupied: number;
  status: "Available" | "Partially Occupied" | "Full" | "Inactive";
}

export interface InboundLine {
  sku: string;
  name: string;
  expected: number;
  received: number;
  damaged: number;
}

export interface InboundShipment {
  id: string;
  supplier: string;
  purchaseOrder: string;
  date: string;
  status: "Expected" | "Arrived" | "Receiving" | "Completed" | "Rejected";
  items: InboundLine[];
}

export interface OrderLine {
  sku: string;
  quantity: number;
  picked: number;
}

export interface CustomerOrder {
  id: string;
  customer: string;
  date: string;
  priority: Priority;
  status: OrderStatus;
  address: string;
  items: OrderLine[];
}

export interface PickTask {
  id: string;
  orderId: string;
  picker: string;
  status: "Pending" | "In Progress" | "Partially Picked" | "Completed" | "Exception";
  created: string;
}

export interface DispatchRecord {
  id: string;
  orderId: string;
  carrier: string;
  tracking: string;
  date: string;
  status: "Ready for Dispatch" | "Packed" | "Dispatched" | "Delivered" | "Failed";
}

export interface ActivityRecord {
  id: string;
  type: string;
  reference: string;
  detail: string;
  quantity: number;
  user: string;
  timestamp: string;
  status: string;
}

export interface WmsState {
  products: Product[];
  locations: WarehouseLocation[];
  inbounds: InboundShipment[];
  orders: CustomerOrder[];
  picks: PickTask[];
  dispatches: DispatchRecord[];
  activity: ActivityRecord[];
}

export const availableStock = (product: Pick<Product, "quantity" | "reserved">) =>
  Math.max(0, product.quantity - product.reserved);

export const hasLocationCapacity = (location: WarehouseLocation, quantity: number) =>
  location.status !== "Inactive" && quantity > 0 && location.capacity - location.occupied >= quantity;

export const canDispatchOrder = (order: Pick<CustomerOrder, "status">) =>
  order.status === "Ready for Dispatch";

const productNames = [
  ["Industrial Bearings", "Components"], ["Steel Bolts", "Fasteners"],
  ["Hydraulic Pumps", "Equipment"], ["Electric Motors", "Equipment"],
  ["Safety Gloves", "Safety"], ["Packaging Materials", "Packaging"],
  ["Control Panels", "Electrical"], ["Conveyor Belts", "Components"],
  ["Mechanical Seals", "Components"], ["Electrical Cables", "Electrical"],
  ["Pneumatic Fittings", "Equipment"], ["Protective Eyewear", "Safety"],
  ["Shipping Cartons", "Packaging"], ["Stainless Washers", "Fasteners"],
  ["Pressure Valves", "Equipment"], ["Power Relays", "Electrical"],
  ["Motor Couplings", "Components"], ["Cable Ties", "Packaging"],
  ["Hard Hats", "Safety"], ["Threaded Rods", "Fasteners"],
  ["Drive Shafts", "Components"], ["Terminal Blocks", "Electrical"],
  ["Air Filters", "Equipment"], ["Pallet Wrap", "Packaging"],
  ["Cut-resistant Sleeves", "Safety"], ["Hex Nuts", "Fasteners"],
  ["Gear Assemblies", "Components"], ["Circuit Breakers", "Electrical"],
  ["Hydraulic Hoses", "Equipment"], ["Foam Inserts", "Packaging"],
] as const;

const suppliers = ["Northstar Industrial", "Apex Components", "Meridian Supply Co.", "Atlas Manufacturing", "Pioneer Materials"];
const customers = ["Acme Manufacturing", "Northwind Systems", "Contoso Logistics", "Fabrikam Industries", "Summit Automation", "BluePeak Supply"];
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export function createSeedState(): WmsState {
  const locations: WarehouseLocation[] = Array.from({ length: 12 }, (_, index) => {
    const zoneLetter = String.fromCharCode(65 + Math.floor(index / 4));
    const rackNumber = String(index % 4 + 1).padStart(2, "0");
    const shelf = String(index % 3 + 1).padStart(2, "0");
    const bin = String(index % 5 + 1).padStart(2, "0");
    const capacity = 160 + (index % 4) * 40;
    const occupied = index === 11 ? 0 : 54 + (index * 37) % (capacity - 65);
    return {
      id: `LOC-${String(index + 1).padStart(3, "0")}`,
      code: `WH-01-Z${zoneLetter}-R${rackNumber}-S${shelf}-B${bin}`,
      warehouse: "WH-01 · Central Distribution",
      zone: `Zone ${zoneLetter}`,
      rack: `R-${rackNumber}`,
      shelf: `S-${shelf}`,
      bin: `B-${bin}`,
      capacity,
      occupied,
      status: index === 11 ? "Available" : occupied / capacity > 0.9 ? "Full" : "Partially Occupied",
    };
  });

  const products: Product[] = productNames.map(([name, category], index) => {
    const location = locations[index % 10];
    return {
      id: `PRD-${String(index + 1).padStart(4, "0")}`,
      sku: `PRD-${1001 + index}`,
      name,
      category,
      warehouse: "WH-01",
      locationId: location.id,
      quantity: index % 9 === 0 ? 18 + index : 70 + (index * 29) % 380,
      reserved: index % 7 === 0 ? 8 : index % 5 === 0 ? 14 : 0,
      unit: index % 4 === 1 ? "box" : "ea",
      minStock: index % 9 === 0 ? 30 : 35,
      updated: daysAgo(index % 8),
    };
  });

  const inbounds: InboundShipment[] = Array.from({ length: 10 }, (_, index) => ({
    id: `INB-${String(2401 + index).padStart(5, "0")}`,
    supplier: suppliers[index % suppliers.length],
    purchaseOrder: `PO-${String(8400 + index).padStart(5, "0")}`,
    date: daysAgo(index % 4),
    status: index < 3 ? "Expected" : index < 5 ? "Arrived" : "Completed",
    items: [{
      sku: products[(index * 3) % products.length].sku,
      name: products[(index * 3) % products.length].name,
      expected: 40 + index * 7,
      received: index < 5 ? 0 : 40 + index * 7,
      damaged: 0,
    }],
  }));

  const orders: CustomerOrder[] = Array.from({ length: 15 }, (_, index) => {
    const status: OrderStatus = index < 4 ? "New" : index < 7 ? "Picking" : index < 9 ? "Ready for Dispatch" : index < 12 ? "Dispatched" : "Confirmed";
    const product = products[(index * 2 + 1) % products.length];
    return {
      id: `ORD-${String(5901 + index).padStart(5, "0")}`,
      customer: customers[index % customers.length],
      date: daysAgo(index % 6),
      priority: index % 8 === 0 ? "Urgent" : index % 3 === 0 ? "High" : "Normal",
      status,
      address: `${120 + index} Commerce Way, Portland, OR`,
      items: [{ sku: product.sku, quantity: 3 + index % 6, picked: status === "Ready for Dispatch" || status === "Dispatched" ? 3 + index % 6 : 0 }],
    };
  });

  const picks: PickTask[] = Array.from({ length: 10 }, (_, index) => ({
    id: `PICK-${String(3101 + index).padStart(5, "0")}`,
    orderId: orders[index % orders.length].id,
    picker: ["Jordan Lee", "Sam Rivera", "Morgan Chen"][index % 3],
    status: index < 3 ? "Pending" : index < 6 ? "In Progress" : "Completed",
    created: daysAgo(index % 5),
  }));

  const dispatches: DispatchRecord[] = Array.from({ length: 10 }, (_, index) => ({
    id: `DSP-${String(1201 + index).padStart(5, "0")}`,
    orderId: orders[(index + 7) % orders.length].id,
    carrier: ["UPS", "FedEx", "DHL", "OnTrac"][index % 4],
    tracking: `1Z${String(74820000 + index * 4187)}`,
    date: daysAgo(index % 5),
    status: index < 2 ? "Ready for Dispatch" : index < 8 ? "Dispatched" : "Delivered",
  }));

  const activity: ActivityRecord[] = Array.from({ length: 36 }, (_, index) => ({
    id: `TXN-${String(7701 + index).padStart(5, "0")}`,
    type: ["Product Received", "Putaway Completed", "Order Created", "Picking Started", "Shipment Dispatched", "Inventory Updated"][index % 6],
    reference: index % 3 === 0 ? inbounds[index % inbounds.length].id : orders[index % orders.length].id,
    detail: index % 2 === 0 ? products[index % products.length].name : customers[index % customers.length],
    quantity: 4 + (index * 7) % 48,
    user: ["Jordan Lee", "Sam Rivera", "Morgan Chen"][index % 3],
    timestamp: new Date(Date.now() - index * 2_700_000).toISOString(),
    status: "Completed",
  }));

  return { products, locations, inbounds, orders, picks, dispatches, activity };
}