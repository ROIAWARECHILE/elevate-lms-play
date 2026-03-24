import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import {
  BookOpen, Trophy, BarChart3, Users, Zap, Target,
  ArrowRight, Star, Flame, Award, Shield, Gamepad2,
  GraduationCap, TrendingUp, CheckCircle2, Play
} from "lucide-react";
import { KibboMascot } from "@/components/KibboMascot";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { useRef } from "react";
import kibboLogo from "@/assets/kibbo-mascot.png";

/* ─── Data ─── */
const features = [
  { icon: BookOpen, title: "Microlecciones interactivas", description: "Lecciones cortas y dinámicas que se adaptan al ritmo de cada colaborador." },
  { icon: Trophy, title: "Gamificación total", description: "XP, streaks, insignias y rankings que motivan el aprendizaje continuo." },
  { icon: BarChart3, title: "Analytics en tiempo real", description: "Mide el progreso, identifica brechas y toma decisiones basadas en datos." },
  { icon: Users, title: "Multi-empresa y equipos", description: "Cada empresa tiene su workspace privado con roles y permisos." },
  { icon: Zap, title: "Fácil de crear contenido", description: "Crea cursos con texto, video, quizzes y más en minutos." },
  { icon: Target, title: "Rutas de aprendizaje", description: "Organiza cursos en rutas personalizadas por cargo, área o nivel." },
];

const steps = [
  { num: 1, icon: BookOpen, title: "Crea cursos", description: "Diseña lecciones y quizzes en minutos con nuestro editor intuitivo." },
  { num: 2, icon: Gamepad2, title: "Tu equipo aprende jugando", description: "Lecciones tipo Duolingo con XP, rachas y rankings que enganchan." },
  { num: 3, icon: TrendingUp, title: "Mide el impacto", description: "Dashboard de analytics para ver quién aprende, cuánto y qué mejorar." },
];

/* ─── Stat counter with viewport trigger ─── */
function StatItem({ value, suffix, label, delay }: { value: number; suffix: string; label: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div
      ref={ref}
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay }}
    >
      <p className="text-4xl md:text-5xl font-extrabold text-gradient">
        {inView ? <AnimatedCounter value={value} suffix={suffix} duration={1400} /> : `0${suffix}`}
      </p>
      <p className="text-sm text-muted-foreground mt-2">{label}</p>
    </motion.div>
  );
}

/* ─── Mockup node ─── */
function MockupNode({ done, active, label, delay }: { done?: boolean; active?: boolean; label: string; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: "spring", stiffness: 200 }}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
        done ? "bg-success text-success-foreground" : active ? "gradient-primary text-primary-foreground animate-pulse-glow" : "bg-muted text-muted-foreground"
      }`}>
        {done ? <CheckCircle2 className="w-5 h-5" /> : active ? <Play className="w-4 h-4" /> : "🔒"}
      </div>
      <span className={`text-sm ${done ? "text-foreground" : active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{label}</span>
    </motion.div>
  );
}

export default function Landing() {
  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
  const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120 } } };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={kibboLogo} alt="Kibbo" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-xl font-bold text-foreground">Kibbo</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/auth">Iniciar sesión</Link></Button>
            <Button asChild className="gradient-primary shadow-primary">
              <Link to="/auth?mode=register">Comenzar gratis <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 px-4 relative">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — copy */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
                <Flame className="w-4 h-4 text-streak" />
                Capacitación corporativa gamificada
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6">
                Capacita a tu equipo{" "}
                <span className="text-gradient">como un juego</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-8 leading-relaxed">
                Crea cursos, lanza quizzes, mide resultados. Tu equipo sube de nivel mientras aprende — inspirado en Duolingo, diseñado para empresas.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <Button size="lg" asChild className="gradient-primary shadow-primary text-base px-8 h-12">
                  <Link to="/auth?mode=register">Crear cuenta gratis <ArrowRight className="w-5 h-5 ml-2" /></Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-base px-8 h-12">
                  <Link to="/auth">Ver demo</Link>
                </Button>
              </div>
            </motion.div>

            {/* Right — Mascot + floating cards */}
            <motion.div className="relative flex justify-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, type: "spring" }}>
              <KibboMascot className="w-48 h-48 md:w-64 md:h-64 drop-shadow-xl" />

              {/* Floating XP card */}
              <motion.div className="absolute -top-2 -right-2 md:top-0 md:right-4" animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                <div className="bg-card rounded-2xl shadow-elevated p-3 flex items-center gap-3 border border-border">
                  <div className="w-9 h-9 rounded-xl bg-xp/10 flex items-center justify-center"><Star className="w-5 h-5 text-xp" /></div>
                  <div className="text-left">
                    <p className="text-sm font-bold">+25 XP</p>
                    <p className="text-xs text-muted-foreground">Quiz completado</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating streak card */}
              <motion.div className="absolute bottom-4 -left-4 md:bottom-8 md:left-0" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }}>
                <div className="bg-card rounded-2xl shadow-elevated p-3 flex items-center gap-3 border border-border">
                  <div className="w-9 h-9 rounded-xl bg-streak/10 flex items-center justify-center"><Flame className="w-5 h-5 text-streak" /></div>
                  <div className="text-left">
                    <p className="text-sm font-bold">🔥 7 días</p>
                    <p className="text-xs text-muted-foreground">Racha activa</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating level card */}
              <motion.div className="absolute -bottom-6 right-8 md:-bottom-4 md:right-12" animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}>
                <div className="bg-card rounded-2xl shadow-elevated p-3 flex items-center gap-3 border border-border">
                  <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center"><Award className="w-5 h-5 text-success" /></div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Nivel 5</p>
                    <p className="text-xs text-muted-foreground">¡Subiste!</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── App Preview Mockup ── */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <motion.div
            className="rounded-2xl border border-border bg-card shadow-elevated overflow-hidden max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/60 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-destructive/40" />
              <div className="w-3 h-3 rounded-full bg-warning/40" />
              <div className="w-3 h-3 rounded-full bg-success/40" />
              <div className="flex-1 mx-4 h-6 rounded-md bg-background/80 flex items-center px-3">
                <span className="text-xs text-muted-foreground">app.kibbo.io/cursos</span>
              </div>
            </div>
            {/* Content */}
            <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
              {/* Left — stats */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">Introducción a la IA</p>
                    <p className="text-xs text-muted-foreground">3 módulos • 6 lecciones</p>
                  </div>
                </div>
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progreso</span><span>67%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }} whileInView={{ width: "67%" }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.5 }} />
                  </div>
                </div>
                {/* Mini stats */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {[{ v: "450", l: "XP", icon: Star, c: "text-xp" }, { v: "5", l: "Nivel", icon: Award, c: "text-primary" }, { v: "7", l: "Racha", icon: Flame, c: "text-streak" }].map(s => (
                    <div key={s.l} className="bg-muted/50 rounded-xl p-3 text-center">
                      <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.c}`} />
                      <p className="text-lg font-bold text-foreground">{s.v}</p>
                      <p className="text-[10px] text-muted-foreground">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Right — course path */}
              <div className="space-y-3 relative">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Ruta del curso</p>
                <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
                <MockupNode done label="¿Qué es la IA?" delay={0.6} />
                <MockupNode done label="Historia de la IA" delay={0.7} />
                <MockupNode done label="Quiz: Fundamentos" delay={0.8} />
                <MockupNode active label="IA en empresas" delay={0.9} />
                <MockupNode label="ChatGPT y LLMs" delay={1.0} />
                <MockupNode label="Quiz: IA aplicada" delay={1.1} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 border-y border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatItem value={95} suffix="%" label="Tasa de completación" delay={0} />
            <StatItem value={3} suffix="x" label="Más engagement" delay={0.1} />
            <StatItem value={10} suffix="min" label="Lecciones diarias" delay={0.2} />
            <StatItem value={50} suffix="%" label="Menos tiempo de capacitación" delay={0.3} />
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Cómo funciona?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Tres pasos para transformar la capacitación de tu equipo.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-0.5 bg-border" />
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                className="text-center relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, type: "spring", stiffness: 120 }}
              >
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5 shadow-primary relative z-10">
                  <step.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Paso {step.num}</span>
                <h3 className="text-xl font-bold mt-2 mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Admin vs Collaborator ── */}
      <section className="py-24 px-4 bg-muted/20">
        <div className="container mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Una plataforma, dos experiencias</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Diseñada tanto para quien gestiona como para quien aprende.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Admin */}
            <motion.div
              className="p-8 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-shadow"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-5">
                <Shield className="w-7 h-7 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Para Administradores</h3>
              <ul className="space-y-3 text-muted-foreground text-sm">
                {["Crea cursos con lecciones y quizzes", "Invita colaboradores con un link", "Visualiza analytics en tiempo real", "Gestiona roles y equipos"].map(t => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />{t}
                  </li>
                ))}
              </ul>
            </motion.div>
            {/* Collaborator */}
            <motion.div
              className="p-8 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-shadow"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-5">
                <Gamepad2 className="w-7 h-7 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Para Colaboradores</h3>
              <ul className="space-y-3 text-muted-foreground text-sm">
                {["Aprende con microlecciones interactivas", "Gana XP y sube de nivel", "Mantén tu racha diaria", "Compite en el ranking del equipo"].map(t => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />{t}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Todo lo que necesitas para capacitar</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Herramientas poderosas para crear, gestionar y medir el aprendizaje.</p>
          </motion.div>
          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="group p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated hover:border-primary/30 transition-all duration-300"
                whileHover={{ y: -4 }}
              >
                <div className="w-12 h-12 rounded-xl bg-accent group-hover:gradient-primary transition-all duration-300 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-accent-foreground group-hover:text-primary-foreground transition-colors duration-300" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA with Mascot ── */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <div className="gradient-hero rounded-3xl p-12 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.12),transparent)]" />
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="shrink-0">
                <div className="relative">
                  <KibboMascot className="w-32 h-32 md:w-40 md:h-40 drop-shadow-2xl" />
                  {/* Speech bubble */}
                  <motion.div
                    className="absolute -top-8 -right-4 bg-primary-foreground rounded-xl px-3 py-2 shadow-lg"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, type: "spring" }}
                  >
                    <p className="text-xs font-bold text-foreground whitespace-nowrap">¿Listo para empezar? 🚀</p>
                    <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-primary-foreground rotate-45" />
                  </motion.div>
                </div>
              </div>
              <div className="text-center md:text-left flex-1">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary-foreground">
                  Empieza a capacitar hoy
                </h2>
                <p className="text-primary-foreground/80 text-lg max-w-xl mb-8">
                  Crea tu workspace en minutos y transforma la forma en que tu equipo aprende. Sin tarjeta de crédito.
                </p>
                <Button size="lg" variant="secondary" asChild className="text-base px-8 h-12 font-semibold">
                  <Link to="/auth?mode=register">Crear cuenta gratis <ArrowRight className="w-5 h-5 ml-2" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-foreground">Kibbo</span>
              </div>
              <p className="text-xs text-muted-foreground">Capacitación corporativa que engancha.</p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Producto</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#how" className="hover:text-foreground transition-colors">Cómo funciona</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Acceso</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/auth" className="hover:text-foreground transition-colors">Iniciar sesión</Link></li>
                <li><Link to="/auth?mode=register" className="hover:text-foreground transition-colors">Registrarse</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Empresa</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/join" className="hover:text-foreground transition-colors">Unirse a empresa</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center">
            <p className="text-sm text-muted-foreground">© 2026 Kibbo. Capacitación que engancha.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
