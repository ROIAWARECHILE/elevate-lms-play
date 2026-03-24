import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { APP_URL } from "@/lib/constants";

export default function AdminSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<any>(null);
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7c3aed");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.company_id) return;
    supabase
      .from("companies")
      .select("*")
      .eq("id", profile.company_id)
      .single()
      .then(({ data }) => {
        if (data) {
          setCompany(data);
          setName(data.name);
          setPrimaryColor(data.primary_color || "#7c3aed");
        }
        setLoading(false);
      });
  }, [profile?.company_id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("companies")
        .update({ name, primary_color: primaryColor })
        .eq("id", company.id);

      if (error) throw error;
      toast({ title: "Configuración guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración</h1>
      <Card className="shadow-card max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Configuración de empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la empresa</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (enlace de invitación)</Label>
              <Input id="slug" value={company?.slug || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Enlace: {APP_URL}/join/{company?.slug}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color primario</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <Button type="submit" className="w-full gradient-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar cambios
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
