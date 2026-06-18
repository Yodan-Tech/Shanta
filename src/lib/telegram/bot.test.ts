import { describe, it, expect, beforeEach } from "vitest";
import { handleBotCommand, type BotDeps } from "./bot";
import type { VerifiedTelegramUser } from "./auth";

const USER: VerifiedTelegramUser = { telegramUserId: "42", username: "abebe" };

function makeDeps(over: Partial<BotDeps> = {}): BotDeps {
  return {
    ensureProfile: async () => ({ id: "p1", language: "EN" }),
    setLanguage: async () => {},
    listTravelers: async () => [],
    packableCaps: async () => [],
    createShipment: async () => ({ id: "s1", totalPriceEtb: 500 }),
    listShipments: async () => [],
    createTrip: async () => ({ id: "trip-abcdefgh" }),
    logDemand: async () => {},
    ...over,
  };
}

function run(text: string, deps: BotDeps) {
  return handleBotCommand({ text, from: USER }, deps);
}

describe("telegram bot router", () => {
  it("returns the menu on /start", async () => {
    const reply = await run("/start", makeDeps());
    expect(reply).toContain("Shanta");
    expect(reply).toContain("/travelers");
  });

  it("lists travelers and logs a demand signal", async () => {
    let logged = false;
    const deps = makeDeps({
      logDemand: async () => {
        logged = true;
      },
      listTravelers: async () => [
        {
          tripLegId: "l1",
          travelerId: "t1",
          originRegion: "Dubai",
          destinationRegion: "Addis Ababa",
          departAt: new Date("2026-07-01T00:00:00Z"),
          availableCapacityKg: 12,
        },
      ],
    });
    const reply = await run("/travelers Dubai Addis", deps);
    expect(reply).toContain("12kg free");
    expect(logged).toBe(true);
  });

  it("shows packable caps for a route", async () => {
    const deps = makeDeps({
      packableCaps: async () => [
        {
          category: "LAPTOP",
          prohibited: false,
          maxWeightKg: null,
          maxUnitsPerTraveler: 1,
          requiresDeclaration: true,
          requiresSpecialPermit: false,
          dutyApplies: true,
          dutyNote: "2nd may be taxed",
        },
      ],
    });
    const reply = await run("/pack Dubai Addis", deps);
    expect(reply).toContain("LAPTOP");
    expect(reply).toContain("max 1 unit");
    expect(reply).toContain("duty may apply");
  });

  it("creates a shipment via /send", async () => {
    let captured: unknown;
    const deps = makeDeps({
      createShipment: async (input) => {
        captured = input;
        return { id: "s1", totalPriceEtb: 720 };
      },
    });
    const reply = await run("/send Dubai Addis LAPTOP 2 +251911223344 Mr Receiver", deps);
    expect(reply).toContain("720 ETB");
    expect(captured).toMatchObject({
      originRegion: "Dubai",
      destinationRegion: "Addis",
      category: "LAPTOP",
      weightKg: 2,
      receiverPhone: "+251911223344",
      receiverName: "Mr Receiver",
    });
  });

  it("validates /send arguments", async () => {
    const reply = await run("/send Dubai", makeDeps());
    expect(reply).toContain("Usage: /send");
  });

  it("surfaces service errors as readable text", async () => {
    const deps = makeDeps({
      createTrip: async () => {
        throw new Error("Identity verification (KYC) is required before publishing a trip.");
      },
    });
    const reply = await run("/trip Dubai Addis 2026-07-01 15", deps);
    expect(reply).toContain("KYC");
  });

  it("sets language with /lang", async () => {
    let lang = "";
    const deps = makeDeps({
      setLanguage: async (_id, l) => {
        lang = l;
      },
    });
    const reply = await run("/lang am", deps);
    expect(lang).toBe("AM");
    expect(reply).toContain("ሻንታ");
  });
});
