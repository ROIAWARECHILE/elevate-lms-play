import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, BarChart, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CourseCardSkeleton } from "@/components/SkeletonLoaders";

interface Course {
  id: string;
  title: string;
  description: string;
  level: string;
  estimated_duration_minutes: number;
  cover_image_url: string | null;
  xp_reward: number;
}

const levelColors: Record<string, string> = {
  beginner: "bg-success/10 text-success",
  intermediate: "bg-xp/10 text-xp",
  advanced: "bg-streak/10 text-streak",
};

const levelLabels: Record<string, string> = {
  beginner: "Básico",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export default function Courses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (data) setCourses(data as Course[]);
      setLoading(false);
    };
    fetchCourses();
  }, []);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Catálogo de cursos</h1>
        <p className="text-muted-foreground">Explora los cursos disponibles para ti.</p>
      </motion.div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-16 text-center">
            <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-semibold text-lg mb-2">No hay cursos disponibles</h3>
            <p className="text-muted-foreground text-sm">
              Tu admin publicará cursos pronto. ¡Mantente atento!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 25 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link to={`/app/courses/${course.id}`}>
                <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300 cursor-pointer group overflow-hidden">
                  <div className="h-32 gradient-primary opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-primary-foreground/50 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className={levelColors[course.level]}>
                        {levelLabels[course.level] || course.level}
                      </Badge>
                    </div>
                    <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {course.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {course.estimated_duration_minutes}min
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart className="w-3 h-3" />
                        {course.xp_reward} XP
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
