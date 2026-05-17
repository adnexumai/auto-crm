"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsPanel } from "@/components/prospeccion/AnalyticsPanel";
import { SyncStatusPanel } from "@/components/prospeccion/SyncStatusPanel";

export default function SistemaPage() {
  return (
    <Tabs defaultValue="analytics">
      <TabsList className="mb-3 grid w-full grid-cols-2">
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="sync">Conexiones</TabsTrigger>
      </TabsList>
      <TabsContent value="analytics">
        <AnalyticsPanel />
      </TabsContent>
      <TabsContent value="sync">
        <SyncStatusPanel />
      </TabsContent>
    </Tabs>
  );
}
