"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type DensityMode = "summary" | "expert";

interface DensityContextType {
  density: DensityMode;
  isExpert: boolean;
  showLevelModal: boolean;
  setShowLevelModal: (show: boolean) => void;
  setDensity: (mode: DensityMode) => void;
  selectLevel: (mode: DensityMode) => void;
  toggleDensity: () => void;
}

const DensityContext = createContext<DensityContextType>({
  density: "summary",
  isExpert: false,
  showLevelModal: false,
  setShowLevelModal: () => {},
  setDensity: () => {},
  selectLevel: () => {},
  toggleDensity: () => {},
});

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<DensityMode>("summary");
  const [showLevelModal, setShowLevelModal] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("calpeo_density") as DensityMode | null;
      if (saved === "summary" || saved === "expert") {
        setDensityState(saved);
      }
      const chosen = localStorage.getItem("calpeo_level_chosen");
      if (!chosen) {
        // Kullanıcı daha önce seviye seçimi yapmadıysa modalı aç
        setShowLevelModal(true);
      }
    }
  }, []);

  const setDensity = (mode: DensityMode) => {
    setDensityState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("calpeo_density", mode);
    }
  };

  const selectLevel = (mode: DensityMode) => {
    setDensity(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("calpeo_level_chosen", "true");
    }
    setShowLevelModal(false);
  };

  const toggleDensity = () => {
    const next = density === "summary" ? "expert" : "summary";
    setDensity(next);
  };

  return (
    <DensityContext.Provider
      value={{
        density,
        isExpert: density === "expert",
        showLevelModal,
        setShowLevelModal,
        setDensity,
        selectLevel,
        toggleDensity,
      }}
    >
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  return useContext(DensityContext);
}
