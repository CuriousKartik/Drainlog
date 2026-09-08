"use client";

import React, { ReactNode } from "react";
import AppSidebar from "@/components/AppSidebar";
import AppHeader from "@/components/AppHeader";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-text-primary flex flex-col font-mono selection:bg-accent-orange-light">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto px-8 md:px-10 py-8 bg-cream">
          {children}
        </main>
      </div>
    </div>
  );
}