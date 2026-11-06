import { createFileRoute } from "@tanstack/react-router";
import { WmsApp } from "@/components/wms-app";
import { WmsProvider } from "@/state/wms-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Warehouse Management System | Operations" },
      { name: "description", content: "Manage receiving, inventory, locations, picking, and warehouse dispatch operations." },
      { property: "og:title", content: "Warehouse Management System | Operations" },
      { property: "og:description", content: "Manage receiving, inventory, locations, picking, and warehouse dispatch operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <WmsProvider>
      <WmsApp />
    </WmsProvider>
  ),
});
