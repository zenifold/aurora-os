import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ShieldAlert, Share2 } from "lucide-react";

export const Route = createFileRoute("/share/$token")({
  component: ShareViewer,
});

interface ShareData {
  id: string;
  workspace_id: string;
  resource_type: string;
  resource_id: string;
  label: string | null;
  allow_comments: boolean;
  permissions: Record<string, unknown>;
}

function ShareViewer() {
  const { token } = Route.useParams();
  const [password, setPassword] = useState("");
  const [share, setShare] = useState<ShareData | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);

  const open = useMutation({
    mutationFn: async (pw: string | null) => {
      const { data, error } = await supabase.rpc("consume_share_token", {
        _token: token,
        ...(pw ? { _password: pw } : {}),
      });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("PASSWORD_REQUIRED")) {
          setNeedsPassword(true);
          throw new Error("PASSWORD_REQUIRED");
        }
        if (msg.includes("INVALID_TOKEN")) {
          setErrorCode("INVALID_TOKEN");
          throw new Error("INVALID_TOKEN");
        }
        if (msg.includes("REVOKED")) {
          setErrorCode("REVOKED");
          throw new Error("REVOKED");
        }
        if (msg.includes("EXPIRED")) {
          setErrorCode("EXPIRED");
          throw new Error("EXPIRED");
        }
        if (msg.includes("VIEW_LIMIT_REACHED")) {
          setErrorCode("VIEW_LIMIT_REACHED");
          throw new Error("VIEW_LIMIT_REACHED");
        }
        throw error;
      }
      const row = (data ?? [])[0];
      if (!row) throw new Error("Not found");
      setShare(row as ShareData);
      setErrorCode(null);
      return row;
    },
  });

  // Auto-attempt on mount (without password)
  useState(() => {
    open.mutate(null);
    return null;
  });

  if (errorCode) {
    return (
      <ShellLayout>
        <div className="text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 text-xl font-semibold">
            {errorCode === "INVALID_TOKEN" && "Link not found"}
            {errorCode === "REVOKED" && "This link has been revoked"}
            {errorCode === "EXPIRED" && "This link has expired"}
            {errorCode === "VIEW_LIMIT_REACHED" && "View limit reached"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact the person who shared it with you to request a new one.
          </p>
        </div>
      </ShellLayout>
    );
  }

  if (needsPassword && !share) {
    return (
      <ShellLayout>
        <div className="space-y-4">
          <div className="text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-3 text-xl font-semibold">Password required</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This shared resource is protected.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              open.mutate(password);
            }}
            className="space-y-2"
          >
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={open.isPending}>
              {open.isPending ? "Checking…" : "Unlock"}
            </Button>
          </form>
        </div>
      </ShellLayout>
    );
  }

  if (!share) {
    return (
      <ShellLayout>
        <div className="text-center text-sm text-muted-foreground">Loading…</div>
      </ShellLayout>
    );
  }

  return (
    <ShellLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">{share.label ?? "Shared resource"}</h1>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="text-xs uppercase text-muted-foreground">Resource</div>
          <div className="mt-1 font-mono text-sm">
            {share.resource_type} · {share.resource_id}
          </div>
        </div>
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            You're viewing this resource as a guest. Sign in to interact with it as a member.
          </p>
          <Link to="/login">
            <Button className="mt-3" variant="outline">Sign in</Button>
          </Link>
        </div>
        {share.allow_comments && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Comments are enabled for this link. Sign in to leave feedback.
          </div>
        )}
      </div>
    </ShellLayout>
  );
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {children}
        </div>
        <div className="mt-4 text-center text-[11px] text-muted-foreground">
          Powered by Aurora
        </div>
      </div>
    </div>
  );
}
