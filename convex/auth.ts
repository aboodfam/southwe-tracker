import Google from "@auth/core/providers/google";
import { convexAuth, getAuthUserId, type EmailConfig } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { LIMITS, cleanText, enforceRateLimit } from "./security";

function createResetCodeProvider(): EmailConfig {
  return {
    id: "ceventic-reset-code",
    type: "email",
    name: "Ceventic password reset",
    from: process.env.AUTH_EMAIL_FROM ?? "Ceventic <onboarding@resend.dev>",
    apiKey: process.env.RESEND_API_KEY ?? "",
    maxAge: 10 * 60,
    async generateVerificationToken() {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      return String(bytes[0] % 1_000_000).padStart(6, "0");
    },
    normalizeIdentifier(identifier) {
      return identifier.trim().toLowerCase();
    },
    async sendVerificationRequest({ identifier, token, provider }) {
      if (!provider.apiKey || !provider.from) {
        throw new Error("Password recovery email is not configured yet");
      }
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: provider.from,
          to: identifier,
          subject: `${token} is your Ceventic reset code`,
          text: `Your Ceventic password reset code is ${token}. It expires in 10 minutes.`,
          html: `<div style="font-family:Arial,sans-serif;background:#070707;color:#f5f5f5;padding:32px;border-radius:18px"><p style="margin:0 0 8px;color:#a3a3a3;font-size:13px;letter-spacing:.08em;text-transform:uppercase">Ceventic security</p><h1 style="margin:0 0 20px;font-size:22px">Reset your password</h1><div style="font-size:34px;font-weight:800;letter-spacing:.24em;margin:20px 0">${token}</div><p style="color:#a3a3a3;line-height:1.6">This code expires in 10 minutes. If you did not request a password reset, ignore this email.</p></div>`,
        }),
      });
      if (!response.ok) throw new Error("Could not send the password reset email");
    },
  };
}

const passwordProvider = Password({
  reset: createResetCodeProvider(),
  profile(params) {
    const email = String(params.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@") || email.length > 254) throw new Error("Enter a valid email address");
    return { email };
  },
  validatePasswordRequirements(password) {
    if (password.length < 8 || password.length > 128) {
      throw new Error("Password must be between 8 and 128 characters");
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [passwordProvider, Google],
});

export const loggedInUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // getAuthUserId already proves this request has an authenticated user. The
    // UI only needs a truthy result, so avoid an extra auth-table read and do
    // not expose the raw user/email document.
    return { authenticated: true as const };
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;
    return {
      displayName: profile.displayName,
      nameConfirmed: profile.nameConfirmed === true,
    };
  },
});

export const setDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await enforceRateLimit(ctx, userId, "profile:name", 12, 60_000);
    const displayName = cleanText(args.displayName, "Name", LIMITS.profileName, { minLength: 2 });

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { displayName, nameConfirmed: true, updatedAt });
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId,
      displayName,
      nameConfirmed: true,
      updatedAt,
    });
  },
});
