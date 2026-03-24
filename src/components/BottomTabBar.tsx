import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Trophy, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const collaboratorTabs = [
  { path: "/app", icon: Home, label: "Inicio" },
  { path: "/app/courses", icon: BookOpen, label: "Cursos" },
  { path: "/app/leaderboard", icon: Trophy, label: "Ranking" },
  { path: "/app/profile", icon: User, label: "Perfil" },
];

const adminTabs = [
  { path: "/app", icon: Home, label: "Inicio" },
  { path: "/app/admin/courses", icon: BookOpen, label: "Cursos" },
  { path: "/app/leaderboard", icon: Trophy, label: "Ranking" },
  { path: "/app/profile", icon: User, label: "Perfil" },
];

export function BottomTabBar() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const tabs = isAdmin ? adminTabs : collaboratorTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || 
            (tab.path !== "/app" && location.pathname.startsWith(tab.path));
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
