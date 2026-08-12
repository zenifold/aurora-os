import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useNavVisibility } from "@/hooks/use-nav-visibility";

export function NavAccessGuard({ navKey, children }: { navKey: string; children: React.ReactNode }) {
  const { canSee } = useNavVisibility();
  const navigate = useNavigate();
  const allowed = canSee(navKey);
  useEffect(() => {
    if (!allowed) {
      toast.error("You don't have access to this page");
      navigate({ to: "/app" });
    }
  }, [allowed, navigate]);
  if (!allowed) return null;
  return <>{children}</>;
}
