// Runnable check: compile with tsc (see test-security-suite.ts) and run with node
import assert from "node:assert";
import { authStore, LOCKOUT_THRESHOLD } from "./src/lib/auth-users";

const email = `guard_${Date.now()}@example.com`;
authStore.addUser({ id: "u1", email, password: "CorrectPassword123!", fullName: "G", role: "Kullanıcı" });

// 1. Login lockout: 5 failures -> locked, even before the 6th password check
for (let i = 0; i < LOCKOUT_THRESHOLD; i++) authStore.incrementFailedAttempts(email);
assert(authStore.isLockedOut(email), "account must be locked after 5 failures");
authStore.clearFailedAttempts(email);
assert(!authStore.isLockedOut(email));

// 2. OTP brute-force cap: 5 wrong codes invalidates the reset code entirely
const code = authStore.createResetCode(email);
for (let i = 0; i < 4; i++) {
  const r = authStore.verifyAndResetPassword(email, "000000", "NewPassword123!");
  assert(!r.success);
}
const fifth = authStore.verifyAndResetPassword(email, "000000", "NewPassword123!");
assert(!fifth.success && /iptal/.test(fifth.error || ""), "5th wrong guess must invalidate the code");
const realCodeAfter = authStore.verifyAndResetPassword(email, code, "NewPassword123!");
assert(!realCodeAfter.success, "correct code must no longer work once invalidated");

// 3. Fresh code with correct value still works
const code2 = authStore.createResetCode(email);
assert(authStore.verifyAndResetPassword(email, code2, "NewPassword123!").success);
assert(authStore.verifyUserPassword(email, "NewPassword123!"));

console.log("auth guards OK");
