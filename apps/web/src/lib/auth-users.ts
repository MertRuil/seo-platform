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
  attempts: number;
}

export interface FailedAttemptRecord {
  count: number;
  updatedAt: number;
}

const MAX_RESET_CODE_ATTEMPTS = 5;
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

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
  __seoFailedAttempts?: Record<string, FailedAttemptRecord>;
  __seoResetCodes?: Record<string, ResetRecord>;
};

function getInitialUsers(): UserRecord[] {
  const users: UserRecord[] = [];
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    users.push({
      id: "usr_admin_initial",
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      fullName: "Sistem Yöneticisi",
      role: "Süper Yönetici",
      isAdmin: true,
      isSuperAdmin: true,
      permissions: ["*"],
      createdAt: new Date().toISOString(),
    });
  } else if (process.env.NODE_ENV !== "production") {
    // Generate secure ephemeral credentials at boot time for development only
    const ephemeralPassword = crypto.randomBytes(16).toString("hex");
    const devEmail = "admin@seo-platform.local";
    users.push({
      id: "usr_dev_admin",
      email: devEmail,
      passwordHash: hashPassword(ephemeralPassword),
      fullName: "Geliştirici Yönetici (Dinamik)",
      role: "Süper Yönetici",
      isAdmin: true,
      isSuperAdmin: true,
      permissions: ["*"],
      createdAt: new Date().toISOString(),
    });
    if (typeof window === "undefined") {
      console.log(`\x1b[33m[Güvenlik] Geliştirme ortamı için dinamik geçici yönetici oluşturuldu:\x1b[0m`);
      console.log(`\x1b[36m  E-posta : ${devEmail}\x1b[0m`);
      console.log(`\x1b[36m  Şifre   : ${ephemeralPassword}\x1b[0m`);
      console.log(`\x1b[90m  (Üretim ortamında INITIAL_ADMIN_EMAIL ve INITIAL_ADMIN_PASSWORD ortam değişkenlerini ayarlayın)\x1b[0m`);
    }
  }
  return users;
}

if (!globalAuth.__seoUsers) {
  globalAuth.__seoUsers = getInitialUsers();
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
      attempts: 0,
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

    // 6-digit OTP: cap guesses so the code cannot be brute-forced within its TTL
    const codeBuf = Buffer.from(code.trim());
    const expectedBuf = Buffer.from(resetRecord.code);
    const codeMatches = codeBuf.length === expectedBuf.length && crypto.timingSafeEqual(codeBuf, expectedBuf);
    if (!codeMatches) {
      resetRecord.attempts += 1;
      if (resetRecord.attempts >= MAX_RESET_CODE_ATTEMPTS) {
        if (globalAuth.__seoResetCodes) delete globalAuth.__seoResetCodes[clean];
        return { success: false, error: "Çok fazla hatalı kod denemesi. Kod iptal edildi; lütfen yeni kod talep edin." };
      }
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
    return globalAuth.__seoFailedAttempts?.[clean]?.count || 0;
  },

  isLockedOut: (email: string): boolean => {
    const clean = email.trim().toLowerCase();
    const rec = globalAuth.__seoFailedAttempts?.[clean];
    if (!rec) return false;
    return rec.count >= LOCKOUT_THRESHOLD && Date.now() - rec.updatedAt < LOCKOUT_WINDOW_MS;
  },

  incrementFailedAttempts: (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!globalAuth.__seoFailedAttempts) globalAuth.__seoFailedAttempts = {};
    const prev = globalAuth.__seoFailedAttempts[clean];
    const now = Date.now();
    // Window expired -> start counting again
    const count = prev && now - prev.updatedAt < LOCKOUT_WINDOW_MS ? prev.count + 1 : 1;
    globalAuth.__seoFailedAttempts[clean] = { count, updatedAt: now };
    return count;
  },

  clearFailedAttempts: (email: string) => {
    const clean = email.trim().toLowerCase();
    if (globalAuth.__seoFailedAttempts) {
      delete globalAuth.__seoFailedAttempts[clean];
    }
  }
};
