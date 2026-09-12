"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type DensityMode = "summary" | "expert";

interface DensityContextType {
  density: DensityMode;
  setDensity: (mode: DensityMode) => void;
  toggleDensity: () => void;
}

const DensityContext = createContext<DensityContextType>({
  density: "summary",
  setDensity: () => {},
  toggleDensity: () => {},
});

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<DensityMode>("summary");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("calpeo_density") as DensityMode | null;
      if (saved === "summary" || saved === "expert") {
        setDensityState(saved);
      }
    }
  }, []);

  const setDensity = (mode: DensityMode) => {
    setDensityState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("calpeo_density", mode);
    }
  };

  const toggleDensity = () => {
    const next = density === "summary" ? "expert" : "summary";
    setDensity(next);
  };

  return (
    <DensityContext.Provider value={{ density, setDensity, toggleDensity }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  return useContext(DensityContext);
}
