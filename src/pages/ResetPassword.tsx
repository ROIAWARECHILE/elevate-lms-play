import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, KeyRound, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { KibboExpression } from "@/components/KibboExpression";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

function StrengthBar({ password }: { password: string }) {
  const checks = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Una letra mayúscula", ok: /[A-Z]/.test(password) },
    { label: "Una letra minúscula", ok: /[a-z]/.test(password) },
    { label: "Un número", ok: /[0-9]/.test(password) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-green-500"];
  const labels = ["", "Débil", "Regular", "Buena", "Fuerte"];

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2 mt-1"
    >
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < passed ? colors[passed] : "bg-muted"
            }`}
          />
        ))}
        {passed > 0 && (
          <span className={`text-[11px] font-medium ml-1 ${
            passed <= 1 ? "text-red-500" : passed === 2 ? "text-orange-500" : passed === 3 ? "text-yellow-600" : "text-green-600"
          }`}>
            {labels[passed]}
          </span>
        )}
      </div>
      <ul className="space-y-0.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-1.5 text-[11px]">
            {c.ok
              ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
              : <XCircle className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
            <span className={c.ok ? "text-green-700" : "text-muted-foreground"}>{c.label}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let resolved = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        resolved = true;
        setReady(true);
        setError(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolved = true;
        setReady(true);
      }
    });

    const timeout = window.setTimeout(() => {
      if (!resolved) {
        setError(
          "El enlace de recuperación es inválido o ya expiró. Solicita uno nuevo."
        );
      }
    }, 5000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const strengthPassed = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
  ].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (strengthPassed < 3) {
      toast({ title: "Contraseña muy débil", description: "Cumple al menos 3 de los requisitos.", variant: "destructive" });
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
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate("/auth", { replace: true }), 3000);
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
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="shadow-elevated border-border text-center">
                <CardHeader className="pb-4">
                  <div className="flex justify-center mb-4">
                    <KibboExpression expression="celebrating" className="w-24 h-24" />
                  </div>
                  <CardTitle className="text-2xl font-bold">¡Contraseña actualizada!</CardTitle>
                  <CardDescription>
                    Tu nueva contraseña está lista. Te redirigimos al inicio de sesión en un momento.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="shadow-elevated border-border">
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    {error ? (
                      <KibboExpression expression="sad" className="w-20 h-20" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <KeyRound className="w-8 h-8 text-primary" />
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-2xl font-bold">
                    {error ? "Enlace inválido" : "Crear nueva contraseña"}
                  </CardTitle>
                  {!error && (
                    <CardDescription>Elige una contraseña segura para tu cuenta de Kibbo.</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {error ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground text-center">{error}</p>
                      <Button
                        onClick={() => navigate("/forgot-password")}
                        className="w-full gradient-primary shadow-primary h-11"
                      >
                        Solicitar nuevo enlace
                      </Button>
                    </div>
                  ) : !ready ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Verificando el enlace…</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="password">Nueva contraseña</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mínimo 8 caracteres"
                            required
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <StrengthBar password={password} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm">Confirmar contraseña</Label>
                        <div className="relative">
                          <Input
                            id="confirm"
                            type={showConfirm ? "text" : "password"}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="Repite la contraseña"
                            required
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {confirm && password !== confirm && (
                          <p className="text-[11px] text-destructive flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Las contraseñas no coinciden
                          </p>
                        )}
                        {confirm && password === confirm && confirm.length > 0 && (
                          <p className="text-[11px] text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden
                          </p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        className="w-full gradient-primary shadow-primary h-11"
                        disabled={loading || strengthPassed < 3 || password !== confirm}
                      >
                        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Actualizar contraseña
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
