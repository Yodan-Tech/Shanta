import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{
    contact?: string;
    phone?: string;
    email?: string;
    channel?: "phone" | "email" | "sms";
    next?: string;
    originRegion?: string;
    destinationRegion?: string;
    weightKg?: string;
    category?: string;
    description?: string;
    receiverName?: string;
    receiverPhone?: string;
  }>;
}) {
  const params = await searchParams;
  const contact = params.contact ?? params.phone ?? params.email;
  const channel = params.channel ?? (params.email ? "email" : "phone");
  if (!contact) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <VerifyForm contact={contact} channel={channel} />
      </main>
    </div>
  );
}
