import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Wait for Supabase to process the recovery link in the URL hash
  // and establish a recovery session before allowing the user to set
  // a new password.
  useEffect(() => {
    let resolved = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        resolved = true;
        setReady(true);
        setError(null);
      }
    });

    // Fallback: if there is already an active session (user clicked link
    // and Supabase auto-restored the session), allow immediate reset.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolved = true;
        setReady(true);
      }
    });

    const timeout = window.setTimeout(() => {
      if (!resolved) {
        setError(
          "El enlace de recuperación es inválido o expiró. Solicita uno nuevo desde 'Olvidé mi contraseña'."
        );
      }
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Contraseña muy corta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "¡Contraseña actualizada!", description: "Ya puedes iniciar sesión." });
      // Sign out so the user logs in fresh with the new credentials.
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "No pudimos actualizar tu contraseña.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 gradient-hero opacity-5" />
      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-elevated border-border">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Crear nueva contraseña</CardTitle>
            <CardDescription>
              Elige una contraseña segura para tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive text-center">{error}</p>
                <Button onClick={() => navigate("/forgot-password")} className="w-full">
                  Solicitar nuevo enlace
                </Button>
              </div>
            ) : !ready ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repite la contraseña"
                    minLength={6}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gradient-primary shadow-primary h-11"
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Actualizar contraseña
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
