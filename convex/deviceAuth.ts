import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { cleanText, enforceRateLimit } from "./security";

const TRUST_DAYS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 6;

function emailSecurityConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim());
}

function assertHash(value: string, label: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`${label} is invalid`);
  return value.toLowerCase();
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createSixDigitCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "your email";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
}

export const getDeviceTrust = query({
  args: { deviceHash: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (!emailSecurityConfigured()) {
      // Do not lock users out until the owner finishes the one-time email setup.
      return { enabled: false, trusted: true, expiresAt: null };
    }

    const deviceHash = assertHash(args.deviceHash, "Device");
    const trusted = await ctx.db
      .query("trustedDevices")
      .withIndex("by_user_token", (q) => q.eq("userId", userId).eq("tokenHash", deviceHash))
      .first();

    if (!trusted || trusted.expiresAt <= Date.now()) {
      return { enabled: true, trusted: false, expiresAt: trusted?.expiresAt ?? null };
    }

    return { enabled: true, trusted: true, expiresAt: trusted.expiresAt };
  },
});

export const requestDeviceCode = action({
  args: { deviceHash: v.string(), label: v.string() },
  handler: async (ctx, args): Promise<{ maskedEmail: string; expiresInSeconds: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (!emailSecurityConfigured()) throw new Error("Email verification is not configured yet");

    const deviceHash = assertHash(args.deviceHash, "Device");
    const code = createSixDigitCode();
    const codeHash = await sha256Hex(code);

    const prepared: { email: string } = await ctx.runMutation(internal.deviceAuth.prepareDeviceChallenge, {
      userId,
      deviceHash,
      codeHash,
      label: args.label,
    });

    const apiKey = process.env.RESEND_API_KEY!;
    const from = process.env.AUTH_EMAIL_FROM!;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: prepared.email,
        subject: `${code} is your Ceventic security code`,
        text: `Your Ceventic security code is ${code}. It expires in 10 minutes. If you did not try to sign in, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;background:#070707;color:#f5f5f5;padding:32px;border-radius:18px"><p style="margin:0 0 8px;color:#a3a3a3;font-size:13px;letter-spacing:.08em;text-transform:uppercase">Ceventic security</p><h1 style="margin:0 0 20px;font-size:22px">Verify this device</h1><div style="font-size:34px;font-weight:800;letter-spacing:.24em;margin:20px 0">${code}</div><p style="color:#a3a3a3;line-height:1.6">This code expires in 10 minutes. After verification, this device stays trusted for 30 days.</p></div>`,
      }),
    });

    if (!response.ok) {
      await ctx.runMutation(internal.deviceAuth.clearDeviceChallenge, { userId, deviceHash });
      throw new Error("Could not send the verification email. Please try again.");
    }

    return { maskedEmail: maskEmail(prepared.email), expiresInSeconds: CODE_TTL_MS / 1000 };
  },
});

export const verifyDeviceCode = action({
  args: { code: v.string(), deviceToken: v.string(), label: v.string() },
  handler: async (ctx, args): Promise<{ trustedUntil: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const code = args.code.trim();
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code");
    if (args.deviceToken.length < 32 || args.deviceToken.length > 256) throw new Error("Device token is invalid");

    const [codeHash, deviceHash] = await Promise.all([
      sha256Hex(code),
      sha256Hex(args.deviceToken),
    ]);

    await ctx.runMutation(internal.deviceAuth.verifyDeviceChallenge, {
      userId,
      deviceHash,
      codeHash,
      label: args.label,
    });

    return { trustedUntil: Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000 };
  },
});

export const prepareDeviceChallenge = internalMutation({
  args: {
    userId: v.id("users"),
    deviceHash: v.string(),
    codeHash: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args): Promise<{ email: string }> => {
    const deviceHash = assertHash(args.deviceHash, "Device");
    assertHash(args.codeHash, "Code");
    const label = cleanText(args.label, "Device label", 80, { minLength: 2 });
    await enforceRateLimit(ctx, args.userId, "device:code", 5, 10 * 60 * 1000);

    const user = await ctx.db.get(args.userId);
    const email = user?.email?.trim().toLowerCase();
    if (!email) throw new Error("No email address is available for this account");

    const existing = await ctx.db
      .query("deviceVerificationChallenges")
      .withIndex("by_user_device", (q) => q.eq("userId", args.userId).eq("deviceHash", deviceHash))
      .first();

    const payload = {
      codeHash: args.codeHash.toLowerCase(),
      label,
      expiresAt: Date.now() + CODE_TTL_MS,
      attempts: 0,
      sentAt: Date.now(),
    };

    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("deviceVerificationChallenges", { userId: args.userId, deviceHash, ...payload });

    return { email };
  },
});

export const verifyDeviceChallenge = internalMutation({
  args: {
    userId: v.id("users"),
    deviceHash: v.string(),
    codeHash: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const deviceHash = assertHash(args.deviceHash, "Device");
    const codeHash = assertHash(args.codeHash, "Code");
    const label = cleanText(args.label, "Device label", 80, { minLength: 2 });

    const challenge = await ctx.db
      .query("deviceVerificationChallenges")
      .withIndex("by_user_device", (q) => q.eq("userId", args.userId).eq("deviceHash", deviceHash))
      .first();

    if (!challenge || challenge.expiresAt <= Date.now()) {
      if (challenge) await ctx.db.delete(challenge._id);
      throw new Error("That code expired. Request a new one.");
    }
    if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new Error("Too many incorrect attempts. Request a new code.");
    }
    if (challenge.codeHash !== codeHash) {
      await ctx.db.patch(challenge._id, { attempts: challenge.attempts + 1 });
      throw new Error("Incorrect code");
    }

    const existing = await ctx.db
      .query("trustedDevices")
      .withIndex("by_user_token", (q) => q.eq("userId", args.userId).eq("tokenHash", deviceHash))
      .first();

    const now = Date.now();
    const expiresAt = now + TRUST_DAYS * 24 * 60 * 60 * 1000;
    if (existing) {
      await ctx.db.patch(existing._id, { label, expiresAt, lastVerifiedAt: now });
    } else {
      await ctx.db.insert("trustedDevices", {
        userId: args.userId,
        tokenHash: deviceHash,
        label,
        createdAt: now,
        lastVerifiedAt: now,
        expiresAt,
      });
    }

    // The device code also proves possession of the account email. Mark the
    // Auth user email as verified so a later Google OAuth sign-in with the same
    // verified address can safely link to the existing Ceventic user.
    const user = await ctx.db.get(args.userId);
    if (user && user.email && user.emailVerificationTime === undefined) {
      await ctx.db.patch(args.userId, { emailVerificationTime: now });
    }

    await ctx.db.delete(challenge._id);
  },
});

export const clearDeviceChallenge = internalMutation({
  args: { userId: v.id("users"), deviceHash: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const challenge = await ctx.db
      .query("deviceVerificationChallenges")
      .withIndex("by_user_device", (q) => q.eq("userId", args.userId).eq("deviceHash", args.deviceHash))
      .first();
    if (challenge) await ctx.db.delete(challenge._id);
  },
});
