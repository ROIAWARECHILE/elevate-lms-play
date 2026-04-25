import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Building2, Users, MailCheck } from "lucide-react";
import { KibboExpression } from "@/components/KibboExpression";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { APP_URL } from "@/lib/constants";

function RoleChoiceScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 gradient-hero opacity-5" />
      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-elevated border-border">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <KibboExpression expression="excited" className="w-20 h-20" />
            </div>
            <CardTitle className="text-2xl font-bold">¿Cómo quieres usar Kibbo?</CardTitle>
            <CardDescription>Elige tu rol para continuar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => navigate("/onboarding")}
              variant="outline"
              className="w-full h-auto p-4 flex items-start gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Soy empresa</p>
                <p className="text-sm text-muted-foreground font-normal">
                  Quiero crear mi workspace y capacitar a mi equipo
                </p>
              </div>
            </Button>
            <Button
              onClick={() => navigate("/join")}
              variant="outline"
              className="w-full h-auto p-4 flex items-start gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Soy colaborador</p>
                <p className="text-sm text-muted-foreground font-normal">
                  Tengo un código de invitación de mi empresa
                </p>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function EmailConfirmationScreen({ email, onBackToLogin }: { email: string; onBackToLogin: () => void }) {
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
            <CardTitle className="text-2xl font-bold">Confirma tu correo</CardTitle>
            <CardDescription>
              Enviamos un enlace de confirmación a <span className="font-medium text-foreground">{email}</span>.
              Después de confirmarlo, vuelve e inicia sesión para elegir si eres empresa o colaborador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBackToLogin} className="w-full gradient-primary shadow-primary h-11">
              Ir a iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(searchParams.get("mode") === "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const justRegisteredRef = useRef(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();

  const redirectTo = searchParams.get("redirect") || "/app";
  const chooseMode = searchParams.get("choose") === "true";

  // Single useEffect to handle all redirect logic based on fully restored auth + profile state.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      justRegisteredRef.current = false;
      return;
    }

    if (user && profile?.company_id && !justRegisteredRef.current && !chooseMode) {
      navigate(redirectTo, { replace: true });
    }
  }, [authLoading, user, profile?.company_id, navigate, redirectTo, chooseMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        justRegisteredRef.current = true;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${APP_URL}/auth?choose=true`,
          },
        });
        if (error) {
          justRegisteredRef.current = false;
          throw error;
        }

        if (!data.session) {
          justRegisteredRef.current = false;
          setConfirmationEmail(email);
          toast({
            title: "¡Cuenta creada!",
            description: "Revisa tu correo para confirmar tu cuenta antes de elegir tu rol.",
          });
          return;
        }

        toast({
          title: "¡Cuenta creada!",
          description: "Ahora elige cómo quieres usar Kibbo.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Redirect will be handled by the useEffect above once profile loads
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (confirmationEmail) {
    return (
      <EmailConfirmationScreen
        email={confirmationEmail}
        onBackToLogin={() => {
          setConfirmationEmail("");
          setIsRegister(false);
        }}
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show role choice only when the user is authenticated and the profile is loaded without a company.
  if (user && profile && !profile.company_id) {
    return <RoleChoiceScreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 gradient-hero opacity-5" />
      <div className="w-full max-w-md relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        <Card className="shadow-elevated border-border">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <KibboExpression expression="excited" className="w-20 h-20" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {isRegister ? "Crear cuenta" : "Bienvenido de vuelta"}
            </CardTitle>
            <CardDescription>
              {isRegister
                ? "Crea tu cuenta y empieza a aprender"
                : "Inicia sesión para continuar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre"
                    required
                  />
                </div>
              )}
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
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
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
              <Button
                type="submit"
                className="w-full gradient-primary shadow-primary h-11"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isRegister ? "Crear cuenta" : "Iniciar sesión"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isRegister
                  ? "¿Ya tienes cuenta? Inicia sesión"
                  : "¿No tienes cuenta? Regístrate"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
