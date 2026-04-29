import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, Eye, EyeOff, Sparkles, Wrench, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  title: string;
  description: string;
  level: string;
  status: string;
  estimated_duration_minutes: number;
  xp_reward: number;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  published: { label: "Publicado", variant: "default" },
  archived: { label: "Archivado", variant: "destructive" },
};

export default function AdminCourses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCourses = async () => {
    const { data } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCourses(data as Course[]);
    setLoading(false);
  };

  useEffect(() => { fetchCourses(); }, []);

  const togglePublish = async (course: Course) => {
    if (course.status === "published") {
      // Despublicar: update directo (no requiere validación)
      const { error } = await supabase.from("courses").update({ status: "draft" as any }).eq("id", course.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: "Curso despublicado" }); fetchCourses(); }
      return;
    }
    // Publicar: validar primero con el RPC
    setBusyId(course.id);
    try {
      const { data, error } = await supabase.rpc("publish_course_if_valid" as any, { _course_id: course.id });
      if (error) throw error;
      const r: any = data || {};
      if (r.published) {
        toast({
          title: r.status === "needs_review" ? "Publicado con advertencias" : "Curso publicado",
          description: `${r.lessons_valid}/${r.lessons_total} lecciones válidas en ${r.modules_valid}/${r.modules_total} módulos.`,
        });
        fetchCourses();
      } else {
        const issues = Array.isArray(r.issues) ? r.issues.slice(0, 3) : [];
        const sample = issues.map((i: any) => `• ${i.module}${i.lesson ? " · " + i.lesson : ""}: ${i.reason}`).join("\n");
        toast({
          title: "No se pudo publicar",
          description: `El curso no tiene contenido renderizable suficiente.${sample ? `\n\n${sample}` : ""}\n\nUsá "Reparar" para regenerar las lecciones rotas.`,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const repairCourse = async (course: Course) => {
    if (!profile?.company_id) return;
    setBusyId(course.id);
    toast({ title: "Reparando…", description: "Regenerando lecciones rotas. Puede tardar unos minutos." });
    try {
      const { data, error } = await supabase.functions.invoke("repair-course", {
        body: { courseId: course.id, companyId: profile.company_id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Repair failed");
      const repaired = data.repairedCount || 0;
      const broken = data.stillBrokenCount || 0;
      toast({
        title: broken === 0 ? "Reparación completa" : "Reparación parcial",
        description: `${repaired} lección(es) regeneradas${broken ? ` · ${broken} siguen fallando` : ""}.`,
        variant: broken > 0 ? "destructive" : "default",
      });
      fetchCourses();
    } catch (e: any) {
      toast({ title: "Error reparando", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestionar cursos</h1>
          <p className="text-muted-foreground">Crea y administra los cursos de tu empresa.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="gradient-primary shadow-primary">
            <Link to="/app/admin/courses/studio">
              <Sparkles className="w-4 h-4 mr-2" /> Crear curso con IA
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-16 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-semibold text-lg mb-2">No hay cursos aún</h3>
            <p className="text-muted-foreground text-sm mb-4">Crea tu primer curso para empezar.</p>
            <Button asChild className="gradient-primary shadow-primary">
              <Link to="/app/admin/courses/studio">
                <Sparkles className="w-4 h-4 mr-2" /> Crear curso con IA
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course, i) => {
            const isBusy = busyId === course.id;
            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="shadow-card hover:shadow-elevated transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/app/admin/courses/${course.id}`} className="font-semibold hover:text-primary transition-colors">
                        {course.title}
                      </Link>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <Badge {...statusConfig[course.status]} className="text-xs">
                          {statusConfig[course.status]?.label}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {course.estimated_duration_minutes}min
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => repairCourse(course)}
                      disabled={isBusy}
                      title="Audita el curso y regenera lecciones rotas"
                    >
                      {isBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wrench className="w-4 h-4 mr-1" />}
                      Reparar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePublish(course)}
                      disabled={isBusy}
                    >
                      {isBusy && course.status !== "published" ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : course.status === "published" ? (
                        <EyeOff className="w-4 h-4 mr-1" />
                      ) : (
                        <Eye className="w-4 h-4 mr-1" />
                      )}
                      {course.status === "published" ? "Despublicar" : "Publicar"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
