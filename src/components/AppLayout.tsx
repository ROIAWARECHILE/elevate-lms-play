import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomTabBar } from "@/components/BottomTabBar";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const { user, profile, loading, isPending, signOut } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();

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

  if (!loading && profile && !profile.company_id) {
    return <Navigate to="/onboarding" replace />;
  }

  // Show pending approval screen
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <Card className="w-full max-w-md shadow-elevated relative z-10">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
                <Clock className="w-8 h-8 text-warning" />
              </div>
            </div>
            <CardTitle className="text-2xl">Esperando aprobación</CardTitle>
            <CardDescription>
              Tu solicitud está pendiente de aprobación por el administrador de la empresa. Te notificaremos cuando tengas acceso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={signOut} variant="outline" className="w-full">
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        {isMobile && <BottomTabBar />}
      </div>
    </SidebarProvider>
  );
}
