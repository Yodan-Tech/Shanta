/**
 * SMS sender PORT (OQ-10: provider is pluggable). Receivers are SMS-first, so
 * transactional SMS (delivery-confirmation links) and the Supabase Auth OTP hook
 * both go through a provider chosen later (Africa's Talking is the leading
 * candidate). Phase-1 dev/test uses the logging sender (no real SMS).
 */
export interface SmsMessage {
  to: string; // E.164
  body: string;
}

export interface SmsResult {
  providerRef?: string;
}

export interface SmsSender {
  send(msg: SmsMessage): Promise<SmsResult>;
}

/** Dev/test sender — logs instead of sending; lets the flow run without a provider. */
export class LoggingSmsSender implements SmsSender {
  readonly sent: SmsMessage[] = [];
  async send(msg: SmsMessage): Promise<SmsResult> {
    this.sent.push(msg);
    if (process.env.NODE_ENV !== "test") {
      console.log(`[sms:dev] to=${msg.to} body=${msg.body}`);
    }
    return { providerRef: `dev-${crypto.randomUUID()}` };
  }
}

/**
 * Resolve the active SMS sender. Default is the logging sender (OQ-10 default —
 * test numbers, no real SMS) until a provider is wired before external users.
 */
export function getSmsSender(): SmsSender {
  return new LoggingSmsSender();
}
