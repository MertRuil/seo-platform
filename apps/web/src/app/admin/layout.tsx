"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AdminTabs } from "@/components/admin/AdminUi";
import { EmptyState } from "@/components/ui/States";

/** Menü girişi ve bu kapı yalnızca görünüm içindir; her uç arka uçta veritabanından yetki kontrolü yapar. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user?.isAdmin) {
    return (
      <div className="max-w-7xl mx-auto">
        <EmptyState icon={<Lock className="w-8 h-8" />} title="Bu bölüm yalnızca platform yöneticilerine açık" description="Platform ekibindenseniz yöneticilik yetkisi için başka bir yöneticiye başvurun." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <AdminTabs currentPath={pathname} />
      {children}
    </div>
  );
}
