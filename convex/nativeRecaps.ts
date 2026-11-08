import {
  mutation,
  query,
  internalQuery,
  httpAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  assertCurrentLocalDate,
  cleanText,
  enforceRateLimit,
} from "./security";
import { readProgress } from "./progress";
import {
  closedRecapPeriods,
  validDeviceHash,
  hashDeviceToken,
  previousRecapPeriod,
  recapTotals,
} from "./nativeRecapModel";

export const connectDevice = mutation({
  args: {
    tokenHash: v.string(),
    label: v.string(),
    accentHex: v.string(),
    locale: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx),
      sessionId = await getAuthSessionId(ctx);
    if (!userId || !sessionId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (
      !session ||
      session.userId !== userId ||
      session.expirationTime <= Date.now()
    )
      throw new Error("Sign in again to connect this device.");
    if (
      !validDeviceHash(args.tokenHash) ||
      !/^#[A-Fa-f0-9]{6}$/.test(args.accentHex) ||
      !["en", "ar", "es", "fr", "zh"].includes(args.locale)
    )
      throw new Error("Invalid device settings.");
    await enforceRateLimit(ctx, userId, "native:connect", 12, 60000);
    const existing = await ctx.db
      .query("nativeDevices")
      .withIndex("by_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (existing && existing.userId !== userId)
      throw new Error("Disconnect the previous account on this device first.");
    const expiresAt = Math.min(
      session.expirationTime,
      Date.now() + 30 * 86400000,
    );
    const data = {
      sessionId,
      label: cleanText(args.label, "Device", 64),
      accentHex: args.accentHex.toUpperCase(),
      locale: args.locale,
      expiresAt,
    };
    if (existing) await ctx.db.patch(existing._id, data);
    else {
      const devices = await ctx.db
        .query("nativeDevices")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const device of devices)
        if (device.expiresAt <= Date.now()) await ctx.db.delete(device._id);
      if (devices.filter((device) => device.expiresAt > Date.now()).length >= 5)
        throw new Error("Five recap devices are already connected.");
      await ctx.db.insert("nativeDevices", {
        userId,
        tokenHash: args.tokenHash,
        createdAt: Date.now(),
        ...data,
      });
    }
    return { userId, expiresAt };
  },
});
export const disconnectDevice = mutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const device = await ctx.db
      .query("nativeDevices")
      .withIndex("by_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (device?.userId === userId) await ctx.db.delete(device._id);
  },
});
export const listDevices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const devices = await ctx.db
      .query("nativeDevices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return devices
      .filter((device) => device.expiresAt > Date.now())
      .map((device) => ({
        id: device._id,
        label: device.label,
        code: device.tokenHash.slice(0, 8).toUpperCase(),
        createdAt: device.createdAt,
      }));
  },
});
export const revokeDevice = mutation({
  args: { deviceId: v.id("nativeDevices") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.userId !== userId)
      throw new Error("Device not found");
    await ctx.db.delete(device._id);
  },
});
export const readDeviceRecaps = internalQuery({
  args: { tokenHash: v.string(), dateKey: v.string() },
  handler: async (ctx, args) => {
    if (!validDeviceHash(args.tokenHash)) return null;
    const device = await ctx.db
      .query("nativeDevices")
      .withIndex("by_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!device || device.expiresAt <= Date.now()) return null;
    const [session, user, prefs, reset] = await Promise.all([
      ctx.db.get(device.sessionId),
      ctx.db.get(device.userId),
      ctx.db
        .query("workspacePreferences")
        .withIndex("by_user", (q) => q.eq("userId", device.userId))
        .first(),
      ctx.db
        .query("dailyResetState")
        .withIndex("by_user", (q) => q.eq("userId", device.userId))
        .first(),
    ]);
    if (
      !session ||
      session.userId !== device.userId ||
      session.expirationTime <= Date.now() ||
      !user
    )
      return null;
    const today = assertCurrentLocalDate(args.dateKey);
    const periods = closedRecapPeriods(today);
    const start = periods
      .map((period) => previousRecapPeriod(period).start)
      .sort()[0];
    const hidden = prefs?.hiddenPages ?? [];
    const [history, athkar] = await Promise.all([
      readProgress(
        ctx,
        device.userId,
        start,
        today,
        reset?.lastResetDate ?? null,
      ),
      ctx.db
        .query("athkarCompletions")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", device.userId).gte("date", start).lt("date", today),
        )
        .collect(),
    ]);
    return {
      version: 1,
      comparisonVersion: 1,
      userId: device.userId,
      expiresAt: device.expiresAt,
      localDate: today,
      generatedAt: Date.now(),
      accentHex: device.accentHex,
      locale: device.locale,
      periods: periods
        .map((period) => ({
          ...recapTotals(
            period,
            history,
            athkar.map((row) => row.date),
            hidden,
          ),
          hiddenPages: hidden,
          previous: recapTotals(
            previousRecapPeriod(period),
            history,
            athkar.map((row) => row.date),
            hidden,
          ),
        }))
        .filter((period) => period.activeDays > 0),
    };
  },
});
// A separate, expiring read-only capability. Never accept a user id from the request.
export const serveRecaps = httpAction(async (ctx, request) => {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  };
  const auth = request.headers.get("Authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(auth))
    return new Response('{"error":"Unauthorized"}', { status: 401, headers });
  if (Number(request.headers.get("Content-Length") ?? 0) > 1024)
    return new Response("{}", { status: 413, headers });
  try {
    const text = await request.text();
    if (text.length > 1024) return new Response("{}", { status: 413, headers });
    const body = JSON.parse(text);
    const dateKey = assertCurrentLocalDate(body.dateKey);
    const result = await ctx.runQuery(internal.nativeRecaps.readDeviceRecaps, {
      tokenHash: await hashDeviceToken(auth.slice(7)),
      dateKey,
    });
    return new Response(JSON.stringify(result ?? { error: "Unauthorized" }), {
      status: result ? 200 : 401,
      headers,
    });
  } catch {
    return new Response('{"error":"Invalid request"}', {
      status: 400,
      headers,
    });
  }
});
