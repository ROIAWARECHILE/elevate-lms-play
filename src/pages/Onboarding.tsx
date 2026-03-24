import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { KibboExpression } from "@/components/KibboExpression";
import { useToast } from "@/hooks/use-toast";

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
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

      // Create company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({ name: companyName, slug })
        .select()
        .single();

      if (companyError) throw companyError;

      // Update profile with company_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ company_id: company.id })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Add admin role
      await supabase.from("user_roles").upsert(
        { user_id: user.id, role: "admin" as any },
        { onConflict: "user_id,role" }
      );

      await refreshProfile();
      toast({ title: "¡Workspace creado!", description: `Bienvenido a ${companyName}` });
      navigate("/app");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute inset-0 gradient-hero opacity-5" />
      <Card className="w-full max-w-md shadow-elevated relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-primary animate-pulse-glow">
              <Building2 className="w-8 h-8 text-primary-foreground" />
            </div>
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
