import type { Language } from "@prisma/client";

type TemplateMap = Record<string, Record<Language, string>>;

const TEMPLATES: TemplateMap = {
  shipment_created: {
    EN: "Shanta: Your shipment has been created and is awaiting drop-off at the hub.",
    AM: "Shanta: áŒ­áŠá‰¶ á‰°áˆáŒ¥áˆ¯áˆá¢ á‰ áˆƒá‰¥ áˆˆáˆ˜á‰€á‰ áˆ á‹áŒáŒ áŠá‹á¢",
  },
  shipment_received_hub: {
    EN: "Shanta: Your shipment has been received at the hub and is being verified.",
    AM: "Shanta: áŒ­áŠá‰¶ á‰ áˆƒá‰¥ á‹°áˆ­áˆ·áˆá¢ áˆáˆ­áˆ˜áˆ« á‰ áˆ‚á‹°á‰µ áˆ‹á‹­ áŠá‹á¢",
  },
  shipment_matched: {
    EN: "Shanta: Your shipment has been matched with a traveler.",
    AM: "Shanta: áŒ­áŠá‰¶ áŠ¨á‰°áŒ“á‹¥ áŒ‹áˆ­ á‰°á‹›áˆá‹·áˆá¢",
  },
  shipment_in_transit: {
    EN: "Shanta: Your shipment is now in transit with the traveler.",
    AM: "Shanta: áŒ­áŠá‰¶ áŠ¨á‰°áŒ“á‹¥ áŒ‹áˆ­ áŒ‰á‹ž áŒ€áˆáˆ¯áˆá¢",
  },
  shipment_requeued: {
    EN: "Shanta: Your shipment is being re-matched to another traveler.",
    AM: "Shanta: áŒ­áŠá‰¶ áˆˆáˆŒáˆ‹ á‰°áŒ“á‹¥ áŠ¥áŠ•á‹°áŒˆáŠ“ á‹­á‰³áŒ£áˆˆá‰µ áŠá‹á¢",
  },
  delivery_confirmation_link: {
    EN: "Shanta: Your package is ready for pickup at the hub. Confirm pickup here: {confirmLink}",
    AM: "Shanta: áŒ­áŠá‰¶ á‰ áˆƒá‰¥ áˆˆáˆ˜á‹áˆ¨áŒ áŒ€áˆáˆ¯áˆ። á‹¨á‰áŒ£áŒ¥ áˆáŠ”á: {confirmLink}",
  },
  delivery_confirmed: {
    EN: "Shanta: Great news — the pickup has been confirmed by the receiver.",
    AM: "Shanta: áŒ­áŠá‰¶ á‰ áˆ°á‹³áˆ³ á‰°áˆ¨áŒ‹áŒáŒ§áˆá¢",
  },
  shipment_disputed: {
    EN: "Shanta: A dispute has been raised on your shipment. Our team is reviewing.",
    AM: "Shanta: áŒ­áŠá‰¶ áˆ‹á‹­ áŠ á‰¤á‰±á‰³ á‰€áˆ­á‰§áˆá¢ á‰¡á‹µáŠ“á‰½áŠ• á‹­áŠ¨á‰³á‰°áˆ‹áˆá¢",
  },
  shipment_cancelled: {
    EN: "Shanta: Your shipment has been cancelled.",
    AM: "Shanta: áŒ­áŠá‰¶ á‰°áˆ°áˆ­á‹Ÿáˆá¢",
  },
  shipment_returned: {
    EN: "Shanta: Your shipment is being returned to the sender.",
    AM: "Shanta: áŒ­áŠá‰¶ á‹ˆá‹° áˆ‹áŠªá‹ á‹­áˆ˜áˆˆáˆ³áˆá¢",
  },
};

/**
 * Interpolate template variables in {key} format.
 * Returns the raw template key if no template is registered (safe fallback).
 */
export function renderSmsTemplate(
  templateKey: string,
  payload: Record<string, unknown>,
  language: Language,
): string {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) return templateKey;
  const text = tpl[language] ?? tpl["EN"] ?? templateKey;
  return text.replace(/\{(\w+)\}/g, (_, k) =>
    k in payload ? String(payload[k]) : `{${k}}`,
  );
}
