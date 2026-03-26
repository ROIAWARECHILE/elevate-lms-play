import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, BookOpen, MoreVertical, Clock, Eye, EyeOff, Sparkles } from "lucide-react";
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
    const newStatus = course.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("courses")
      .update({ status: newStatus as any })
      .eq("id", course.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newStatus === "published" ? "Curso publicado" : "Curso despublicado" });
      fetchCourses();
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
          <Button asChild variant="outline">
            <Link to="/app/admin/courses/new">
              <PlusCircle className="w-4 h-4 mr-2" /> Crear curso
            </Link>
          </Button>
          <Button asChild className="gradient-primary shadow-primary">
            <Link to="/app/admin/courses/generate">
              <Sparkles className="w-4 h-4 mr-2" /> Generar con IA
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
              <Link to="/app/admin/courses/new">
                <PlusCircle className="w-4 h-4 mr-2" /> Crear curso
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course, i) => (
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
                    onClick={() => togglePublish(course)}
                  >
                    {course.status === "published" ? (
                      <><EyeOff className="w-4 h-4 mr-1" /> Despublicar</>
                    ) : (
                      <><Eye className="w-4 h-4 mr-1" /> Publicar</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
