import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Trophy, Flame, Zap, Target, TrendingUp, Users, Award } from "lucide-react";
import { motion } from "framer-motion";
import { WalkthroughOverlay } from "@/components/WalkthroughOverlay";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function CollaboratorDashboard({ profile }: { profile: any }) {
  return (
    <div className="space-y-6" data-walkthrough="dashboard">
      <div>
        <h1 className="text-2xl font-bold">
          ¡Hola, {profile?.full_name?.split(" ")[0] || "Colaborador"}! 👋
        </h1>
        <p className="text-muted-foreground">Continúa tu aprendizaje donde lo dejaste.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-walkthrough="stats">
        {[
          { label: "XP Total", value: profile?.xp_total || 0, icon: Zap, color: "text-xp", bg: "bg-xp/10" },
          { label: "Racha", value: `${profile?.current_streak || 0} días`, icon: Flame, color: "text-streak", bg: "bg-streak/10" },
          { label: "Nivel", value: profile?.level || 1, icon: Trophy, color: "text-primary", bg: "bg-primary/10" },
          { label: "Cursos", value: 0, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeIn} transition={{ delay: i * 0.1 }}>
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div {...fadeIn} transition={{ delay: 0.4 }}>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Cursos en progreso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tienes cursos asignados aún</p>
              <p className="text-sm">Tu admin te asignará cursos pronto.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeIn} transition={{ delay: 0.5 }}>
        <Card className="shadow-card gradient-card" data-walkthrough="daily-goal">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Meta diaria
              </h3>
              <span className="text-sm text-muted-foreground">0 / 30 XP</span>
            </div>
            <Progress value={0} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              Completa lecciones para alcanzar tu meta diaria de 30 XP
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function AdminDashboard({ profile }: { profile: any }) {
  return (
    <div className="space-y-6" data-walkthrough="dashboard">
      <div>
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p className="text-muted-foreground">Vista general de tu workspace Kibbo.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Usuarios activos", value: 0, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "Cursos publicados", value: 0, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
          { label: "Tasa de completación", value: "0%", icon: TrendingUp, color: "text-xp", bg: "bg-xp/10" },
          { label: "Certificados emitidos", value: 0, icon: Award, color: "text-streak", bg: "bg-streak/10" },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeIn} transition={{ delay: i * 0.1 }}>
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div {...fadeIn} transition={{ delay: 0.4 }}>
        <Card className="shadow-card" data-walkthrough="admin-steps">
          <CardHeader>
            <CardTitle className="text-lg">Primeros pasos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { step: "1", text: "Configura tu empresa", desc: "Nombre, logo y colores", done: false },
              { step: "2", text: "Crea tu primer curso", desc: "Añade módulos y lecciones", done: false },
              { step: "3", text: "Invita colaboradores", desc: "Tu equipo podrá empezar a aprender", done: false },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                  {item.step}
                </div>
                <div>
                  <p className="font-medium text-sm">{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  
  return (
    <>
      <WalkthroughOverlay isAdmin={isAdmin} />
      {isAdmin
        ? <AdminDashboard profile={profile} />
        : <CollaboratorDashboard profile={profile} />}
    </>
  );
}
