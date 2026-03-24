import {
  LayoutDashboard, BookOpen, Trophy, User, Settings,
  Users, BarChart3, PlusCircle, LogOut, Zap, Flame
} from "lucide-react";
import kibboLogo from "@/assets/kibbo-mascot.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const collaboratorItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, walkthrough: "nav-dashboard" },
  { title: "Mis Cursos", url: "/app/courses", icon: BookOpen, walkthrough: "nav-courses" },
  { title: "Ranking", url: "/app/leaderboard", icon: Trophy, walkthrough: "nav-leaderboard" },
  { title: "Perfil", url: "/app/profile", icon: User, walkthrough: "nav-profile" },
];

const adminItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, walkthrough: "nav-dashboard" },
  { title: "Gestionar Cursos", url: "/app/admin/courses", icon: BookOpen, walkthrough: "nav-admin-courses" },
  { title: "Crear Curso", url: "/app/admin/courses/new", icon: PlusCircle, walkthrough: "nav-create-course" },
  { title: "Usuarios", url: "/app/admin/users", icon: Users },
  { title: "Analytics", url: "/app/admin/analytics", icon: BarChart3 },
  { title: "Ranking", url: "/app/leaderboard", icon: Trophy, walkthrough: "nav-leaderboard" },
  { title: "Configuración", url: "/app/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, isAdmin, signOut } = useAuth();

  const items = isAdmin ? adminItems : collaboratorItems;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="p-4 flex items-center gap-3">
        <img src={kibboLogo} alt="Kibbo" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-foreground">Kibbo</span>
        )}
      </div>

      {!collapsed && profile && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-sidebar-accent">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
              {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile.full_name || "Usuario"}
              </p>
              <p className="text-xs text-sidebar-foreground/60">Nivel {profile.level}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-xp">
              <Zap className="w-3 h-3" /> {profile.xp_total} XP
            </span>
            <span className="flex items-center gap-1 text-streak">
              <Flame className="w-3 h-3" /> {profile.current_streak}d
            </span>
          </div>
        </div>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            {isAdmin ? "Administración" : "Menú"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/app"}
                      className="hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      {...(item.walkthrough ? { "data-walkthrough": item.walkthrough } : {})}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {!collapsed && "Cerrar sesión"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
