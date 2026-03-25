import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, KeyRound, CheckCircle2, Clock } from "lucide-react";
import { KibboExpression } from "@/components/KibboExpression";
import { useToast } from "@/hooks/use-toast";

export default function JoinCompany() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  // Redirect to auth if not logged in
  if (!authLoading && !user) {
    navigate("/auth?mode=register", { replace: true });
    return null;
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim()) return;
    setJoining(true);

    try {
      const { error } = await supabase.rpc("join_company_by_code", {
        _code: code.trim().toUpperCase(),
      });
      if (error) throw error;

      await refreshProfile();
      setJoined(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Success: pending approval
  if (joined) {
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
            <CardTitle className="text-2xl">Solicitud enviada</CardTitle>
            <CardDescription>
              Tu solicitud ha sido enviada al administrador de la empresa. Recibirás acceso una vez que sea aprobada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full"
            >
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute inset-0 gradient-hero opacity-5" />
      <Card className="w-full max-w-md shadow-elevated relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <KibboExpression expression="excited" className="w-20 h-20" />
          </div>
          <CardTitle className="text-2xl">Únete a tu equipo</CardTitle>
          <CardDescription>
            Ingresa el código de invitación que te proporcionó tu empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código de invitación</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: A1B2C3"
                maxLength={6}
                className="text-center text-2xl tracking-[0.3em] font-mono uppercase"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full gradient-primary shadow-primary h-11"
              disabled={joining || code.trim().length < 4}
            >
              {joining ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <KeyRound className="w-4 h-4 mr-2" />
              )}
              Solicitar acceso
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
