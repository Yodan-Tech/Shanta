import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions";

export async function AppHeader() {
  const t = await getTranslations("common");
  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
      <Logo />
      <div className="flex items-center gap-4">
        <LocaleSwitcher />
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            {t("signOut")}
          </Button>
        </form>
      </div>
    </header>
  );
}
