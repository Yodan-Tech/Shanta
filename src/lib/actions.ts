"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth";
import { normaliseSelectedRoles, needsOnboarding } from "@/lib/roles";

/** Persist the roles the user chose during onboarding, then go to the dashboard. */
export async function saveRoles(formData: FormData) {
  const profile = await requireProfile();

  const roles = normaliseSelectedRoles(formData.getAll("roles").map(String));

  // needsOnboarding is true when only RECEIVER (the implicit role) is present.
  if (needsOnboarding(roles)) {
    redirect("/onboarding?error=pick-one");
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: { roles },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Sign the user out and return to the landing page. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
