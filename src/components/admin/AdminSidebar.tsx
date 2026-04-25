import { LayoutDashboard, ListChecks, FilePlus2, ShieldCheck, Trophy, Users, Inbox, ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "Problems", url: "/admin/problems", icon: ListChecks, end: false },
  { title: "Create Problem", url: "/admin/problems/create", icon: FilePlus2, end: true },
  { title: "Approvals", url: "/admin/approvals", icon: ShieldCheck, end: true },
  { title: "Contests", url: "/admin/contests", icon: Trophy, end: false },
  { title: "Users", url: "/admin/users", icon: Users, end: true },
  { title: "Submissions", url: "/admin/submissions", icon: Inbox, end: true },
  { title: "Plagiarism", url: "/admin/plagiarism", icon: ShieldAlert, end: true },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-3 pt-3 pb-2">
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            {!collapsed && <span>Back to app</span>}
          </Link>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}