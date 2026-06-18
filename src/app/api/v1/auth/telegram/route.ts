import { z } from "zod";
import { handle, ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { serverEnv } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyTelegramLogin } from "@/lib/telegram/auth";
import { ensureTelegramProfile, telegramEmail } from "@/lib/telegram/profile";

/**
 * Telegram-OTP / login-widget sign-in.
 *
 * Telegram is not a Supabase-native provider, so we verify the widget payload
 * server-side (HMAC over the bot token), map the Telegram identity to a Supabase
 * auth user (synthetic email keyed by Telegram id), mint a session via the admin
 * `generateLink` → `verifyOtp` exchange (which sets the SSR cookie), and link the
 * Telegram id onto the domain Profile.
 *
 * NOTE (known Phase-1 limitation): a Telegram login creates/uses its own auth user
 * keyed by Telegram id; cross-channel account merging (same person via phone AND
 * Telegram) is a later enhancement. See OQ-8 (Sybil) and ADR-0002.
 */

// Telegram widget fields are loosely typed; we accept the bag and let the HMAC verify it.
const payloadSchema = z.record(z.string(), z.unknown());

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const botToken = serverEnv.telegramBotToken;
    if (!botToken) {
      throw new ApiError("INTERNAL", "Telegram login is not configured.");
    }

    const body = payloadSchema.parse(await req.json());
    const verified = verifyTelegramLogin(body, botToken);
    if (!verified) {
      throw ApiError.unauthorized("Telegram verification failed.");
    }

    // Ensure the auth user + linked Profile exist (shared with the bot).
    await ensureTelegramProfile(verified);

    // Mint a browser session: generateLink gives a one-time email OTP we exchange
    // on the SSR client, which sets the auth cookie.
    const admin = getServiceClient();
    const email = telegramEmail(verified.telegramUserId);
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link.properties?.email_otp) {
      throw new ApiError("INTERNAL", "Could not start the Telegram session.");
    }

    const supabase = await createClient();
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: link.properties.email_otp,
      type: "email",
    });
    if (verifyErr) {
      throw new ApiError("INTERNAL", "Could not establish the Telegram session.");
    }

    return ok({ ok: true, telegramUserId: verified.telegramUserId });
  });
}
