import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Trophy, BarChart3, Users, Zap, Target,
  ArrowRight, Star, Flame, Award
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Microlecciones interactivas",
    description: "Lecciones cortas y dinámicas que se adaptan al ritmo de cada colaborador.",
  },
  {
    icon: Trophy,
    title: "Gamificación total",
    description: "XP, streaks, insignias y rankings que motivan el aprendizaje continuo.",
  },
  {
    icon: BarChart3,
    title: "Analytics en tiempo real",
    description: "Mide el progreso, identifica brechas y toma decisiones basadas en datos.",
  },
  {
    icon: Users,
    title: "Multi-empresa y equipos",
    description: "Cada empresa tiene su workspace privado con roles y permisos.",
  },
  {
    icon: Zap,
    title: "Fácil de crear contenido",
    description: "Crea cursos con texto, video, quizzes y más en minutos.",
  },
  {
    icon: Target,
    title: "Rutas de aprendizaje",
    description: "Organiza cursos en rutas personalizadas por cargo, área o nivel.",
  },
];

const stats = [
  { value: "95%", label: "Tasa de completación" },
  { value: "3x", label: "Más engagement" },
  { value: "10min", label: "Lecciones diarias" },
  { value: "50%", label: "Menos tiempo de capacitación" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Kibbo</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Iniciar sesión</Link>
            </Button>
            <Button asChild className="gradient-primary shadow-primary">
              <Link to="/auth?mode=register">
                Comenzar gratis <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="container mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              <Flame className="w-4 h-4 text-streak" />
              Plataforma de capacitación corporativa gamificada
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.1]">
              Capacita a tu equipo{" "}
              <span className="text-gradient">como un juego</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Kibbo transforma la capacitación corporativa en una experiencia
              interactiva, medible y adictiva. Inspirado en Duolingo, diseñado
              para empresas.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="gradient-primary shadow-primary text-base px-8 h-12">
                <Link to="/auth?mode=register">
                  Crear cuenta gratis <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-base px-8 h-12">
                <Link to="/auth">Ver demo</Link>
              </Button>
            </div>
          </motion.div>

          {/* Floating elements */}
          <motion.div
            className="absolute top-20 left-10 hidden lg:block"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <div className="bg-card rounded-2xl shadow-elevated p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-xp/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-xp" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">+25 XP</p>
                <p className="text-xs text-muted-foreground">Quiz completado</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="absolute top-40 right-10 hidden lg:block"
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, delay: 1 }}
          >
            <div className="bg-card rounded-2xl shadow-elevated p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-streak/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-streak" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">🔥 7 días</p>
                <p className="text-xs text-muted-foreground">Racha activa</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="absolute bottom-10 right-1/4 hidden lg:block"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
          >
            <div className="bg-card rounded-2xl shadow-elevated p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-success" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Certificado</p>
                <p className="text-xs text-muted-foreground">IA Generativa</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="text-3xl md:text-4xl font-extrabold text-gradient">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Todo lo que necesitas para capacitar
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Herramientas poderosas para crear, gestionar y medir el aprendizaje en tu organización.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-shadow duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <div className="gradient-hero rounded-3xl p-12 md:p-16 text-center text-primary-foreground relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Empieza a capacitar hoy
              </h2>
              <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto mb-8">
                Crea tu workspace en minutos y transforma la forma en que tu equipo aprende.
              </p>
              <Button size="lg" variant="secondary" asChild className="text-base px-8 h-12 font-semibold">
                <Link to="/auth?mode=register">
                  Crear cuenta gratis <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">Kibbo</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Kibbo. Capacitación que engancha.
          </p>
        </div>
      </footer>
    </div>
  );
}
