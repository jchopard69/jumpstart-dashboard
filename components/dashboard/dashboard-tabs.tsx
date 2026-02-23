"use client";

import { type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type DashboardTabsProps = {
  insightsTab: ReactNode;
  performanceTab: ReactNode;
  contentsTab: ReactNode;
};

export function DashboardTabs({ insightsTab, performanceTab, contentsTab }: DashboardTabsProps) {
  return (
    <Tabs defaultValue="insights" className="w-full">
      <TabsList className="w-full justify-start gap-1 rounded-xl bg-muted/50 p-1.5">
        <TabsTrigger
          value="insights"
          className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Insights
        </TabsTrigger>
        <TabsTrigger
          value="performance"
          className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Performance
        </TabsTrigger>
        <TabsTrigger
          value="contents"
          className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Contenus
        </TabsTrigger>
      </TabsList>

      <TabsContent value="insights" className="mt-6 space-y-4">
        {insightsTab}
      </TabsContent>

      <TabsContent value="performance" className="mt-6 space-y-4">
        {performanceTab}
      </TabsContent>

      <TabsContent value="contents" className="mt-6 space-y-4">
        {contentsTab}
      </TabsContent>
    </Tabs>
  );
}
