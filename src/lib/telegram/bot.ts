import type { Language } from "@prisma/client";
import type { CategoryCap } from "@/lib/domain/rules-engine";
import type { ActiveLegSummary } from "@/lib/db/ports";
import type { VerifiedTelegramUser } from "./auth";

/**
 * Telegram bot command router. PURE orchestration: all I/O is injected via BotDeps
 * so the router is unit-testable without a live bot, DB, or services. The webhook
 * adapter (telegram/webhook route) wires the real deps and sends the returned text.
 *
 * The bot is a full self-serve surface for users who never open the website:
 * browse who's traveling, see what's packable (lawful personal-use caps), post a
 * send request or a trip, and check status. Same service layer as the web app.
 */

export interface BotProfile {
  id: string;
  language: Language;
}

export interface BotShipmentSummary {
  id: string;
  status: string;
  originRegion: string;
  destinationRegion: string;
}

export interface BotSendInput {
  senderId: string;
  originRegion: string;
  destinationRegion: string;
  category: string;
  weightKg: number;
  units: number;
  receiverPhone: string;
  receiverName: string;
}

export interface BotTripInput {
  travelerId: string;
  originRegion: string;
  destinationRegion: string;
  departAt: Date;
  capacityKg: number;
}

export interface BotDeps {
  /** Ensure/link the auth user + Profile for this verified Telegram identity. */
  ensureProfile(tg: VerifiedTelegramUser): Promise<BotProfile>;
  setLanguage(profileId: string, language: Language): Promise<void>;
  listTravelers(originRegion: string, destinationRegion: string): Promise<ActiveLegSummary[]>;
  packableCaps(originRegion: string, destinationRegion: string): Promise<CategoryCap[]>;
  createShipment(input: BotSendInput): Promise<{ id: string; totalPriceEtb: number }>;
  listShipments(profileId: string): Promise<BotShipmentSummary[]>;
  createTrip(input: BotTripInput): Promise<{ id: string }>;
  /** Capture a demand/search signal (intelligence). Best-effort; never throws to the user. */
  logDemand(originRegion: string, destinationRegion: string, category?: string): Promise<void>;
}

export interface BotUpdate {
  text: string;
  from: VerifiedTelegramUser;
}

const HELP_EN = [
  "🧳 *Shanta* — send & carry through people you trust.",
  "",
  "Commands:",
  "• /travelers FROM TO — who's traveling a route",
  "• /pack FROM TO — what you can pack (personal-use limits)",
  "• /send FROM TO CATEGORY WEIGHTKG RECEIVER_PHONE [NAME] — request a send",
  "• /trip FROM TO YYYY-MM-DD CAPACITYKG — post a trip (needs verified ID)",
  "• /status — your shipments",
  "• /lang am|en — set language",
  "",
  "Use exact city/region names, e.g. `Addis Ababa`, `Dubai`.",
].join("\n");

const HELP_AM = [
  "🧳 *ሻንታ* — በምታምኗቸው ሰዎች ይላኩ፣ ይሸከሙ።",
  "",
  "ትዕዛዞች:",
  "• /travelers FROM TO — በመንገዱ ላይ ማን እየተጓዘ ነው",
  "• /pack FROM TO — ምን መያዝ ይችላሉ (የግል አጠቃቀም ገደብ)",
  "• /send FROM TO CATEGORY WEIGHTKG RECEIVER_PHONE [NAME] — ለመላክ ይጠይቁ",
  "• /trip FROM TO YYYY-MM-DD CAPACITYKG — ጉዞ ያስመዝግቡ (የተረጋገጠ መታወቂያ ያስፈልጋል)",
  "• /status — የእርስዎ ጭነቶች",
  "• /lang am|en — ቋንቋ ይምረጡ",
].join("\n");

function help(lang: Language): string {
  return lang === "AM" ? HELP_AM : HELP_EN;
}

function tokenize(text: string): { cmd: string; args: string[] } {
  const parts = text.trim().split(/\s+/);
  const cmd = (parts[0] ?? "").toLowerCase().replace(/@.*$/, ""); // strip @botname
  return { cmd, args: parts.slice(1) };
}

/**
 * Handle one inbound message and return the reply text. Never throws — user-facing
 * errors are returned as readable text so the webhook always answers with 200.
 */
export async function handleBotCommand(
  update: BotUpdate,
  deps: BotDeps,
): Promise<string> {
  const { cmd, args } = tokenize(update.text);

  // Browse commands don't require an account; everything else ensures a profile.
  try {
    switch (cmd) {
      case "/start":
      case "/help":
      case "/menu":
      case "/lang": {
        const profile = await deps.ensureProfile(update.from);
        if (cmd === "/lang") {
          const choice = (args[0] ?? "").toLowerCase();
          if (choice !== "am" && choice !== "en") {
            return "Usage: /lang am  |  /lang en";
          }
          const lang: Language = choice === "am" ? "AM" : "EN";
          await deps.setLanguage(profile.id, lang);
          return help(lang);
        }
        return help(profile.language);
      }

      case "/travelers": {
        const [from, to] = args;
        if (!from || !to) return "Usage: /travelers FROM TO";
        await deps.logDemand(from, to);
        const legs = await deps.listTravelers(from, to);
        if (legs.length === 0) {
          return `No travelers found for ${from} → ${to} yet. We'll match you when one posts a trip.`;
        }
        const lines = legs.slice(0, 10).map((l) => {
          const date = l.departAt.toISOString().slice(0, 10);
          return `• ${date} — ${l.availableCapacityKg}kg free`;
        });
        return [`✈️ Travelers ${from} → ${to}:`, ...lines].join("\n");
      }

      case "/pack": {
        const [from, to] = args;
        if (!from || !to) return "Usage: /pack FROM TO";
        const caps = await deps.packableCaps(from, to);
        if (caps.length === 0) return `No item rules configured for ${from} → ${to}.`;
        const lines = caps.map((c) => formatCap(c));
        return [
          `📦 What you can pack ${from} → ${to} (per person):`,
          ...lines,
          "",
          "Limits are each traveler's lawful personal-use allowance.",
        ].join("\n");
      }

      case "/status": {
        const profile = await deps.ensureProfile(update.from);
        const shipments = await deps.listShipments(profile.id);
        if (shipments.length === 0) return "You have no shipments yet. Use /send to start one.";
        const lines = shipments
          .slice(0, 10)
          .map((s) => `• ${s.originRegion} → ${s.destinationRegion}: ${humanizeStatus(s.status)}`);
        return ["📋 Your shipments:", ...lines].join("\n");
      }

      case "/send": {
        const profile = await deps.ensureProfile(update.from);
        const [from, to, category, weightRaw, receiverPhone, ...nameParts] = args;
        if (!from || !to || !category || !weightRaw || !receiverPhone) {
          return "Usage: /send FROM TO CATEGORY WEIGHTKG RECEIVER_PHONE [NAME]";
        }
        const weightKg = Number(weightRaw);
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
          return "WEIGHTKG must be a positive number, e.g. 2.5";
        }
        const result = await deps.createShipment({
          senderId: profile.id,
          originRegion: from,
          destinationRegion: to,
          category: category.toUpperCase(),
          weightKg,
          units: 1,
          receiverPhone,
          receiverName: nameParts.join(" ") || "Receiver",
        });
        return `✅ Send request created (${result.totalPriceEtb} ETB). Drop your item at the hub. Track with /status.`;
      }

      case "/trip": {
        const profile = await deps.ensureProfile(update.from);
        const [from, to, dateRaw, capacityRaw] = args;
        if (!from || !to || !dateRaw || !capacityRaw) {
          return "Usage: /trip FROM TO YYYY-MM-DD CAPACITYKG";
        }
        const departAt = new Date(dateRaw);
        if (Number.isNaN(departAt.getTime())) return "Date must be YYYY-MM-DD.";
        const capacityKg = Number(capacityRaw);
        if (!Number.isFinite(capacityKg) || capacityKg <= 0) {
          return "CAPACITYKG must be a positive number.";
        }
        const trip = await deps.createTrip({
          travelerId: profile.id,
          originRegion: from,
          destinationRegion: to,
          departAt,
          capacityKg,
        });
        return `✅ Trip posted (${from} → ${to}, ${capacityKg}kg). We'll match senders to you. Ref: ${trip.id.slice(0, 8)}`;
      }

      default:
        return help("EN");
    }
  } catch (err) {
    // Surface service errors (KYC required, no pricing, rules failed) as plain text.
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return `⚠️ ${message}`;
  }
}

function formatCap(c: CategoryCap): string {
  if (c.prohibited) return `• ${c.category}: ❌ not allowed`;
  const parts: string[] = [];
  if (c.maxUnitsPerTraveler !== null) parts.push(`max ${c.maxUnitsPerTraveler} unit(s)`);
  if (c.maxWeightKg !== null) parts.push(`up to ${c.maxWeightKg}kg`);
  if (c.requiresSpecialPermit) parts.push("permit required");
  else if (c.requiresDeclaration) parts.push("must declare");
  if (c.dutyApplies) parts.push(`⚠️ duty may apply${c.dutyNote ? ` — ${c.dutyNote}` : ""}`);
  const detail = parts.length > 0 ? parts.join(", ") : "allowed";
  return `• ${c.category}: ${detail}`;
}

function humanizeStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}
