import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

export function hasAdminToken(): boolean {
  try {
    return !!localStorage.getItem("ebgz_admin_token");
  } catch {
    return false;
  }
}

/** Avoid blank screens on /content-studio, /admin, etc. when not signed in. */
export function RequireAdminToken({ children }: { children: React.ReactNode }) {
  if (!hasAdminToken()) {
    return (
      <>
        <Redirect to="/" />
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Admin sign-in required — opening homepage…</p>
          <p className="text-xs text-muted-foreground">
            Log in at <a href="/admin" className="text-primary underline">/admin</a>, then return here.
          </p>
        </div>
      </>
    );
  }
  return <>{children}</>;
}
