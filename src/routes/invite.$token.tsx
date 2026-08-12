import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: AcceptInvite,
});

interface InviteData {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  workspace: { name: string; slug: string } | null;
}

function AcceptInvite() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const fetchWs = useWorkspaceStore((s) => s.fetch);

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .rpc("lookup_workspace_invitation", { _token: token })
        .maybeSingle();
      if (error || !data) {
        setError("This invitation link is invalid or has been revoked. Ask the person who invited you to send a new one.");
      } else if (data.status === "accepted") {
        setError("This invitation has already been accepted. If that wasn't you, ask for a new invite.");
      } else if (data.status !== "pending") {
        setError("This invitation is no longer valid.");
      } else if (new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired. Ask the person who invited you to send a new one.");
      } else {
        setInvite({
          id: data.id,
          workspace_id: data.workspace_id,
          email: data.email,
          role: data.role,
          status: data.status,
          expires_at: data.expires_at,
          workspace: { name: data.workspace_name, slug: data.workspace_slug },
        } as unknown as InviteData);
        // Check if signed-in user is already a member of this workspace
        if (user) {
          const { data: existing } = await supabase
            .from("workspace_members")
            .select("user_id")
            .eq("workspace_id", data.workspace_id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (existing) setAlreadyMember(true);
        }
      }
      setLoading(false);
    })();
  }, [token, user]);

  const openWorkspace = async () => {
    if (!invite) return;
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, name, slug, owner_id, plan, kind, linked_delivery_workspace_id")
      .eq("id", invite.workspace_id)
      .single();
    if (ws) setCurrent(ws as never);
    await fetchWs();
    navigate({ to: "/app" });
  };

  const accept = async () => {
    if (!invite || !user) return;
    setAccepting(true);
    try {
      // Add to workspace_members + user_roles
      const [{ error: memErr }, { error: roleErr }] = await Promise.all([
        supabase.from("workspace_members").insert({ workspace_id: invite.workspace_id, user_id: user.id }),
        supabase.from("user_roles").insert({ workspace_id: invite.workspace_id, user_id: user.id, role: (invite.role === "owner" ? "owner" : "member") }),
      ]);
      // Ignore duplicate key errors (already a member)
      const isDup = (e: { code?: string; message?: string } | null) =>
        !!e && (e.code === "23505" || (e.message ?? "").toLowerCase().includes("duplicate"));
      if (memErr && !isDup(memErr)) throw memErr;
      if (roleErr && !isDup(roleErr)) throw roleErr;

      const { error: updErr } = await supabase
        .from("workspace_invitations")
        .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: user.id })
        .eq("id", invite.id);
      if (updErr) throw updErr;

      // Load workspace and navigate
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id, name, slug, owner_id, plan, kind, linked_delivery_workspace_id")
        .eq("id", invite.workspace_id)
        .single();
      if (ws) setCurrent(ws as never);
      await fetchWs();
      toast.success(`Welcome to ${invite.workspace?.name ?? "the workspace"}`);
      navigate({ to: "/app" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen aura-mesh">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aura-gradient shadow-pop">
            <Sparkles className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-semibold">Aurora</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-pop">
          {error ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <h1 className="mt-4 text-xl font-semibold">Invitation unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/">Go home</Link>
              </Button>
            </div>
          ) : invite ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-aura-gradient-subtle">
                <CheckCircle2 className="h-6 w-6 text-aura-gradient" />
              </div>
              <h1 className="mt-4 text-center text-xl font-semibold">
                You're invited to <span className="text-aura-gradient">{invite.workspace?.name}</span>
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Invited as <span className="font-medium text-foreground">{invite.email}</span> · Role:{" "}
                <span className="font-medium text-foreground">{invite.role}</span>
              </p>

              {!user ? (
                <div className="mt-6 space-y-3">
                  <p className="text-center text-sm text-muted-foreground">
                    Sign in or create an account to accept.
                  </p>
                  <Button asChild className="w-full bg-aura-gradient text-primary-foreground hover:opacity-90">
                    <Link to="/signup" search={{ redirect: `/invite/${token}`, email: invite.email } as never}>Create account</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/login" search={{ redirect: `/invite/${token}` } as never}>Sign in</Link>
                  </Button>
                </div>
              ) : alreadyMember ? (
                <div className="mt-6 space-y-3">
                  <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
                    You're already a member of <strong>{invite.workspace?.name}</strong>.
                  </p>
                  <Button
                    onClick={openWorkspace}
                    className="w-full bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
                  >
                    Open workspace
                  </Button>
                </div>
              ) : (
                <div className="mt-6">
                  {user.email?.toLowerCase() !== invite.email.toLowerCase() && (
                    <p className="mb-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                      Heads up: this invite was sent to <strong>{invite.email}</strong>, but you're signed in as{" "}
                      <strong>{user.email}</strong>. You can{" "}
                      <Link to="/login" search={{ redirect: `/invite/${token}` } as never} className="underline">
                        sign in with a different account
                      </Link>{" "}
                      or accept anyway.
                    </p>
                  )}
                  <Button
                    onClick={accept}
                    disabled={accepting}
                    className="w-full bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
                  >
                    {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Accept invitation
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
