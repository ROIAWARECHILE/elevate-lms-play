import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Building2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function JoinCompany() {
  const { companySlug } = useParams();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [companyError, setCompanyError] = useState(false);

  // Fetch company info (works for both anon and authenticated users)
  useEffect(() => {
    if (!companySlug) return;
    supabase
      .from("companies")
      .select("id, name, slug, logo_url, primary_color")
      .eq("slug", companySlug)
      .single()
      .then(({ data, error }) => {
        if (data) setCompany(data);
        else setCompanyError(true);
        setLoading(false);
      });
  }, [companySlug]);

  // Redirect to auth if not logged in (after company loads so user sees the page)
  useEffect(() => {
    if (!authLoading && !user && !loading) {
      navigate(`/auth?redirect=/join/${companySlug}`, { replace: true });
    }
  }, [authLoading, user, loading]);

  // Already in a company
  useEffect(() => {
    if (profile?.company_id) {
      navigate("/app", { replace: true });
    }
  }, [profile?.company_id]);

  const handleJoin = async () => {
    if (!user || !companySlug) return;
    setJoining(true);

    try {
      const { error } = await supabase.rpc("join_company_by_slug", {
        _slug: companySlug,
      });

      if (error) throw error;

      await refreshProfile();
      toast({ title: "¡Te uniste!", description: `Bienvenido a ${company?.name}` });
      navigate("/app");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (companyError || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Empresa no encontrada</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
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
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-primary">
              <Building2 className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Únete a {company.name}</CardTitle>
          <CardDescription>
            Has sido invitado a unirte al equipo de aprendizaje.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleJoin}
            className="w-full gradient-primary shadow-primary h-11"
            disabled={joining}
          >
            {joining ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Unirme al equipo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
