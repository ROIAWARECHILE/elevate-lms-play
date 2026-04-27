import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Loader2,
  Copy,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  Building2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { KibboExpression } from "@/components/KibboExpression";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

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

const stepOneSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
});
const stepTwoSchema = z.object({
  description: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
  industry: z.string().max(60).optional(),
  size: z.string().max(20).optional(),
});
const stepThreeSchema = z.object({
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine(
      (v) => !v || /^https?:\/\/.+\..+/.test(v),
      "Debe ser una URL válida (https://...)"
    ),
  contact_email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email inválido"),
  country: z.string().max(60).optional(),
});

export default function Onboarding() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [country, setCountry] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7c3aed");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?mode=register&redirect=/onboarding", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast({ title: "Logo demasiado grande", description: "Máximo 2 MB", variant: "destructive" });
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast({ title: "Formato inválido", description: "Sube una imagen", variant: "destructive" });
      return;
    }
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const clearLogo = () => {
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const goNext = () => {
    try {
      if (step === 1) stepOneSchema.parse({ name });
      if (step === 2) stepTwoSchema.parse({ description, industry, size });
      if (step === 3) stepThreeSchema.parse({ website, contact_email: contactEmail, country });
      setStep((s) => Math.min(s + 1, 4));
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message ?? "Revisa los datos";
      toast({ title: "Datos inválidos", description: msg, variant: "destructive" });
    }
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const uploadLogoIfAny = async (companyId: string): Promise<string | null> => {
    if (!logoFile) return null;
    const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${companyId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("company-logos")
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
    if (error) throw error;
    const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // 1) Create company (without logo first; needs id to upload)
      const { data: companyId, error } = await supabase.rpc("create_company_for_user", {
        _name: name.trim(),
        _slug: slug,
        _description: description.trim(),
        _industry: industry,
        _size: size,
        _website: website.trim(),
        _country: country.trim(),
        _contact_email: contactEmail.trim(),
        _primary_color: primaryColor,
        _logo_url: null,
      });
      if (error) throw error;

      // 2) Upload logo (now that admin role + company_id exist)
      try {
        const logoUrl = await uploadLogoIfAny(companyId as unknown as string);
        if (logoUrl) {
          await supabase
            .from("companies")
            .update({ logo_url: logoUrl })
            .eq("id", companyId as unknown as string);
        }
      } catch (e: any) {
        toast({
          title: "Logo no subido",
          description: e.message + ". Podrás subirlo desde Configuración.",
          variant: "destructive",
        });
      }

      await refreshProfile();

      const { data: companyData } = await supabase
        .from("companies")
        .select("invite_code")
        .eq("id", companyId as unknown as string)
        .single();

      setInviteCode(companyData?.invite_code ?? null);
      toast({ title: "¡Workspace creado!", description: `Bienvenido a ${name}` });
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // ===== Success screen =====
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
            <Button onClick={copyCode} variant="outline" className="w-full gap-2">
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

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 gradient-hero opacity-5" />
      <Card className="w-full max-w-xl shadow-elevated relative z-10">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <KibboExpression expression="excited" className="w-16 h-16" />
          </div>
          <CardTitle className="text-2xl">Crea tu workspace</CardTitle>
          <CardDescription>Paso {step} de {totalSteps}</CardDescription>
          <div className="h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
            <div
              className="h-full gradient-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nombre de la empresa <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Acme Corp"
                  maxLength={80}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Este nombre aparecerá en el dashboard de tu equipo y en los certificados.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descripción breve</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="¿A qué se dedica tu empresa?"
                  rows={3}
                  maxLength={500}
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
                  <Label>Tamaño del equipo</Label>
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="website">Sitio web</Label>
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://tuempresa.com"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email de contacto</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contacto@tuempresa.com"
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Ej: España"
                  maxLength={60}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Logo de la empresa</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview ? (
                      <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoSelect}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {logoFile ? "Cambiar" : "Subir logo"}
                    </Button>
                    {logoFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearLogo}
                        className="gap-2 text-destructive ml-2"
                      >
                        <X className="w-4 h-4" /> Quitar
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG/JPG, máx. 2 MB</p>
                  </div>
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
                    className="flex-1 font-mono"
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium mb-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  Resumen
                </div>
                <p><span className="text-muted-foreground">Empresa:</span> {name}</p>
                {industry && <p><span className="text-muted-foreground">Industria:</span> {industry}</p>}
                {size && <p><span className="text-muted-foreground">Tamaño:</span> {size}</p>}
                {website && <p className="truncate"><span className="text-muted-foreground">Web:</span> {website}</p>}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={loading}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Atrás
              </Button>
            )}
            {step < totalSteps ? (
              <Button
                type="button"
                onClick={goNext}
                className="flex-1 gradient-primary shadow-primary h-11 gap-2"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreate}
                className="flex-1 gradient-primary shadow-primary h-11"
                disabled={loading || !name.trim()}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Crear workspace
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
