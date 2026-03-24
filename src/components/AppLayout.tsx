import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomTabBar } from "@/components/BottomTabBar";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

export function AppLayout() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isMobile && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          {!isMobile && (
            <header className="h-14 flex items-center border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
              <SidebarTrigger className="mr-4" />
            </header>
          )}
          <main className={`flex-1 p-4 md:p-6 ${isMobile ? "pb-20" : ""}`}>
            <Outlet />
          </main>
        </div>
        {isMobile && <BottomTabBar />}
      </div>
    </SidebarProvider>
  );
}
