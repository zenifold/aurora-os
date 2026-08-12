import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/check-email")({
  component: CheckEmail,
});

function CheckEmail() {
  const { email } = Route.useSearch() as { email?: string };
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verification email resent");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden aura-mesh lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="Aurora logo" className="h-9 w-9 rounded-xl shadow-pop" />
          <span className="text-xl font-semibold">Aurora</span>
        </Link>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Almost there.</h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            One quick step before you can start building.
          </p>
        </div>
        <div />
      </div>

      <div className="relative flex items-center justify-center bg-background p-6">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="w-full max-w-sm text-center">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <img src={logoUrl} alt="Aurora logo" className="h-8 w-8 rounded-lg" />
            <span className="font-semibold">Aurora</span>
          </Link>

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Mail className="h-8 w-8 text-primary" />
          </div>

          <h1 className="mt-6 text-2xl font-semibold">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a verification link to{" "}
            <span className="font-medium text-foreground">{email ?? "your email"}</span>.
            Click it to activate your account and log in.
          </p>

          <div className="mt-8 space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={resending || !email}
            >
              {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Resend email
            </Button>

            <Button variant="ghost" className="w-full" asChild>
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to sign in
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Didn&apos;t receive it? Check spam or promotions folders.
          </p>
        </div>
      </div>
    </div>
  );
}
