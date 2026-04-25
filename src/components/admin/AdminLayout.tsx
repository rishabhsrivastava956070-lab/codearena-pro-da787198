import { Outlet, Navigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Shield } from "lucide-react";

/**
 * AdminLayout: gates the entire /admin/* tree.
 * - Redirects unauthenticated users to /auth
 * - Redirects non-admins to home
 * - Renders sidebar shell for nested admin routes
 */
export const AdminLayout = () => {
  const { user, isAdmin, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center gap-2 border-b border-border px-3">
            <SidebarTrigger />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span>Admin Console</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};