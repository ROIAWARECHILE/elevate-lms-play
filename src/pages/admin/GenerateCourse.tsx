import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Upload, FileText, Image, X, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function GenerateCourse() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [level, setLevel] = useState<string>("beginner");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:...;base64, prefix for PDF, keep full data URI for images
        if (file.type === "application/pdf") {
          resolve(result.split(",")[1]);
        } else {
          resolve(result);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePdfDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") setPdfFile(file);
  }, []);

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    setImageFiles((prev) => [...prev, ...files].slice(0, 5));
  }, []);

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast({ title: "Ingresa un título para el curso", variant: "destructive" });
      return;
    }
    if (!profile?.company_id || !user?.id) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setProgress("Preparando materiales...");

    try {
      let pdfBase64: string | undefined;
      if (pdfFile) {
        setProgress("Procesando PDF...");
        pdfBase64 = await fileToBase64(pdfFile);
      }

      let imageBase64s: string[] | undefined;
      if (imageFiles.length > 0) {
        setProgress("Procesando imágenes...");
        imageBase64s = await Promise.all(imageFiles.map(fileToBase64));
      }

      setProgress("Generando curso con IA... (esto puede tomar 30-60 segundos)");

      const { data, error } = await supabase.functions.invoke("generate-course", {
        body: {
          title: title.trim(),
          instructions: instructions.trim(),
          level,
          pdfBase64,
          imageBase64s,
          companyId: profile.company_id,
          userId: user.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "¡Curso generado exitosamente!",
        description: `Se crearon ${data.modulesCount} módulos con lecciones y quizzes.`,
      });

      navigate(`/app/admin/courses/${data.courseId}`);
    } catch (err: any) {
      console.error("Generation error:", err);
      toast({
        title: "Error al generar el curso",
        description: err.message || "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
      setProgress("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/admin/courses">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Generar curso con IA</h1>
          <p className="text-muted-foreground text-sm">
            Sube materiales y deja que la IA cree el curso completo.
          </p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Información del curso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título del curso *</Label>
            <Input
              id="title"
              placeholder="Ej: Seguridad Informática para Empresas"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={generating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instrucciones para la IA</Label>
            <Textarea
              id="instructions"
              placeholder="Describe qué quieres que contenga el curso, cuántos módulos, enfoque específico, ejemplos que debe incluir..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              disabled={generating}
            />
          </div>

          <div className="space-y-2">
            <Label>Nivel de dificultad</Label>
            <Select value={level} onValueChange={setLevel} disabled={generating}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Básico</SelectItem>
                <SelectItem value="intermediate">Intermedio</SelectItem>
                <SelectItem value="advanced">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PDF Upload */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-accent" />
            Material de referencia (PDF)
          </CardTitle>
          <CardDescription>
            Opcional. Sube un PDF y la IA lo usará como base para generar el contenido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pdfFile ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <FileText className="w-5 h-5 text-primary" />
              <span className="flex-1 text-sm truncate">{pdfFile.name}</span>
              <span className="text-xs text-muted-foreground">
                {(pdfFile.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPdfFile(null)}
                disabled={generating}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handlePdfDrop}
              className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pdf";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) setPdfFile(file);
                };
                input.click();
              }}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Arrastra un PDF aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">Máximo 20 MB</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Upload */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Image className="w-5 h-5 text-accent" />
            Imágenes de referencia
          </CardTitle>
          <CardDescription>
            Opcional. Sube imágenes con diagramas, infografías o contenido visual relevante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {imageFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {imageFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm"
                >
                  <Image className="w-4 h-4" />
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() =>
                      setImageFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    disabled={generating}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleImageDrop}
            className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.multiple = true;
              input.onchange = (e) => {
                const files = Array.from(
                  (e.target as HTMLInputElement).files || []
                );
                setImageFiles((prev) => [...prev, ...files].slice(0, 5));
              };
              input.click();
            }}
          >
            <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Arrastra imágenes aquí o haz clic (máx. 5)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <motion.div whileTap={{ scale: 0.98 }}>
        <Button
          className="w-full h-14 text-lg gradient-primary shadow-primary"
          onClick={handleGenerate}
          disabled={generating || !title.trim()}
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {progress}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Generar curso con IA
            </>
          )}
        </Button>
      </motion.div>

      {generating && (
        <p className="text-center text-sm text-muted-foreground animate-pulse">
          La IA está analizando tus materiales y creando el curso completo...
        </p>
      )}
    </div>
  );
}
