import { getRepositories } from "@/lib/db/prisma-repositories";
import { getSmsSender } from "@/lib/sms/sender";
import { DeliveryService } from "@/lib/services/delivery-service";
import { NotificationService } from "@/lib/services/notification-service";
import { publicEnv, serverEnv } from "@/lib/env";

/** Construct a DeliveryService wired to the live repos and token secret. */
export function deliveryService(): DeliveryService {
  const tokenSecret =
    process.env.DELIVERY_TOKEN_SECRET ?? serverEnv.serviceRoleKey;
  return new DeliveryService(getRepositories(), {
    tokenSecret,
    appUrl: publicEnv.appUrl,
  });
}

/** Construct a NotificationService wired to the live repos and SMS sender. */
export function notificationService(): NotificationService {
  return new NotificationService(getRepositories(), getSmsSender());
}
