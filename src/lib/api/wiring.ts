import { getRepositories } from "@/lib/db/prisma-repositories";
import { getSmsSender } from "@/lib/sms/sender";
import { DeliveryService } from "@/lib/services/delivery-service";
import { publicEnv, serverEnv } from "@/lib/env";

/** Construct a DeliveryService wired to the live repos, SMS sender, and token secret. */
export function deliveryService(): DeliveryService {
  const tokenSecret =
    process.env.DELIVERY_TOKEN_SECRET ?? serverEnv.serviceRoleKey;
  return new DeliveryService(getRepositories(), getSmsSender(), {
    tokenSecret,
    appUrl: publicEnv.appUrl,
  });
}
