import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";

export const AppLayout = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1">
      <Outlet />
    </main>
  </div>
);