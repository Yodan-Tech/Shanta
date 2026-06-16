import { Role } from "@prisma/client";
import { requireProfile, requireActiveRole } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardLink {
  href: string;
  title: string;
  description: string;
  primary?: boolean;
}

const ROLE_LINKS: Record<Role, DashboardLink[]> = {
  SENDER: [
    { href: "/shipments/new", title: "Send a package", description: "Create a new shipment and drop it off at a hub.", primary: true },
    { href: "/shipments", title: "My shipments", description: "Track your existing shipments." },
  ],
  TRAVELER: [
    { href: "/trips/new", title: "Register a trip", description: "Publish your trip and available luggage space.", primary: true },
    { href: "/trips", title: "My trips", description: "Manage your active trips and pending assignments." },
  ],
  AGGREGATOR: [
    { href: "/hub", title: "Hub console", description: "Manage incoming shipments at your hub.", primary: true },
  ],
  RECEIVER: [],
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  requireActiveRole(profile);

  const links = profile.roles.flatMap((role) => ROLE_LINKS[role] ?? []);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold text-navy">
          Welcome{profile.fullName ? `, ${profile.fullName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Roles: {profile.roles.join(", ")}
        </p>

        {links.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                <Card className={link.primary ? "border-navy" : undefined}>
                  <CardHeader>
                    <CardTitle className="text-base">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                </Card>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-8 text-sm text-muted">
            Complete onboarding to access your dashboard.
          </p>
        )}
      </main>
    </div>
  );
}
