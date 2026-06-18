import { Role, type Profile } from "@prisma/client";
import { getServiceClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { TELEGRAM_EMAIL_DOMAIN } from "@/lib/env";
import type { VerifiedTelegramUser } from "./auth";

/** Synthetic email mapping a Telegram identity to a Supabase auth user. */
export function telegramEmail(telegramUserId: string): string {
  return `tg_${telegramUserId}@${TELEGRAM_EMAIL_DOMAIN}`;
}

/**
 * Ensure a Supabase auth user + linked domain Profile exist for a verified Telegram
 * identity, and return the Profile. Trusts that `verified` is already authenticated
 * out-of-band — HMAC for the login widget, or the webhook secret token for bot
 * updates (Telegram authenticates `message.from`). Used by both the web login route
 * (which additionally mints a session) and the bot (which only needs the Profile).
 *
 * Known Phase-1 limitation: a Telegram identity gets its own auth user; cross-channel
 * account merging (same person via phone AND Telegram) is a later enhancement. ADR-0002.
 */
export async function ensureTelegramProfile(
  verified: VerifiedTelegramUser,
): Promise<Profile> {
  const existing = await prisma.profile.findUnique({
    where: { telegramUserId: verified.telegramUserId },
  });

  let userId = existing?.id ?? null;
  if (!userId) {
    const admin = getServiceClient();
    const email = telegramEmail(verified.telegramUserId);
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        telegram_user_id: verified.telegramUserId,
        telegram_username: verified.username,
        full_name: verified.fullName,
      },
    });
    if (created.data?.user) {
      userId = created.data.user.id;
    } else {
      // Auth user already exists — resolve its id via generateLink.
      const { data } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      userId = data?.user?.id ?? null;
    }
    if (!userId) {
      throw new Error("Could not resolve Telegram auth user.");
    }
  }

  return prisma.profile.upsert({
    where: { id: userId },
    update: {
      telegramUserId: verified.telegramUserId,
      telegramUsername: verified.username ?? null,
      telegramLinkedAt: new Date(),
      ...(verified.fullName ? { fullName: verified.fullName } : {}),
    },
    create: {
      id: userId,
      telegramUserId: verified.telegramUserId,
      telegramUsername: verified.username ?? null,
      telegramLinkedAt: new Date(),
      fullName: verified.fullName ?? null,
      roles: [Role.RECEIVER],
    },
  });
}
