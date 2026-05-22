import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomTabBar } from "@/components/BottomTabBar";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Clock, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/CommandPalette";
import { VoiceAgentButton } from "@/components/VoiceAgent";
import { useGoToShortcuts } from "@/hooks/useGoToShortcuts";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout() {
  const { user, profile, loading, isPending, signOut, refreshProfile } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  useGoToShortcuts();

  // Auto-detect approval: poll every 6s + realtime subscription on profile row
  useEffect(() => {
    if (!isPending || !user) return;

    const interval = setInterval(() => {
      refreshProfile();
    }, 6000);

    const channel = supabase
      .channel(`profile-status-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new?.status && payload.new.status !== "pending") {
            refreshProfile();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isPending, user?.id, refreshProfile]);

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
    return <Navigate to="/auth?choose=true" replace />;
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
              Tu solicitud está pendiente de aprobación por el administrador de la empresa. Esta pantalla se actualizará automáticamente en cuanto te aprueben — no necesitas recargar.
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
      <CommandPalette />
      <div className="min-h-screen flex w-full">
        {!isMobile && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          {!isMobile && (
            <header className="h-14 flex items-center border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-40 gap-3">
              <SidebarTrigger />
              <button
                onClick={() => {
                  // Synthesize Cmd+K to open the palette
                  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
                }}
                className="ml-auto inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Buscar (Cmd/Ctrl + K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Buscar…</span>
                <kbd className="ml-2 inline-flex items-center gap-0.5 rounded bg-background px-1.5 py-0.5 text-[10px] font-mono border border-border">
                  ⌘K
                </kbd>
              </button>
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
        <VoiceAgentButton />
      </div>
    </SidebarProvider>
  );
}
