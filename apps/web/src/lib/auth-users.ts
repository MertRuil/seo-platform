import crypto from "crypto";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
  createdAt?: string;
}

export interface ResetRecord {
  code: string;
  expiresAt: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256").toString("hex");
  return `${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes("$")) return false;
  const [salt, hash] = storedHash.split("$");
  const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computedHash, "hex"));
}

// Global in-memory storage for serverless runtime
const globalAuth = global as unknown as {
  __seoUsers?: UserRecord[];
  __seoFailedAttempts?: Record<string, number>;
  __seoResetCodes?: Record<string, ResetRecord>;
};

if (!globalAuth.__seoUsers) {
  globalAuth.__seoUsers = [
    {
      id: "usr_mert_01",
      email: "mert@seo.com",
      passwordHash: "44cd44e4d34ca19433e79f7ad6daf558$cd0de28852b33fe22b857570260df5b15a3222a421341ef9f2e2835c8ebcbe17",
      fullName: "Mert Ruil",
      role: "Süper Yönetici (Kurucu)",
      isAdmin: true,
      isSuperAdmin: true,
      permissions: ["*"],
    },
    {
      id: "usr_aybo_01",
      email: "aybo@seo.com",
      passwordHash: "76de7a8cd5a9ad5647c8412152a4b252$c7c3050663f9815b986d490e6dd5d5f37e9245f20baff07a1c6b7c5d8d6de7b4",
      fullName: "Aybo",
      role: "Süper Yönetici (Ortak)",
      isAdmin: true,
      isSuperAdmin: true,
      permissions: ["*"],
    },
    {
      id: "usr_admin_01",
      email: "admin@seo-platform.local",
      passwordHash: "55b041acb8acfcd64dda50ea6e4dc880$72004314720fe2ec7e447a5b230d240b32160f4709b45598613687c2d5e93d79",
      fullName: "Platform Administrator",
      role: "Süper Yönetici",
      isAdmin: true,
      isSuperAdmin: true,
      permissions: ["*"],
    },
    {
      id: "usr_partner_01",
      email: "ekip@seoplatform.com",
      passwordHash: "a7de0ef94f58fb77882f0972d2722e91$67c4a135f2e92e81cd32288df98d942ba063f40611a57c0826a9ae99f98226ca",
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

if (!globalAuth.__seoResetCodes) {
  globalAuth.__seoResetCodes = {};
}

export const authStore = {
  getUsers: () => globalAuth.__seoUsers || [],
  
  findUserByEmail: (email: string) => {
    const clean = email.trim().toLowerCase();
    return (globalAuth.__seoUsers || []).find((u) => u.email.toLowerCase() === clean);
  },

  addUser: (user: Omit<UserRecord, "passwordHash"> & { password: string }) => {
    if (!globalAuth.__seoUsers) globalAuth.__seoUsers = [];
    const record: UserRecord = {
      id: user.id,
      email: user.email,
      passwordHash: hashPassword(user.password),
      fullName: user.fullName,
      role: user.role,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.permissions,
      createdAt: user.createdAt,
    };
    globalAuth.__seoUsers.push(record);
    return record;
  },

  verifyUserPassword: (email: string, plaintext: string): boolean => {
    const user = authStore.findUserByEmail(email);
    if (!user) return false;
    return verifyPassword(plaintext, user.passwordHash);
  },

  createResetCode: (email: string): string => {
    const clean = email.trim().toLowerCase();
    if (!globalAuth.__seoResetCodes) globalAuth.__seoResetCodes = {};
    const code = crypto.randomInt(100000, 999999).toString();
    globalAuth.__seoResetCodes[clean] = {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes TTL
    };
    return code;
  },

  verifyAndResetPassword: (email: string, code: string, newPassword: string): { success: boolean; error?: string } => {
    const clean = email.trim().toLowerCase();
    const resetRecord = globalAuth.__seoResetCodes?.[clean];

    if (!resetRecord) {
      return { success: false, error: "Geçerli bir şifre sıfırlama talebi bulunamadı. Lütfen tekrar kod talep edin." };
    }

    if (Date.now() > resetRecord.expiresAt) {
      if (globalAuth.__seoResetCodes) delete globalAuth.__seoResetCodes[clean];
      return { success: false, error: "Şifre sıfırlama kodunun süresi doldu (10 dakika). Lütfen yeni kod isteyin." };
    }

    if (resetRecord.code !== code.trim()) {
      return { success: false, error: "Girdiğiniz sıfırlama kodu hatalı." };
    }

    const user = authStore.findUserByEmail(clean);
    if (!user) {
      return { success: false, error: "Kullanıcı hesabı bulunamadı." };
    }

    user.passwordHash = hashPassword(newPassword);
    if (globalAuth.__seoResetCodes) delete globalAuth.__seoResetCodes[clean];
    authStore.clearFailedAttempts(clean);
    return { success: true };
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
