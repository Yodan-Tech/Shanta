import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { HubVerifyForm } from "./hub-verify-form";

export default async function HubVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  if (!phone) redirect("/hub/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <HubVerifyForm phone={phone} />
      </main>
    </div>
  );
}
