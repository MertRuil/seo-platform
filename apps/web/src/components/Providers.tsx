"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { DensityProvider } from "@/context/DensityContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SiteProvider } from "@/context/SiteContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <SiteProvider>
            <DensityProvider>{children}</DensityProvider>
          </SiteProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
