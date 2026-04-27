import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Loader2, Save, Upload, Building2, X, Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const INDUSTRIES = [
  "Tecnología",
  "Educación",
  "Salud",
  "Finanzas",
  "Retail",
  "Manufactura",
  "Servicios",
  "Hostelería",
  "Construcción",
  "Logística",
  "Otro",
];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

export default function AdminSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7c3aed");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
          setName(data.name ?? "");
          setDescription((data as any).description ?? "");
          setIndustry((data as any).industry ?? "");
          setSize((data as any).size ?? "");
          setWebsite((data as any).website ?? "");
          setCountry((data as any).country ?? "");
          setContactEmail((data as any).contact_email ?? "");
          setPrimaryColor(data.primary_color || "#7c3aed");
          setLogoUrl(data.logo_url ?? null);
        }
        setLoading(false);
      });
  }, [profile?.company_id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !company) return;
    if (f.size > 2 * 1024 * 1024) {
      toast({ title: "Logo demasiado grande", description: "Máximo 2 MB", variant: "destructive" });
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast({ title: "Formato inválido", description: "Sube una imagen", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = f.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${company.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-logos")
        .upload(path, f, { upsert: true, contentType: f.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
      const newUrl = data.publicUrl;
      const { error: updErr } = await supabase
        .from("companies")
        .update({ logo_url: newUrl })
        .eq("id", company.id);
      if (updErr) throw updErr;
      setLogoUrl(newUrl);
      toast({ title: "Logo actualizado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    if (!company) return;
    try {
      const { error } = await supabase
        .from("companies")
        .update({ logo_url: null })
        .eq("id", company.id);
      if (error) throw error;
      setLogoUrl(null);
      toast({ title: "Logo eliminado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!name.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    if (website && !/^https?:\/\/.+\..+/.test(website.trim())) {
      toast({ title: "URL inválida", description: "Empieza con https://", variant: "destructive" });
      return;
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: name.trim(),
          description: description.trim(),
          industry,
          size,
          website: website.trim(),
          country: country.trim(),
          contact_email: contactEmail.trim(),
          primary_color: primaryColor,
        })
        .eq("id", company.id);
      if (error) throw error;
      toast({ title: "Configuración guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyCode = () => {
    if (!company?.invite_code) return;
    navigator.clipboard.writeText(company.invite_code);
    setCopied(true);
    toast({ title: "Código copiado" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Personaliza la información, identidad visual e invitaciones de tu empresa.
        </p>
      </div>

      {/* Identidad visual */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Identidad visual
          </CardTitle>
          <CardDescription>Logo y color de marca de tu empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                  className="gap-2"
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {logoUrl ? "Cambiar logo" : "Subir logo"}
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="gap-2 text-destructive"
                  >
                    <X className="w-4 h-4" /> Quitar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG/JPG, máx. 2 MB</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color primario</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer border border-border"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 max-w-[160px] font-mono"
                maxLength={7}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos de la empresa */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Datos de la empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="¿A qué se dedica tu empresa?"
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/500
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industria</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tamaño</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s} personas
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Sitio web</Label>
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://…"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={60}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Email de contacto</Label>
              <Input
                id="contact_email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contacto@empresa.com"
                maxLength={160}
              />
            </div>

            <Button type="submit" className="w-full gradient-primary" disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar cambios
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Invitaciones */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Código de invitación</CardTitle>
          <CardDescription>
            Compártelo con tu equipo para que se unan a tu workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted rounded-xl p-5 text-center">
            <p className="text-3xl font-mono font-bold tracking-[0.3em]">
              {company?.invite_code}
            </p>
          </div>
          <Button onClick={copyCode} variant="outline" className="w-full gap-2">
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "¡Copiado!" : "Copiar código"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
