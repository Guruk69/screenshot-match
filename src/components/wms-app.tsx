import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, ArrowDownToLine, ArrowDownUp, ArrowLeft, ArrowRight, Bell, Boxes, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock3, Command, Download, Ellipsis,
  LayoutDashboard, LogOut, Menu, Package, PackageCheck, Plus, Search, Settings, ShieldCheck,
  Truck, Warehouse, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { availableStock, canDispatchOrder, createSeedState, hasLocationCapacity, type ActivityRecord, type CustomerOrder, type InboundShipment, type OrderStatus, type Priority, type Product, type WmsState } from "@/lib/wms-domain";
import { useWms } from "@/state/wms-store";

type Section = "Dashboard" | "Inbound / Receiving" | "Putaway" | "Inventory" | "Warehouse Locations" | "Orders" | "Picking" | "Dispatch" | "Activity History" | "Reports" | "Settings" | "User Profile";

const groups: { label: string; items: { label: Section; icon: typeof LayoutDashboard }[] }[] = [
  { label: "GENERAL", items: [{ label: "Dashboard", icon: LayoutDashboard }] },
  { label: "WAREHOUSE OPERATIONS", items: [{ label: "Inbound / Receiving", icon: ArrowDownToLine }, { label: "Putaway", icon: PackageCheck }, { label: "Inventory", icon: Boxes }, { label: "Warehouse Locations", icon: Warehouse }] },
  { label: "ORDER MANAGEMENT", items: [{ label: "Orders", icon: ClipboardList }, { label: "Picking", icon: Package }, { label: "Dispatch", icon: Truck }] },
  { label: "MANAGEMENT", items: [{ label: "Activity History", icon: Activity }, { label: "Reports", icon: ArrowDownUp }] },
  { label: "SETTINGS", items: [{ label: "Settings", icon: Settings }, { label: "User Profile", icon: ShieldCheck }] },
];

const inventoryTrend = [
  { day: "Mon", received: 142, shipped: 104 }, { day: "Tue", received: 188, shipped: 132 },
  { day: "Wed", received: 124, shipped: 156 }, { day: "Thu", received: 226, shipped: 178 },
  { day: "Fri", received: 198, shipped: 146 }, { day: "Sat", received: 92, shipped: 71 }, { day: "Sun", received: 116, shipped: 84 },
];

const sectionDescriptions: Record<Section, string> = {
  Dashboard: "Warehouse performance at a glance.", "Inbound / Receiving": "Track supplier deliveries and verify arriving stock.", Putaway: "Move received stock into available warehouse locations.", Inventory: "Manage product quantities, availability, and stock health.",
  "Warehouse Locations": "Review warehouse capacity and storage assignments.", Orders: "Manage customer orders from confirmation to fulfillment.", Picking: "Work through active picks by location and order priority.", Dispatch: "Pack completed orders and record outgoing shipments.", "Activity History": "A chronological record of warehouse operations.", Reports: "Operational summaries and downloadable data.", Settings: "Warehouse preferences and notification controls.", "User Profile": "Your account and workspace details.",
};

function recordActivity(data: WmsState, type: string, reference: string, detail: string, quantity = 0): WmsState {
  const record: ActivityRecord = {
    id: `TXN-${Date.now().toString().slice(-7)}`, type, reference, detail, quantity,
    user: "Jordan Lee", timestamp: new Date().toISOString(), status: "Completed",
  };
  return { ...data, activity: [record, ...data.activity] };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function shortDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function StatusBadge({ children }: { children: string }) {
  const status = children.toLowerCase();
  const tone = ["completed", "in stock", "dispatched", "delivered", "available", "picked"].some((item) => status.includes(item))
    ? "border-success/20 bg-success/10 text-success"
    : ["low", "pending", "expected", "arrived", "partially", "high", "urgent", "ready", "receiving", "packed", "confirmed", "in progress"].some((item) => status.includes(item))
      ? "border-warning/25 bg-warning/10 text-foreground"
      : ["out of stock", "rejected", "failed", "cancelled", "exception", "inactive"].some((item) => status.includes(item))
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";
  return <Badge variant="outline" className={`whitespace-nowrap rounded-sm px-2 py-0.5 font-medium ${tone}`}>{children}</Badge>;
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Package }) {
  return <section className="border-b border-border px-5 py-4 sm:border-b-0 sm:border-r sm:last:border-r-0">
    <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs font-medium">{label}</span><Icon className="size-4" /></div>
    <div className="mt-3 font-mono text-2xl font-semibold tabular-nums">{value}</div>
    <div className="mt-1 text-xs text-muted-foreground">{note}</div>
  </section>;
}

function AppSidebar({ active, collapsed, onToggle, onNavigate }: { active: Section; collapsed: boolean; onToggle: () => void; onNavigate: (section: Section) => void }) {
  return <aside className={`hidden shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 md:flex ${collapsed ? "w-[68px]" : "w-[238px]"}`}>
    <div className={`flex h-14 items-center border-b border-border ${collapsed ? "justify-center" : "gap-3 px-4"}`}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Warehouse className="size-4" /></div>
      {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold">Northstar WMS</p><p className="text-[10px] text-muted-foreground">CENTRAL DISTRIBUTION</p></div>}
    </div>
    <nav className="flex-1 overflow-y-auto px-2 py-4">
      {groups.map((group) => <div className="mb-5" key={group.label}>
        {!collapsed && <p className="mb-2 px-2 text-[10px] font-semibold text-muted-foreground">{group.label}</p>}
        <div className="space-y-0.5">{group.items.map(({ label, icon: Icon }) => <button key={label} type="button" title={collapsed ? label : undefined} onClick={() => onNavigate(label)} className={`flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-[13px] transition-colors ${active === label ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
          <Icon className="size-4 shrink-0" />{!collapsed && <span className="truncate">{label}</span>}{!collapsed && active === label && <span className="ml-auto h-4 w-0.5 rounded bg-foreground" />}
        </button>)}</div>
      </div>)}
    </nav>
    <div className={`border-t border-border p-3 ${collapsed ? "flex justify-center" : ""}`}>
      <button onClick={onToggle} className="flex h-8 w-full items-center gap-3 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted" title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <ChevronRight className="size-4" /> : <><ChevronLeft className="size-4" /><span>Collapse sidebar</span></>}
      </button>
    </div>
  </aside>;
}

function TableFrame({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-[13px]">{children}</table></div>;
}

function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <th className={`border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-medium text-muted-foreground ${right ? "text-right" : ""}`}>{children}</th>;
}

function Td({ children, right = false, className = "" }: { children: ReactNode; right?: boolean; className?: string }) {
  return <td className={`border-b border-border px-4 py-3 align-middle ${right ? "text-right" : ""} ${className}`}>{children}</td>;
}

function TableSection({ title, count, children, action }: { title: string; count?: number; children: ReactNode; action?: ReactNode }) {
  return <section className="min-w-0 border border-border bg-background">
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">{title}{count !== undefined && <span className="ml-2 font-normal text-muted-foreground">{count}</span>}</h2>{action}</div>
    {children}
  </section>;
}

function PageHeading({ title, section, action }: { title: Section; section: Section; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span>Warehouse</span><ChevronRight className="size-3" /><span>{section}</span></div><h1 className="text-xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-[13px] text-muted-foreground">{sectionDescriptions[title]}</p></div>{action}
  </div>;
}

function DataToolbar({ search, onSearch, filter, onFilter, filters }: { search: string; onSearch: (value: string) => void; filter: string; onFilter: (value: string) => void; filters: string[] }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
    <div className="relative min-w-[190px] flex-1 sm:max-w-[300px]"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => onSearch(event.target.value)} className="h-9 pl-9 text-xs" placeholder="Search records..." aria-label="Search records" /></div>
    <select value={filter} onChange={(event) => onFilter(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"><option value="All">All statuses</option>{filters.map((item) => <option key={item}>{item}</option>)}</select>
    <Button variant="outline" size="sm" onClick={() => toast.message("Filters are up to date")}><ArrowDownUp className="size-3.5" />Filter</Button>
  </div>;
}

function TextField({ label, name, placeholder, type = "text", required = false, defaultValue }: { label: string; name: string; placeholder?: string; type?: string; required?: boolean; defaultValue?: string }) {
  return <label className="grid gap-1.5 text-xs font-medium text-foreground">{label}<Input name={name} placeholder={placeholder} type={type} required={required} defaultValue={defaultValue} className="h-9 text-sm font-normal" /></label>;
}

function WmsDialog({ open, onOpenChange, section, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; section: Section; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const title = section === "Inbound / Receiving" ? "Create inbound shipment" : section === "Inventory" ? "Add product" : section === "Orders" ? "Create customer order" : section === "Warehouse Locations" ? "Add warehouse location" : "Create record";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[540px]">
    <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Enter the details below. Changes are saved to this demo workspace.</DialogDescription></DialogHeader>
    <form onSubmit={onSubmit} className="grid gap-4 py-2">
      {section === "Inbound / Receiving" && <><div className="grid gap-3 sm:grid-cols-2"><TextField label="Supplier name" name="supplier" placeholder="Supplier" required /><TextField label="Purchase order" name="purchaseOrder" placeholder="PO-84001" required /></div><div className="grid gap-3 sm:grid-cols-2"><TextField label="Expected arrival" name="date" type="date" required /><TextField label="Shipment reference" name="reference" placeholder="ASN-20418" /></div><TextField label="Product SKU" name="sku" placeholder="PRD-1001" required /><div className="grid gap-3 sm:grid-cols-2"><TextField label="Expected quantity" name="quantity" type="number" placeholder="24" required /><TextField label="Notes" name="notes" placeholder="Optional notes" /></div></>}
      {section === "Inventory" && <><div className="grid gap-3 sm:grid-cols-2"><TextField label="SKU" name="sku" placeholder="PRD-1031" required /><TextField label="Product name" name="name" placeholder="Product name" required /></div><div className="grid gap-3 sm:grid-cols-2"><TextField label="Category" name="category" placeholder="Components" required /><TextField label="Unit" name="unit" placeholder="ea" defaultValue="ea" /></div><div className="grid gap-3 sm:grid-cols-2"><TextField label="Quantity" name="quantity" type="number" placeholder="100" required /><TextField label="Minimum stock" name="minStock" type="number" placeholder="20" defaultValue="20" /></div><label className="grid gap-1.5 text-xs font-medium">Storage location<select name="locationId" className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal">{(window.localStorage.getItem("northstar-wms-state-v1") ? JSON.parse(window.localStorage.getItem("northstar-wms-state-v1") ?? "{}").locations ?? [] : []).map((location: { id: string; code: string }) => <option value={location.id} key={location.id}>{location.code}</option>)}</select></label></>}
      {section === "Orders" && <><div className="grid gap-3 sm:grid-cols-2"><TextField label="Customer" name="customer" placeholder="Customer name" required /><TextField label="Order reference" name="reference" placeholder="ORD-59016" /></div><div className="grid gap-3 sm:grid-cols-2"><TextField label="Order date" name="date" type="date" required /><label className="grid gap-1.5 text-xs font-medium">Priority<select name="priority" className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal"><option>Normal</option><option>High</option><option>Urgent</option><option>Low</option></select></label></div><TextField label="Product SKU" name="sku" placeholder="PRD-1001" required /><div className="grid gap-3 sm:grid-cols-2"><TextField label="Requested quantity" name="quantity" type="number" placeholder="4" required /><TextField label="Delivery address" name="address" placeholder="Street, city, state" required /></div></>}
      {section === "Warehouse Locations" && <><div className="grid gap-3 sm:grid-cols-2"><TextField label="Warehouse" name="warehouse" placeholder="WH-01" required /><TextField label="Zone" name="zone" placeholder="Zone A" required /></div><div className="grid gap-3 sm:grid-cols-3"><TextField label="Rack" name="rack" placeholder="R-01" required /><TextField label="Shelf" name="shelf" placeholder="S-01" required /><TextField label="Bin" name="bin" placeholder="B-01" required /></div><TextField label="Maximum capacity (units)" name="capacity" type="number" placeholder="240" required /></>}
      <DialogFooter className="mt-1"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit"><Plus className="size-4" />Save record</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}

export function WmsApp() {
  const { data, setData, signedIn, setSignedIn, ready } = useWms();
  const [active, setActive] = useState<Section>("Dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [remember, setRemember] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dateRange, setDateRange] = useState("Last 7 days");

  const totalUnits = data.products.reduce((sum, product) => sum + product.quantity, 0);
  const availableUnits = data.products.reduce((sum, product) => sum + availableStock(product), 0);
  const pendingOrders = data.orders.filter((order) => ["New", "Confirmed", "Picking"].includes(order.status)).length;
  const lowStock = data.products.filter((product) => availableStock(product) <= product.minStock);
  const occupancy = data.locations.reduce((sum, location) => sum + location.occupied, 0);
  const capacity = data.locations.reduce((sum, location) => sum + location.capacity, 0);
  const utilization = capacity > 0 ? Math.round(occupancy / capacity * 100) : 0;
  const visibleProducts = useMemo(() => data.products.filter((product) => `${product.sku} ${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase())), [data.products, search]);

  const navigate = (section: Section) => {
    setActive(section); setMobileNav(false); setSearch(""); setFilter("All"); setPage(1); setSelectedProduct(null);
  };

  const signIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("email") !== "admin@warehouse.com" || form.get("password") !== "admin123") {
      setLoginError("That email and password do not match. Try the demo account below."); return;
    }
    setLoginLoading(true); setLoginError("");
    window.setTimeout(() => { setSignedIn(true); setLoginLoading(false); if (!remember) window.localStorage.removeItem("northstar-wms-session-v1"); }, 450);
  };

  const createRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (active === "Inbound / Receiving") {
      const sku = String(form.get("sku")).trim();
      const product = data.products.find((item) => item.sku.toLowerCase() === sku.toLowerCase());
      if (!product) { toast.error("Choose a SKU already in inventory."); return; }
      const shipment: InboundShipment = { id: `INB-${String(Date.now()).slice(-5)}`, supplier: String(form.get("supplier")), purchaseOrder: String(form.get("purchaseOrder")), date: String(form.get("date")), status: "Expected", items: [{ sku: product.sku, name: product.name, expected: Number(form.get("quantity")), received: 0, damaged: 0 }] };
      setData((current) => recordActivity({ ...current, inbounds: [shipment, ...current.inbounds] }, "Inbound Created", shipment.id, product.name, shipment.items[0].expected));
      toast.success("Inbound shipment created");
    } else if (active === "Inventory") {
      const sku = String(form.get("sku")).trim();
      if (data.products.some((product) => product.sku.toLowerCase() === sku.toLowerCase())) { toast.error("That SKU already exists."); return; }
      const quantity = Number(form.get("quantity"));
      if (!Number.isFinite(quantity) || quantity < 0) { toast.error("Enter a valid stock quantity."); return; }
      const item: Product = { id: `PRD-${Date.now()}`, sku, name: String(form.get("name")), category: String(form.get("category")), warehouse: "WH-01", locationId: String(form.get("locationId") || data.locations[0]?.id || ""), quantity, reserved: 0, unit: String(form.get("unit") || "ea"), minStock: Number(form.get("minStock") || 20), updated: new Date().toISOString().slice(0, 10) };
      setData((current) => recordActivity({ ...current, products: [item, ...current.products] }, "Product Created", item.sku, item.name, quantity));
      toast.success("Product added to inventory");
    } else if (active === "Orders") {
      const sku = String(form.get("sku")).trim();
      const product = data.products.find((item) => item.sku.toLowerCase() === sku.toLowerCase());
      const quantity = Number(form.get("quantity"));
      if (!product || quantity <= 0 || quantity > availableStock(product)) { toast.error("Choose a valid SKU and quantity within available stock."); return; }
      const order: CustomerOrder = { id: `ORD-${String(Date.now()).slice(-5)}`, customer: String(form.get("customer")), date: String(form.get("date")), priority: String(form.get("priority")) as Priority, status: "New", address: String(form.get("address")), items: [{ sku: product.sku, quantity, picked: 0 }] };
      setData((current) => recordActivity({ ...current, orders: [order, ...current.orders] }, "Order Created", order.id, order.customer, quantity));
      toast.success("Customer order created");
    } else if (active === "Warehouse Locations") {
      const code = `WH-01-${String(form.get("zone")).toUpperCase().replace("ZONE ", "Z")}-${String(form.get("rack")).toUpperCase()}-${String(form.get("shelf")).toUpperCase()}-${String(form.get("bin")).toUpperCase()}`;
      if (data.locations.some((location) => location.code === code)) { toast.error("That location already exists."); return; }
      const id = `LOC-${Date.now().toString().slice(-5)}`;
      setData((current) => recordActivity({ ...current, locations: [{ id, code, warehouse: String(form.get("warehouse")), zone: String(form.get("zone")), rack: String(form.get("rack")), shelf: String(form.get("shelf")), bin: String(form.get("bin")), capacity: Number(form.get("capacity")), occupied: 0, status: "Available" }, ...current.locations] }, "Location Created", id, code));
      toast.success("Warehouse location created");
    }
    setDialogOpen(false);
  };

  const receiveShipment = (shipmentId: string) => {
    const shipment = data.inbounds.find((item) => item.id === shipmentId);
    if (!shipment || shipment.status === "Completed") return;
    const receivedItems = shipment.items.map((line) => ({ ...line, received: line.expected }));
    const tasks = receivedItems.map((line, index) => ({ id: `PUT-${Date.now().toString().slice(-6)}-${index}`, sku: line.sku, quantity: Math.max(0, line.received - line.damaged), suggestedLocationId: data.locations.find((location) => hasLocationCapacity(location, line.received - line.damaged))?.id ?? data.locations[0]?.id ?? "", status: "Pending" as const }));
    setData((current) => recordActivity({ ...current, inbounds: current.inbounds.map((item) => item.id === shipmentId ? { ...item, items: receivedItems, status: "Completed" } : item), putaways: [...tasks, ...current.putaways] }, "Product Received", shipmentId, receivedItems.map((line) => line.name).join(", "), receivedItems.reduce((sum, line) => sum + line.received, 0)));
    toast.success("Receiving complete · stock is ready for putaway");
  };

  const confirmOrder = (order: CustomerOrder) => {
    if (order.status !== "New") return;
    const insufficient = order.items.find((line) => {
      const product = data.products.find((item) => item.sku === line.sku);
      return !product || line.quantity > availableStock(product);
    });
    if (insufficient) { toast.error("Available stock has changed. Review this order before confirming."); return; }
    const pick = { id: `PICK-${String(Date.now()).slice(-6)}`, orderId: order.id, picker: "Jordan Lee", status: "Pending" as const, created: new Date().toISOString().slice(0, 10) };
    setData((current) => recordActivity({ ...current, products: current.products.map((product) => { const line = order.items.find((item) => item.sku === product.sku); return line ? { ...product, reserved: product.reserved + line.quantity } : product; }), orders: current.orders.map((item) => item.id === order.id ? { ...item, status: "Picking" } : item), picks: [pick, ...current.picks] }, "Order Confirmed", order.id, order.customer, order.items.reduce((sum, item) => sum + item.quantity, 0)));
    toast.success("Order confirmed · pick task created");
  };

  const completePick = (orderId: string) => {
    const order = data.orders.find((item) => item.id === orderId);
    if (!order || order.status !== "Picking") return;
    const short = order.items.find((line) => { const product = data.products.find((item) => item.sku === line.sku); return !product || product.reserved < line.quantity || product.quantity < line.quantity; });
    if (short) { setData((current) => ({ ...current, picks: current.picks.map((task) => task.orderId === orderId ? { ...task, status: "Exception" } : task) })); toast.error("Insufficient stock · pick marked as an exception"); return; }
    setData((current) => recordActivity({ ...current,
      products: current.products.map((product) => { const line = order.items.find((item) => item.sku === product.sku); return line ? { ...product, quantity: product.quantity - line.quantity, reserved: Math.max(0, product.reserved - line.quantity), updated: new Date().toISOString().slice(0, 10) } : product; }),
      orders: current.orders.map((item) => item.id === orderId ? { ...item, status: "Ready for Dispatch", items: item.items.map((line) => ({ ...line, picked: line.quantity })) } : item),
      picks: current.picks.map((task) => task.orderId === orderId ? { ...task, status: "Completed" } : task),
      dispatches: [{ id: `DSP-${String(Date.now()).slice(-6)}`, orderId, carrier: "Not assigned", tracking: "—", date: new Date().toISOString().slice(0, 10), status: "Ready for Dispatch" }, ...current.dispatches],
    }, "Picking Completed", orderId, order.customer, order.items.reduce((sum, line) => sum + line.quantity, 0)));
    toast.success("Pick complete · order is ready for dispatch");
  };

  const completePutaway = (taskId: string, locationId: string) => {
    const task = data.putaways.find((item) => item.id === taskId);
    const location = data.locations.find((item) => item.id === locationId);
    if (!task || !location || task.status === "Completed") return;
    if (!hasLocationCapacity(location, task.quantity)) { toast.error("This location does not have enough free capacity."); return; }
    const product = data.products.find((item) => item.sku === task.sku);
    setData((current) => recordActivity({ ...current,
      products: product ? current.products.map((item) => item.sku === task.sku ? { ...item, quantity: item.quantity + task.quantity, locationId: location.id, updated: new Date().toISOString().slice(0, 10) } : item) : current.products,
      locations: current.locations.map((item) => item.id === locationId ? { ...item, occupied: item.occupied + task.quantity, status: item.occupied + task.quantity >= item.capacity ? "Full" : "Partially Occupied" } : item),
      putaways: current.putaways.map((item) => item.id === taskId ? { ...item, assignedLocationId: locationId, status: "Completed" } : item),
    }, "Putaway Completed", task.id, task.sku, task.quantity));
    toast.success("Putaway completed · inventory updated");
  };

  const dispatchOrder = (orderId: string) => {
    const order = data.orders.find((item) => item.id === orderId);
    if (!order || !canDispatchOrder(order)) { toast.error("Complete picking before dispatch."); return; }
    setData((current) => recordActivity({ ...current,
      orders: current.orders.map((item) => item.id === orderId ? { ...item, status: "Dispatched" } : item),
      dispatches: current.dispatches.map((item) => item.orderId === orderId ? { ...item, status: "Dispatched", carrier: item.carrier === "Not assigned" ? "UPS" : item.carrier, tracking: item.tracking === "—" ? `1Z${Date.now().toString().slice(-10)}` : item.tracking, date: new Date().toISOString().slice(0, 10) } : item),
    }, "Shipment Dispatched", orderId, order.customer, order.items.reduce((sum, line) => sum + line.quantity, 0)));
    toast.success("Shipment dispatched");
  };

  const exportCsv = () => {
    const rows = active === "Inventory" || active === "Reports" ? data.products.map((item) => [item.sku, item.name, item.category, item.quantity, item.reserved, availableStock(item), item.unit]) : data.activity.map((item) => [item.id, item.type, item.reference, item.detail, item.quantity, item.user, item.timestamp]);
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${active.toLowerCase().replaceAll(" ", "-")}.csv`; anchor.click(); URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="size-5 animate-spin rounded-full border-2 border-muted border-t-foreground" /></div>;

  if (!signedIn) return <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(420px,0.9fr)_1.1fr]">
    <section className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
      <div className="mx-auto w-full max-w-[370px]">
        <div className="mb-10 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><Warehouse className="size-5" /></div><div><p className="font-semibold">Northstar WMS</p><p className="text-xs text-muted-foreground">Central distribution</p></div></div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1><p className="mt-2 text-sm text-muted-foreground">Keep warehouse operations moving.</p>
        <form className="mt-8 space-y-4" onSubmit={signIn}>
          <TextField label="Work email" name="email" type="email" placeholder="you@company.com" required />
          <label className="grid gap-1.5 text-xs font-medium">Password<div className="relative"><Input name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" required className="h-9 pr-16 text-sm font-normal" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2 text-xs text-muted-foreground hover:text-foreground">{showPassword ? "Hide" : "Show"}</button></div></label>
          <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />Remember me</label><button type="button" onClick={() => toast.message("Contact your workspace administrator to reset access.")} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Forgot password?</button></div>
          {loginError && <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{loginError}</p>}
          <Button type="submit" disabled={loginLoading} className="w-full">{loginLoading ? "Signing in..." : "Sign in"}<ArrowRight className="size-4" /></Button>
        </form>
        <div className="mt-6 border-t border-border pt-5 text-xs text-muted-foreground"><p className="font-medium text-foreground">Demo workspace</p><p className="mt-2 font-mono">admin@warehouse.com</p><p className="mt-1 font-mono">admin123</p></div>
        <p className="mt-8 text-[11px] text-muted-foreground">Frontend demo · sample data is stored in this browser</p>
      </div>
    </section>
    <aside className="relative hidden overflow-hidden border-l border-border bg-muted/30 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <div className="relative flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-success" /> ALL SYSTEMS OPERATIONAL</div>
      <div className="relative max-w-xl"><p className="mb-5 text-xs font-medium text-muted-foreground">WH-01 · CENTRAL DISTRIBUTION</p><p className="text-4xl font-semibold leading-tight tracking-tight">Every movement,<br />accounted for.</p><p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">A clear view of what’s arriving, where it belongs, and what’s going out next.</p><div className="mt-10 grid grid-cols-3 border-y border-border py-5"><div><p className="font-mono text-xl font-semibold">{formatNumber(totalUnits)}</p><p className="mt-1 text-[11px] text-muted-foreground">Units on hand</p></div><div><p className="font-mono text-xl font-semibold">{data.locations.length}</p><p className="mt-1 text-[11px] text-muted-foreground">Active locations</p></div><div><p className="font-mono text-xl font-semibold">{utilization}%</p><p className="mt-1 text-[11px] text-muted-foreground">Capacity used</p></div></div></div>
      <p className="relative text-xs text-muted-foreground">© 2026 Northstar Logistics · Operations platform</p>
    </aside>
  </div>;

  const header = <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6">
    <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu /></Button>
    <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Operations</span><ChevronRight className="size-3" /><span className="font-medium text-foreground">{active}</span></div>
    <div className="md:hidden text-sm font-semibold">{active}</div>
    <div className="relative ml-auto hidden w-full max-w-[260px] sm:block"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && globalSearch.trim()) { setSearch(globalSearch); navigate("Inventory"); setSearch(globalSearch); } }} placeholder="Search anything..." className="h-9 pl-9 pr-12 text-xs" aria-label="Search warehouse records" /><kbd className="absolute right-2.5 top-2 rounded border border-border px-1 text-[10px] text-muted-foreground"><Command className="inline size-2.5" /> K</kbd></div>
    <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" onClick={() => setNotificationsOpen(true)}><Bell /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-warning" /></Button>
    <button onClick={() => navigate("User Profile")} className="flex items-center gap-2 rounded-md p-1 hover:bg-muted"><span className="flex size-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">JL</span><span className="hidden text-left sm:block"><span className="block text-xs font-medium">Jordan Lee</span><span className="block text-[10px] text-muted-foreground">Warehouse admin</span></span><ChevronDown className="hidden size-3 text-muted-foreground sm:block" /></button>
  </header>;

  const toolbar = <DataToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} filter={filter} onFilter={setFilter} filters={active === "Inbound / Receiving" ? ["Expected", "Arrived", "Receiving", "Completed", "Rejected"] : active === "Orders" ? ["New", "Confirmed", "Picking", "Ready for Dispatch", "Dispatched", "Cancelled"] : active === "Picking" ? ["Pending", "In Progress", "Partially Picked", "Completed", "Exception"] : active === "Dispatch" ? ["Ready for Dispatch", "Packed", "Dispatched", "Delivered", "Failed"] : ["In Stock", "Low Stock", "Out of Stock"]} />;

  const actionButton = <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="size-4" />{active === "Inbound / Receiving" ? "New shipment" : active === "Orders" ? "Create order" : active === "Warehouse Locations" ? "Add location" : "Add product"}</Button>;

  let content: ReactNode;
  if (active === "Dashboard") {
    const categoryTotals = Object.entries(data.products.reduce<Record<string, number>>((acc, product) => { acc[product.category] = (acc[product.category] ?? 0) + product.quantity; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const chartColors = ["var(--color-primary)", "var(--color-success)", "var(--color-warning)", "var(--color-info)", "var(--color-muted-foreground)"];
    content = <><PageHeading title="Dashboard" section="Overview" action={<Button variant="outline" size="sm" onClick={() => navigate("Reports")}><ArrowDownToLine className="size-4" />View reports</Button>} />
      <div className="mb-6 grid grid-cols-2 border border-border sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Products" value={formatNumber(data.products.length)} note="Active SKUs" icon={Package} /><Metric label="Stock units" value={formatNumber(totalUnits)} note={`${formatNumber(availableUnits)} available`} icon={Boxes} /><Metric label="Pending orders" value={String(pendingOrders)} note="Awaiting fulfillment" icon={ClipboardList} /><Metric label="Inbound today" value={String(data.inbounds.filter((item) => item.date === new Date().toISOString().slice(0, 10) && item.status !== "Completed").length)} note="Expected arrivals" icon={ArrowDownToLine} /><Metric label="Outbound today" value={String(data.dispatches.filter((item) => item.date === new Date().toISOString().slice(0, 10) && item.status === "Dispatched").length)} note="Shipments dispatched" icon={Truck} /><Metric label="Storage used" value={`${utilization}%`} note={`${formatNumber(occupancy)} / ${formatNumber(capacity)} units`} icon={Warehouse} />
      </div>
      <div className="mb-6 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <section className="border border-border"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">Inbound vs outbound</h2><p className="mt-0.5 text-xs text-muted-foreground">Unit movement · this week</p></div><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-2 rounded-sm bg-primary" />Received <span className="ml-2 size-2 rounded-sm bg-success" />Shipped</span></div><div className="h-[235px] p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={inventoryTrend} barGap={4}><CartesianGrid stroke="var(--color-border)" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} /><Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={{ borderColor: "var(--color-border)", borderRadius: 6, fontSize: 12 }} /><Bar dataKey="received" name="Received" fill="var(--color-primary)" radius={[2, 2, 0, 0]} /><Bar dataKey="shipped" name="Shipped" fill="var(--color-success)" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
        <section className="border border-border"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Inventory by category</h2><p className="mt-0.5 text-xs text-muted-foreground">Units currently on hand</p></div><div className="flex h-[235px] items-center gap-1 px-3"><div className="h-full min-w-0 flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryTotals.map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3} stroke="none">{categoryTotals.map((item, index) => <Cell key={item[0]} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip contentStyle={{ borderColor: "var(--color-border)", borderRadius: 6, fontSize: 12 }} /></PieChart></ResponsiveContainer></div><div className="space-y-2 pr-2">{categoryTotals.map(([name, value], index) => <div key={name} className="flex items-center gap-2 text-[11px]"><span className="size-2 rounded-sm" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="max-w-24 truncate text-muted-foreground">{name}</span><span className="font-mono tabular-nums">{formatNumber(value)}</span></div>)}</div></div></section>
      </div>
      <div className="mb-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <TableSection title="Recent activity" count={data.activity.length}><TableFrame><thead><tr><Th>Activity</Th><Th>Reference</Th><Th>Product / order</Th><Th>Quantity</Th><Th>Time</Th></tr></thead><tbody>{data.activity.slice(0, 5).map((item) => <tr key={item.id} className="hover:bg-muted/30"><Td><span className="font-medium">{item.type}</span></Td><Td className="font-mono text-xs text-muted-foreground">{item.reference}</Td><Td>{item.detail}</Td><Td className="font-mono tabular-nums">{item.quantity}</Td><Td className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Td></tr>)}</tbody></TableFrame><div className="border-t border-border px-4 py-2"><Button variant="link" size="sm" onClick={() => navigate("Activity History")} className="h-7 px-0">View all activity <ArrowRight className="size-3" /></Button></div></TableSection>
        <div className="space-y-4"><TableSection title="Low-stock alerts" count={lowStock.length}><div className="divide-y divide-border">{lowStock.slice(0, 4).map((item) => <button key={item.id} onClick={() => { navigate("Inventory"); setSearch(item.sku); setSelectedProduct(item); }} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/30"><div className="min-w-0"><p className="truncate text-xs font-medium">{item.name}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.sku}</p></div><div className="text-right"><p className="font-mono text-xs font-semibold">{availableStock(item)} {item.unit}</p><p className="text-[10px] text-muted-foreground">min. {item.minStock}</p></div></button>)}</div>{!lowStock.length && <p className="p-5 text-xs text-muted-foreground">All products are above their reorder levels.</p>}</TableSection><TableSection title="Quick actions"><div className="grid grid-cols-2 gap-2 p-3">{[{ label: "Receive products", section: "Inbound / Receiving" as Section, icon: ArrowDownToLine }, { label: "Add inventory", section: "Inventory" as Section, icon: Plus }, { label: "Create an order", section: "Orders" as Section, icon: ClipboardList }, { label: "Start picking", section: "Picking" as Section, icon: PackageCheck }, { label: "View dispatches", section: "Dispatch" as Section, icon: Truck }].map(({ label, section, icon: Icon }) => <Button key={label} variant="outline" size="sm" className="justify-start text-xs" onClick={() => navigate(section)}><Icon className="size-3.5" />{label}</Button>)}</div></TableSection></div>
      </div>
      <TableSection title="Recent customer orders" count={data.orders.length}><TableFrame><thead><tr><Th>Order ID</Th><Th>Customer</Th><Th>Items</Th><Th>Order date</Th><Th>Priority</Th><Th>Status</Th><Th /></tr></thead><tbody>{data.orders.slice(0, 5).map((order) => <tr key={order.id} className="hover:bg-muted/30"><Td className="font-mono text-xs">{order.id}</Td><Td className="font-medium">{order.customer}</Td><Td>{order.items.length}</Td><Td>{shortDate(order.date)}</Td><Td>{order.priority}</Td><Td><StatusBadge>{order.status}</StatusBadge></Td><Td><Button variant="ghost" size="sm" onClick={() => navigate("Orders")}>Open</Button></Td></tr>)}</tbody></TableFrame></TableSection>
    </>;
  } else if (active === "Inventory") {
    const rows = visibleProducts.filter((item) => filter === "All" || (filter === "In Stock" ? availableStock(item) > item.minStock : filter === "Low Stock" ? availableStock(item) <= item.minStock && availableStock(item) > 0 : availableStock(item) === 0));
    const pageRows = rows.slice((page - 1) * 10, page * 10);
    content = <><PageHeading title={active} section="Warehouse operations" action={<><Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" />Export</Button>{actionButton}</>} />{toolbar}<TableSection title="Product inventory" count={rows.length}><TableFrame><thead><tr><Th><Checkbox aria-label="Select all products" /></Th><Th>SKU / product</Th><Th>Category</Th><Th>Location</Th><Th right>Total</Th><Th right>Reserved</Th><Th right>Available</Th><Th>Status</Th><Th /></tr></thead><tbody>{pageRows.map((product) => { const available = availableStock(product); const location = data.locations.find((item) => item.id === product.locationId); const status = available === 0 ? "Out of Stock" : available <= product.minStock ? "Low Stock" : "In Stock"; return <tr key={product.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedProduct(product)}><Td><Checkbox aria-label={`Select ${product.sku}`} onClick={(event) => event.stopPropagation()} /></Td><Td><p className="font-mono text-xs">{product.sku}</p><p className="mt-1 font-medium">{product.name}</p></Td><Td>{product.category}</Td><Td className="font-mono text-[11px] text-muted-foreground">{location?.code ?? "—"}</Td><Td right className="font-mono tabular-nums">{formatNumber(product.quantity)}</Td><Td right className="font-mono tabular-nums text-muted-foreground">{formatNumber(product.reserved)}</Td><Td right className="font-mono font-semibold tabular-nums">{formatNumber(available)} <span className="text-[10px] font-normal text-muted-foreground">{product.unit}</span></Td><Td><StatusBadge>{status}</StatusBadge></Td><Td><Button variant="ghost" size="icon" aria-label={`More options for ${product.sku}`} onClick={(event) => { event.stopPropagation(); setSelectedProduct(product); }}><Ellipsis /></Button></Td></tr>; })}</tbody></TableFrame><div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground"><span>Showing {rows.length ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, rows.length)} of {rows.length}</span><div className="flex gap-1"><Button variant="outline" size="icon" className="size-7" disabled={page === 1} aria-label="Previous page" onClick={() => setPage(page - 1)}><ChevronLeft /></Button><Button variant="outline" size="icon" className="size-7" disabled={page * 10 >= rows.length} aria-label="Next page" onClick={() => setPage(page + 1)}><ChevronRight /></Button></div></div></TableSection>{selectedProduct && <section className="fixed inset-y-0 right-0 z-30 w-full max-w-[420px] overflow-y-auto border-l border-border bg-background p-5 shadow-xl"><div className="mb-5 flex justify-between"><div><p className="font-mono text-xs text-muted-foreground">{selectedProduct.sku}</p><h2 className="mt-1 text-lg font-semibold">{selectedProduct.name}</h2></div><Button variant="ghost" size="icon" aria-label="Close product details" onClick={() => setSelectedProduct(null)}><X /></Button></div><div className="grid grid-cols-2 border-y border-border py-4"><div><p className="text-xs text-muted-foreground">Total stock</p><p className="mt-1 font-mono text-lg">{selectedProduct.quantity}</p></div><div><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 font-mono text-lg">{availableStock(selectedProduct)}</p></div></div><div className="mt-5 space-y-4 text-sm"><div><p className="text-xs text-muted-foreground">Category</p><p className="mt-1">{selectedProduct.category}</p></div><div><p className="text-xs text-muted-foreground">Warehouse location</p><p className="mt-1 font-mono text-xs">{data.locations.find((location) => location.id === selectedProduct.locationId)?.code ?? "Not assigned"}</p></div><div><p className="mb-2 text-xs font-semibold">Recent stock activity</p>{data.activity.filter((item) => item.detail === selectedProduct.name || item.reference === selectedProduct.sku).slice(0, 5).map((item) => <p key={item.id} className="border-t border-border py-2 text-xs">{item.type}<span className="float-right text-muted-foreground">{item.quantity} · {shortDate(item.timestamp)}</span></p>)}</div></div></section>}</>;
  } else if (active === "Inbound / Receiving") {
    const rows = data.inbounds.filter((item) => `${item.id} ${item.supplier} ${item.purchaseOrder}`.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || item.status === filter));
    content = <><PageHeading title={active} section="Warehouse operations" action={actionButton} />{toolbar}<TableSection title="Inbound shipments" count={rows.length}><TableFrame><thead><tr><Th>Shipment</Th><Th>Supplier</Th><Th>Purchase order</Th><Th>Expected arrival</Th><Th>Products</Th><Th right>Total qty</Th><Th>Status</Th><Th>Actions</Th></tr></thead><tbody>{rows.map((shipment) => <tr key={shipment.id} className="hover:bg-muted/30"><Td className="font-mono text-xs">{shipment.id}</Td><Td className="font-medium">{shipment.supplier}</Td><Td className="font-mono text-xs text-muted-foreground">{shipment.purchaseOrder}</Td><Td>{shortDate(shipment.date)}</Td><Td>{shipment.items.length}</Td><Td right className="font-mono">{shipment.items.reduce((sum, item) => sum + item.expected, 0)}</Td><Td><StatusBadge>{shipment.status}</StatusBadge></Td><Td>{shipment.status !== "Completed" && shipment.status !== "Rejected" ? <Button size="sm" variant="outline" onClick={() => receiveShipment(shipment.id)}><Check className="size-3.5" />Receive</Button> : <Button variant="ghost" size="sm" onClick={() => toast.message(`${shipment.items.length} product line · ${shipment.items[0]?.received ?? 0} units received`)}>Details</Button>}</Td></tr>)}</tbody></TableFrame></TableSection></>;
  } else if (active === "Putaway") {
    const rows = data.putaways.filter((item) => `${item.id} ${item.sku}`.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || item.status === filter));
    content = <><PageHeading title={active} section="Warehouse operations" /><TableSection title="Putaway tasks" count={rows.length}><div className="border-b border-border p-3"><div className="relative max-w-xs"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search putaway tasks" className="h-9 pl-9 text-xs" /></div></div><TableFrame><thead><tr><Th>Putaway ID</Th><Th>Product</Th><Th right>Qty received</Th><Th>Suggested location</Th><Th>Assigned location</Th><Th>Status</Th><Th>Action</Th></tr></thead><tbody>{rows.map((task) => { const product = data.products.find((item) => item.sku === task.sku); const location = data.locations.find((item) => item.id === task.suggestedLocationId); return <tr key={task.id}><Td className="font-mono text-xs">{task.id}</Td><Td><span className="font-mono text-[11px] text-muted-foreground">{task.sku}</span><p className="mt-1 font-medium">{product?.name ?? task.sku}</p></Td><Td right className="font-mono">{task.quantity}</Td><Td className="font-mono text-[11px]">{location?.code ?? "—"}</Td><Td>{task.assignedLocationId ? <span className="font-mono text-[11px]">{data.locations.find((item) => item.id === task.assignedLocationId)?.code}</span> : <span className="text-xs text-muted-foreground">Unassigned</span>}</Td><Td><StatusBadge>{task.status}</StatusBadge></Td><Td>{task.status !== "Completed" ? <select aria-label={`Choose location for ${task.id}`} className="h-8 max-w-44 rounded-md border border-input bg-background px-2 text-[11px]" defaultValue={task.suggestedLocationId} onChange={(event) => completePutaway(task.id, event.target.value)}><option value="">Select location</option>{data.locations.filter((item) => hasLocationCapacity(item, task.quantity)).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.capacity - item.occupied} free</option>)}</select> : <span className="text-xs text-muted-foreground">Stored</span>}</Td></tr>; })}</tbody></TableFrame><p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Capacity is validated before stock is added to inventory.</p></TableSection></>;
  } else if (active === "Warehouse Locations") {
    const rows = data.locations.filter((item) => `${item.code} ${item.zone} ${item.warehouse}`.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || item.status === filter));
    content = <><PageHeading title={active} section="Warehouse operations" action={actionButton} />{toolbar}<TableSection title="Storage locations" count={rows.length}><TableFrame><thead><tr><Th>Location code</Th><Th>Warehouse</Th><Th>Zone</Th><Th>Rack / shelf / bin</Th><Th right>Capacity</Th><Th right>Occupied</Th><Th right>Available</Th><Th>Utilization</Th><Th>Status</Th></tr></thead><tbody>{rows.map((location) => { const pct = Math.round(location.occupied / location.capacity * 100); return <tr key={location.id} className="hover:bg-muted/30"><Td className="font-mono text-xs">{location.code}</Td><Td>{location.warehouse.split(" · ")[0]}</Td><Td>{location.zone}</Td><Td className="font-mono text-[11px] text-muted-foreground">{location.rack} / {location.shelf} / {location.bin}</Td><Td right className="font-mono">{location.capacity}</Td><Td right className="font-mono">{location.occupied}</Td><Td right className="font-mono">{location.capacity - location.occupied}</Td><Td><div className="flex items-center gap-2"><div className="h-1.5 w-16 bg-muted"><span className="block h-full bg-primary" style={{ width: `${pct}%` }} /></div><span className="font-mono text-[11px]">{pct}%</span></div></Td><Td><StatusBadge>{location.status}</StatusBadge></Td></tr>; })}</tbody></TableFrame></TableSection></>;
  } else if (active === "Orders") {
    const rows = data.orders.filter((item) => `${item.id} ${item.customer}`.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || item.status === filter));
    content = <><PageHeading title={active} section="Order management" action={actionButton} />{toolbar}<TableSection title="Customer orders" count={rows.length}><TableFrame><thead><tr><Th>Order ID</Th><Th>Customer</Th><Th>Date</Th><Th>Items / qty</Th><Th>Priority</Th><Th>Status</Th><Th>Actions</Th></tr></thead><tbody>{rows.map((order) => <tr key={order.id} className="hover:bg-muted/30"><Td className="font-mono text-xs">{order.id}</Td><Td className="font-medium">{order.customer}</Td><Td>{shortDate(order.date)}</Td><Td>{order.items.length} / {order.items.reduce((sum, item) => sum + item.quantity, 0)}</Td><Td><StatusBadge>{order.priority}</StatusBadge></Td><Td><StatusBadge>{order.status}</StatusBadge></Td><Td>{order.status === "New" ? <Button variant="outline" size="sm" onClick={() => confirmOrder(order)}>Confirm order</Button> : order.status === "Ready for Dispatch" ? <Button variant="outline" size="sm" onClick={() => navigate("Dispatch")}>Dispatch</Button> : <Button variant="ghost" size="sm" onClick={() => toast.message(`${order.items.length} item line · ${order.address}`)}>Details</Button>}</Td></tr>)}</tbody></TableFrame></TableSection></>;
  } else if (active === "Picking") {
    const rows = data.picks.filter((task) => { const order = data.orders.find((item) => item.id === task.orderId); return `${task.id} ${task.orderId} ${order?.customer ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || task.status === filter); });
    content = <><PageHeading title={active} section="Order management" /><TableSection title="Picking tasks" count={rows.length}><div className="border-b border-border p-3"><div className="relative max-w-xs"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pick tasks" className="h-9 pl-9 text-xs" /></div></div><TableFrame><thead><tr><Th>Pick task</Th><Th>Order / customer</Th><Th>Products</Th><Th right>Total qty</Th><Th>Picker</Th><Th>Priority</Th><Th>Status</Th><Th>Action</Th></tr></thead><tbody>{rows.map((task) => { const order = data.orders.find((item) => item.id === task.orderId); const product = order?.items[0] ? data.products.find((item) => item.sku === order.items[0].sku) : undefined; return <tr key={task.id}><Td className="font-mono text-xs">{task.id}</Td><Td><span className="font-mono text-[11px] text-muted-foreground">{task.orderId}</span><p className="mt-1 font-medium">{order?.customer ?? "—"}</p></Td><Td><p>{product?.name ?? "—"}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{product?.sku} · {data.locations.find((item) => item.id === product?.locationId)?.code ?? "location pending"}</p></Td><Td right className="font-mono">{order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0}</Td><Td>{task.picker}</Td><Td>{order?.priority ?? "Normal"}</Td><Td><StatusBadge>{task.status}</StatusBadge></Td><Td>{task.status !== "Completed" && task.status !== "Exception" && order?.status === "Picking" ? <Button size="sm" onClick={() => completePick(order.id)}><Check className="size-3.5" />Complete pick</Button> : task.status === "Completed" ? <span className="text-xs text-muted-foreground">Picked</span> : <Button variant="ghost" size="sm" onClick={() => order && confirmOrder(order)} disabled={!order || order.status !== "New"}>Open order</Button>}</Td></tr>; })}</tbody></TableFrame><div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Available stock is reserved when an order is confirmed and deducted once picking is complete.</div></TableSection></>;
  } else if (active === "Dispatch") {
    const rows = data.dispatches.filter((item) => { const order = data.orders.find((record) => record.id === item.orderId); return `${item.id} ${item.orderId} ${order?.customer ?? ""} ${item.tracking}`.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || item.status === filter); });
    content = <><PageHeading title={active} section="Order management" /><TableSection title="Dispatches" count={rows.length}><div className="border-b border-border p-3"><div className="relative max-w-xs"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dispatches" className="h-9 pl-9 text-xs" /></div></div><TableFrame><thead><tr><Th>Dispatch</Th><Th>Order / customer</Th><Th>Items</Th><Th>Carrier</Th><Th>Tracking ref.</Th><Th>Dispatch date</Th><Th>Status</Th><Th>Action</Th></tr></thead><tbody>{rows.map((dispatch) => { const order = data.orders.find((item) => item.id === dispatch.orderId); return <tr key={dispatch.id}><Td className="font-mono text-xs">{dispatch.id}</Td><Td><span className="font-mono text-[11px] text-muted-foreground">{dispatch.orderId}</span><p className="mt-1 font-medium">{order?.customer ?? "—"}</p></Td><Td>{order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0}</Td><Td>{dispatch.carrier}</Td><Td className="font-mono text-[11px]">{dispatch.tracking}</Td><Td>{shortDate(dispatch.date)}</Td><Td><StatusBadge>{dispatch.status}</StatusBadge></Td><Td>{dispatch.status === "Ready for Dispatch" || dispatch.status === "Packed" ? <Button size="sm" onClick={() => dispatchOrder(dispatch.orderId)}><Truck className="size-3.5" />Confirm dispatch</Button> : <Button variant="ghost" size="sm" onClick={() => toast.message(`Tracking reference ${dispatch.tracking}`)}>Details</Button>}</Td></tr>; })}</tbody></TableFrame></TableSection></>;
  } else if (active === "Activity History") {
    const rows = data.activity.filter((item) => `${item.id} ${item.type} ${item.reference} ${item.detail} ${item.user}`.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || item.status === filter));
    content = <><PageHeading title={active} section="Management" action={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" />Export CSV</Button>} />{toolbar}<TableSection title="Warehouse transactions" count={rows.length}><TableFrame><thead><tr><Th>Transaction ID</Th><Th>Activity type</Th><Th>Reference</Th><Th>Product / order</Th><Th right>Quantity</Th><Th>User</Th><Th>Timestamp</Th><Th>Status</Th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><Td className="font-mono text-xs">{item.id}</Td><Td className="font-medium">{item.type}</Td><Td className="font-mono text-xs text-muted-foreground">{item.reference}</Td><Td>{item.detail}</Td><Td right className="font-mono">{item.quantity || "—"}</Td><Td>{item.user}</Td><Td className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Td><Td><StatusBadge>{item.status}</StatusBadge></Td></tr>)}</tbody></TableFrame></TableSection></>;
  } else if (active === "Reports") {
    content = <><PageHeading title={active} section="Management" action={<div className="flex gap-2"><select value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-xs"><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select><Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" />Export CSV</Button></div>} /><div className="grid gap-4 lg:grid-cols-2"><section className="border border-border"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Stock movement</h2><p className="mt-1 text-xs text-muted-foreground">Inbound and outbound quantity · {dateRange.toLowerCase()}</p></div><div className="h-64 p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={inventoryTrend}><CartesianGrid stroke="var(--color-border)" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="received" fill="var(--color-primary)" radius={[2, 2, 0, 0]} /><Bar dataKey="shipped" fill="var(--color-success)" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div></section><TableSection title="Inventory summary" count={data.products.length}><TableFrame><thead><tr><Th>Category</Th><Th right>Products</Th><Th right>Units</Th><Th right>Low stock</Th></tr></thead><tbody>{Object.entries(data.products.reduce<Record<string, { count: number; units: number; low: number }>>((acc, item) => { const entry = acc[item.category] ?? { count: 0, units: 0, low: 0 }; entry.count += 1; entry.units += item.quantity; entry.low += availableStock(item) <= item.minStock ? 1 : 0; acc[item.category] = entry; return acc; }, {})).map(([category, stats]) => <tr key={category}><Td>{category}</Td><Td right>{stats.count}</Td><Td right className="font-mono">{formatNumber(stats.units)}</Td><Td right>{stats.low}</Td></tr>)}</tbody></TableFrame></TableSection><section className="border border-border"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Warehouse utilization</h2><p className="mt-1 text-xs text-muted-foreground">Current capacity across active locations</p></div><div className="divide-y divide-border">{data.locations.slice(0, 6).map((location) => <div className="flex items-center gap-3 px-4 py-3" key={location.id}><span className="w-40 truncate font-mono text-xs">{location.code}</span><div className="h-1.5 flex-1 bg-muted"><span className="block h-full bg-primary" style={{ width: `${Math.round(location.occupied / location.capacity * 100)}%` }} /></div><span className="w-10 text-right font-mono text-xs">{Math.round(location.occupied / location.capacity * 100)}%</span></div>)}</div></section><TableSection title="Low-stock report" count={lowStock.length}><TableFrame><thead><tr><Th>SKU</Th><Th>Product</Th><Th right>Available</Th><Th right>Reorder level</Th><Th>Status</Th></tr></thead><tbody>{lowStock.map((product) => <tr key={product.id}><Td className="font-mono text-xs">{product.sku}</Td><Td>{product.name}</Td><Td right className="font-mono">{availableStock(product)}</Td><Td right className="font-mono">{product.minStock}</Td><Td><StatusBadge>Low Stock</StatusBadge></Td></tr>)}</tbody></TableFrame></TableSection></div></>;
  } else if (active === "Settings" || active === "User Profile") {
    content = <><PageHeading title={active} section="Settings" /><div className="max-w-3xl space-y-5"><TableSection title="General settings"><form className="grid gap-4 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); toast.success("Workspace preferences saved"); }}><TextField label="Workspace name" name="workspace" defaultValue="Northstar Logistics" /><TextField label="Primary warehouse" name="warehouse" defaultValue="WH-01 · Central Distribution" /><label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2"><Checkbox defaultChecked />Receive alerts for low-stock products</label><label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2"><Checkbox defaultChecked />Show inbound and dispatch notifications</label><Button className="w-fit" type="submit">Save preferences</Button></form></TableSection><TableSection title="User profile"><div className="flex flex-wrap items-center gap-4 p-4"><div className="flex size-12 items-center justify-center rounded-full bg-secondary font-semibold">JL</div><div className="flex-1"><p className="text-sm font-medium">Jordan Lee</p><p className="mt-1 text-xs text-muted-foreground">admin@warehouse.com · Warehouse administrator</p></div><Button variant="outline" size="sm" onClick={() => { setSignedIn(false); navigate("Dashboard"); }}> <LogOut className="size-4" />Sign out</Button></div></TableSection><p className="text-xs text-muted-foreground">This workspace is a frontend demonstration. Preferences and sample operations remain in this browser.</p></div></>;
  } else {
    content = <><PageHeading title={active} section="Operations" /><section className="border border-border py-16 text-center"><CheckCircle2 className="mx-auto size-8 text-success" /><h2 className="mt-3 text-sm font-semibold">You’re all caught up</h2><p className="mt-1 text-xs text-muted-foreground">There are no open tasks right now.</p></section></>;
  }

  return <div className="flex h-screen min-h-[560px] overflow-hidden bg-background text-foreground">
    <AppSidebar active={active} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onNavigate={navigate} />
    <div className="flex min-w-0 flex-1 flex-col">{header}<main className="flex-1 overflow-auto"><div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{content}<footer className="mt-8 border-t border-border pt-4 text-[11px] text-muted-foreground">Northstar WMS <span className="px-1">·</span> WH-01 Central Distribution <span className="px-1">·</span> Demo workspace</footer></div></main></div>
    <Sheet open={mobileNav} onOpenChange={setMobileNav}><SheetContent side="left" className="w-[280px] p-0"><SheetHeader className="border-b border-border p-4 text-left"><SheetTitle className="flex items-center gap-2 text-sm"><Warehouse className="size-4" />Northstar WMS</SheetTitle></SheetHeader><nav className="overflow-y-auto p-2">{groups.map((group) => <div className="mb-4" key={group.label}><p className="px-2 py-2 text-[10px] font-semibold text-muted-foreground">{group.label}</p>{group.items.map(({ label, icon: Icon }) => <button key={label} onClick={() => navigate(label)} className={`flex h-10 w-full items-center gap-3 rounded-md px-2 text-left text-sm ${active === label ? "bg-accent font-medium" : "text-muted-foreground hover:bg-muted"}`}><Icon className="size-4" />{label}</button>)}</div>)}</nav></SheetContent></Sheet>
    <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Notifications</DialogTitle><DialogDescription>Recent warehouse alerts and updates.</DialogDescription></DialogHeader><div className="divide-y divide-border">{lowStock.slice(0, 4).map((product) => <div key={product.id} className="flex items-start gap-3 py-3"><span className="mt-0.5 size-2 rounded-full bg-warning" /><div><p className="text-sm font-medium">Low stock · {product.name}</p><p className="mt-1 text-xs text-muted-foreground">{availableStock(product)} available · reorder at {product.minStock}</p></div></div>)}{!lowStock.length && <p className="py-6 text-center text-xs text-muted-foreground">No new notifications.</p>}</div></DialogContent></Dialog>
    <WmsDialog open={dialogOpen} onOpenChange={setDialogOpen} section={active} onSubmit={createRecord} />
  </div>;
}