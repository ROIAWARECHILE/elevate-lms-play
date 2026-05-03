import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { KibboExpression } from "@/components/KibboExpression";
import { useToast } from "@/hooks/use-toast";
import { APP_URL } from "@/lib/constants";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_URL}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "No pudimos enviar el correo. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="w-full max-w-md relative z-10">
          <Card className="shadow-elevated border-border">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <MailCheck className="w-8 h-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Revisa tu correo</CardTitle>
              <CardDescription>
                Si existe una cuenta con <span className="font-medium text-foreground">{email}</span>,
                te enviamos un enlace para restablecer tu contraseña.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/auth">
                <Button className="w-full gradient-primary shadow-primary h-11">
                  Volver al inicio de sesión
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 gradient-hero opacity-5" />
      <div className="w-full max-w-md relative z-10">
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>

        <Card className="shadow-elevated border-border">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <KibboExpression expression="thinking" className="w-20 h-20" />
            </div>
            <CardTitle className="text-2xl font-bold">¿Olvidaste tu contraseña?</CardTitle>
            <CardDescription>
              Ingresa tu correo y te enviaremos un enlace para restablecerla.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full gradient-primary shadow-primary h-11"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Enviar enlace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
