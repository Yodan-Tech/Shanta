"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidPhone } from "@/lib/validators";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Hub operator login — separate from the public landing flow.
 * Still uses phone OTP, but redirects to /hub/dashboard after verify.
 */
export default function HubLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidPhone(phone)) {
      setError("Please enter a valid phone number in international format.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    if (otpError) {
      setError(otpError.status === 429 ? "Too many attempts. Please wait." : otpError.message);
      return;
    }
    router.push(`/hub/verify?phone=${encodeURIComponent(phone)}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center px-6 py-4">
        <Logo />
        <span className="ml-3 rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white">
          Hub
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Hub operator login</CardTitle>
            <CardDescription>
              Enter your registered phone number to access the hub console.
            </CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit} className="space-y-4 px-6 pb-6">
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+2519XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.trim())}
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending code…" : "Send verification code"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
