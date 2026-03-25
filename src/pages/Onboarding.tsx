import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Copy, CheckCircle2 } from "lucide-react";
import { KibboExpression } from "@/components/KibboExpression";
import { useToast } from "@/hooks/use-toast";

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const slug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const { data, error } = await supabase.rpc("create_company_for_user", {
        _name: companyName,
        _slug: slug,
      });

      if (error) throw error;

      await refreshProfile();

      // Fetch the invite code
      const { data: companyData } = await supabase
        .from("companies")
        .select("invite_code")
        .eq("id", data)
        .single();

      if (companyData?.invite_code) {
        setInviteCode(companyData.invite_code);
      } else {
        navigate("/app");
      }

      toast({ title: "¡Workspace creado!", description: `Bienvenido a ${companyName}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast({ title: "Código copiado" });
    setTimeout(() => setCopied(false), 2000);
  };

  // Show invite code after creating company
  if (inviteCode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <Card className="w-full max-w-md shadow-elevated relative z-10">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
            </div>
            <CardTitle className="text-2xl">¡Workspace creado!</CardTitle>
            <CardDescription>
              Comparte este código con tu equipo para que se unan a tu empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-xl p-6 text-center">
              <p className="text-xs text-muted-foreground mb-2">Código de invitación</p>
              <p className="text-4xl font-mono font-bold tracking-[0.3em] text-foreground">
                {inviteCode}
              </p>
            </div>
            <Button
              onClick={copyCode}
              variant="outline"
              className="w-full gap-2"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "¡Copiado!" : "Copiar código"}
            </Button>
            <Button
              onClick={() => navigate("/app")}
              className="w-full gradient-primary shadow-primary h-11"
            >
              Ir al dashboard
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
          <CardTitle className="text-2xl">Crea tu workspace</CardTitle>
          <CardDescription>
            Configura tu empresa en Kibbo para empezar a capacitar a tu equipo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCompany} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nombre de la empresa</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ej: Acme Corp"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full gradient-primary shadow-primary h-11"
              disabled={loading || !companyName.trim()}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Crear workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
