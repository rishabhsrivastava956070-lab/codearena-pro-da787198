import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = ({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) => {
  const { user, loading, isAdmin } = useAuth();
  const loc = useLocation();

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
};