export interface UserRecord {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
  createdAt?: string;
}

// Global in-memory storage for serverless runtime
const globalAuth = global as unknown as {
  __seoUsers?: UserRecord[];
  __seoFailedAttempts?: Record<string, number>;
};

if (!globalAuth.__seoUsers) {
  globalAuth.__seoUsers = [
    {
      id: "usr_mert_01",
      email: "mert@seo.com",
      password: "0706Ma*",
      fullName: "Mert Ruil",
      role: "Süper Yönetici (Kurucu)",
      isAdmin: true,
      isSuperAdmin: true,
      permissions: ["*"],
    },
    {
      id: "usr_aybo_01",
      email: "aybo@seo.com",
      password: "kardesler123",
      fullName: "Aybo",
      role: "Süper Yönetici (Ortak)",
      isAdmin: true,
      isSuperAdmin: true,
      permissions: ["*"],
    },
    {
      id: "usr_admin_01",
      email: "admin@seo-platform.local",
      password: "AdminPass123!",
      fullName: "Platform Administrator",
      role: "Süper Yönetici",
      isAdmin: true,
      isSuperAdmin: true,
      permissions: ["*"],
    },
    {
      id: "usr_partner_01",
      email: "ekip@seoplatform.com",
      password: "Ekip123!",
      fullName: "SEO Ekip Üyesi",
      role: "SEO Uzmanı",
      isAdmin: false,
      isSuperAdmin: false,
      permissions: ["read", "crawl", "audit"],
    }
  ];
}

if (!globalAuth.__seoFailedAttempts) {
  globalAuth.__seoFailedAttempts = {};
}

export const authStore = {
  getUsers: () => globalAuth.__seoUsers || [],
  
  findUserByEmail: (email: string) => {
    const clean = email.trim().toLowerCase();
    return (globalAuth.__seoUsers || []).find((u) => u.email.toLowerCase() === clean);
  },

  addUser: (user: UserRecord) => {
    if (!globalAuth.__seoUsers) globalAuth.__seoUsers = [];
    globalAuth.__seoUsers.push(user);
    return user;
  },

  updatePassword: (email: string, newPassword: string) => {
    const user = authStore.findUserByEmail(email);
    if (user) {
      user.password = newPassword;
      return true;
    }
    return false;
  },

  getFailedAttempts: (email: string) => {
    const clean = email.trim().toLowerCase();
    return globalAuth.__seoFailedAttempts?.[clean] || 0;
  },

  incrementFailedAttempts: (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!globalAuth.__seoFailedAttempts) globalAuth.__seoFailedAttempts = {};
    const count = (globalAuth.__seoFailedAttempts[clean] || 0) + 1;
    globalAuth.__seoFailedAttempts[clean] = count;
    return count;
  },

  clearFailedAttempts: (email: string) => {
    const clean = email.trim().toLowerCase();
    if (globalAuth.__seoFailedAttempts) {
      delete globalAuth.__seoFailedAttempts[clean];
    }
  }
};
