import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertCurrentLocalDate } from "./security";
export async function recordAthkarCompletion(
  ctx: MutationCtx,
  userId: Id<"users">,
  category: string,
  key: string,
  date: string,
) {
  // Legacy undated sessions cannot be safely assigned to the user's calendar.
  try {
    assertCurrentLocalDate(date);
  } catch {
    return;
  }
  const existing = await ctx.db
    .query("athkarCompletions")
    .withIndex("by_user_session", (q) =>
      q.eq("userId", userId).eq("sessionKey", key),
    )
    .unique();
  if (!existing)
    await ctx.db.insert("athkarCompletions", {
      userId,
      category,
      sessionKey: key,
      date,
      completedAt: Date.now(),
    });
}
