import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import Home from "./pages/Home";
import AuthPage from "./pages/auth/Auth";
import ResetPassword from "./pages/auth/ResetPassword";
import ProblemsList from "./pages/problems/ProblemsList";
import ProblemDetail from "./pages/problems/ProblemDetail";
import Dashboard from "./pages/Dashboard";
import ContestsList from "./pages/contests/ContestsList";
import ContestDetail from "./pages/contests/ContestDetail";
import DiscussionsList from "./pages/discussions/DiscussionsList";
import NewDiscussion from "./pages/discussions/NewDiscussion";
import DiscussionDetail from "./pages/discussions/DiscussionDetail";
import PeerRooms from "./pages/PeerRooms";
import Profile from "./pages/Profile";
import AdminPanel from "./pages/admin/AdminPanel";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/problems" element={<ProblemsList />} />
              <Route path="/problems/:slug" element={<ProblemDetail />} />
              <Route path="/contests" element={<ContestsList />} />
              <Route path="/contests/:slug" element={<ContestDetail />} />
              <Route path="/discuss" element={<DiscussionsList />} />
              <Route path="/discuss/new" element={<ProtectedRoute><NewDiscussion /></ProtectedRoute>} />
              <Route path="/discuss/:id" element={<DiscussionDetail />} />
              <Route path="/rooms" element={<PeerRooms />} />
              <Route path="/rooms/:code" element={<PeerRooms />} />
              <Route path="/u/:username" element={<Profile />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
