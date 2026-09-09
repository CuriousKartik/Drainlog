"use client";

import React, { ReactNode } from "react";
import { SimulationProvider } from "@/context/SimulationContext";

export function Providers({ children }: { children: ReactNode }) {
  return <SimulationProvider>{children}</SimulationProvider>;
}
