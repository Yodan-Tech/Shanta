import type { Language } from "@prisma/client";

type TemplateMap = Record<string, Record<Language, string>>;

const TEMPLATES: TemplateMap = {
  shipment_created: {
    EN: "Shanta: Your shipment has been created and is awaiting drop-off at the hub.",
    AM: "Shanta: ጭነቶ ተፈጥሯል። በሃብ ለመቀበል ዝግጁ ነው።",
  },
  shipment_received_hub: {
    EN: "Shanta: Your shipment has been received at the hub and is being verified.",
    AM: "Shanta: ጭነቶ በሃብ ደርሷል። ምርመራ በሂደት ላይ ነው።",
  },
  shipment_matched: {
    EN: "Shanta: Your shipment has been matched with a traveler.",
    AM: "Shanta: ጭነቶ ከተጓዥ ጋር ተዛምዷል።",
  },
  shipment_in_transit: {
    EN: "Shanta: Your shipment is now in transit with the traveler.",
    AM: "Shanta: ጭነቶ ከተጓዥ ጋር ጉዞ ጀምሯል።",
  },
  shipment_requeued: {
    EN: "Shanta: Your shipment is being re-matched to another traveler.",
    AM: "Shanta: ጭነቶ ለሌላ ተጓዥ እንደገና ይታጣለት ነው።",
  },
  delivery_confirmation_link: {
    EN: "Shanta: Your delivery has arrived! Confirm receipt here: {confirmLink}",
    AM: "Shanta: ጭነቶ ደርሷል! ይቁጣጡ: {confirmLink}",
  },
  delivery_confirmed: {
    EN: "Shanta: Great news — your delivery has been confirmed by the receiver.",
    AM: "Shanta: ጭነቶ በተቀባዩ ተረጋግጧል።",
  },
  shipment_disputed: {
    EN: "Shanta: A dispute has been raised on your shipment. Our team is reviewing.",
    AM: "Shanta: ጭነቶ ላይ አቤቱታ ቀርቧል። ቡድናችን ይከታተላል።",
  },
  shipment_cancelled: {
    EN: "Shanta: Your shipment has been cancelled.",
    AM: "Shanta: ጭነቶ ተሰርዟል።",
  },
  shipment_returned: {
    EN: "Shanta: Your shipment is being returned to the sender.",
    AM: "Shanta: ጭነቶ ወደ ላኪው ይመለሳል።",
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
