import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function HubDashboardPage() {
  await requireProfile();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">Hub Console</h1>
        <p className="mt-1 text-sm text-muted">Manage incoming shipments at your hub.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/hub">
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-navy">
              <CardHeader>
                <CardTitle>Intake queue</CardTitle>
                <CardDescription>
                  View shipments awaiting intake, verification, and sealing.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Card>
            <CardHeader>
              <CardTitle>Match to traveler</CardTitle>
              <CardDescription>
                Assign sealed shipments to verified travelers. Available after sealing.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="mt-6">
          <Link href="/hub">
            <Button className="w-full sm:w-auto">Open intake queue</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
