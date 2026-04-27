import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import {
  BookOpen, Trophy, BarChart3, Users, Zap, Target,
  ArrowRight, Star, Flame, Award, Shield, Gamepad2,
  GraduationCap, TrendingUp, CheckCircle2, Play,
  Sparkles, Rocket, Brain, MessageSquare, ChevronDown, Quote
} from "lucide-react";
import { KibboMascot } from "@/components/KibboMascot";
import { useRef, useState } from "react";
import kibboLogo from "@/assets/kibbo-mascot.png";
import { NumberTicker } from "@/components/magic/NumberTicker";
import { BorderBeam } from "@/components/magic/BorderBeam";
import { ShimmerButton } from "@/components/magic/ShimmerButton";
import { Marquee } from "@/components/magic/Marquee";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

/* ─── Data ─── */
const features = [
  { icon: BookOpen, title: "Microlecciones interactivas", description: "Lecciones cortas y dinámicas que se adaptan al ritmo de cada colaborador." },
  { icon: Trophy, title: "Gamificación total", description: "XP, streaks, insignias y rankings que motivan el aprendizaje continuo." },
  { icon: BarChart3, title: "Analytics en tiempo real", description: "Mide el progreso, identifica brechas y toma decisiones basadas en datos." },
  { icon: Users, title: "Multi-empresa y equipos", description: "Cada empresa tiene su workspace privado con roles y permisos." },
  { icon: Brain, title: "Generación con IA", description: "Sube un PDF y crea un curso completo con Gemini en segundos." },
  { icon: Target, title: "Rutas de aprendizaje", description: "Organiza cursos en rutas personalizadas por cargo, área o nivel." },
];

const steps = [
  { num: 1, icon: BookOpen, title: "Crea cursos", description: "Diseña lecciones y quizzes en minutos con nuestro editor — o genera uno con IA." },
  { num: 2, icon: Gamepad2, title: "Tu equipo aprende jugando", description: "Lecciones tipo Duolingo con XP, rachas y rankings que enganchan." },
  { num: 3, icon: TrendingUp, title: "Mide el impacto", description: "Dashboard de analytics para ver quién aprende, cuánto y qué mejorar." },
];

const testimonials = [
  { name: "María González", role: "Head of People · Acme Corp", quote: "Pasamos del 30% al 92% de completación. El equipo entra solo." },
  { name: "Carlos Ruiz", role: "L&D Manager · TechStart", quote: "Crear un curso con IA me ahorra una semana de trabajo." },
  { name: "Lucía Fernández", role: "CEO · Startup XYZ", quote: "La gamificación cambió la cultura de aprendizaje en mi empresa." },
  { name: "Diego Martín", role: "CTO · DevHouse", quote: "El producto más cuidado que he probado en LMS corporativo." },
  { name: "Ana Torres", role: "RR.HH. · Retail Plus", quote: "Las rachas son adictivas. Mis colaboradores compiten sanamente." },
  { name: "Pedro Sánchez", role: "Director · EduCorp", quote: "Setup en una tarde. Onboarding del equipo en minutos." },
];

const faqs = [
  { q: "¿Necesito tarjeta de crédito para empezar?", a: "No. Puedes crear tu workspace y los primeros cursos sin ingresar datos de pago." },
  { q: "¿Puedo importar contenido existente?", a: "Sí. Sube PDFs o imágenes y nuestra IA los convierte en cursos estructurados con quizzes." },
  { q: "¿Cómo funciona la gamificación?", a: "Cada lección otorga XP, los quizzes dan más. Subes de nivel cada 100 XP, mantienes una racha diaria y compites en rankings." },
  { q: "¿Es multi-empresa?", a: "Sí. Cada empresa tiene su workspace aislado con roles, branding y analytics propios." },
  { q: "¿En qué dispositivos funciona?", a: "Web responsive — desktop, tablet y móvil. Sin instalación." },
];

/* ─── Mockup node ─── */
function MockupNode({ done, active, label, delay }: { done?: boolean; active?: boolean; label: string; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
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
  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
  const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120 } } };

  // Hero parallax
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-xl border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={kibboLogo} alt="Kibbo" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-xl font-bold text-foreground">Kibbo</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="text-muted-foreground hover:text-foreground transition-colors">Cómo funciona</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Testimonios</a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/auth">Iniciar sesión</Link></Button>
            <Button asChild className="gradient-primary shadow-primary">
              <Link to="/auth?mode=register">Comenzar gratis <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className="pt-28 pb-20 md:pt-36 md:pb-32 px-4 relative overflow-hidden">
        {/* Aurora blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/20 blur-[120px] animate-aurora" />
          <div className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/20 blur-[120px] animate-aurora [animation-delay:-9s]" />
        </div>
        {/* Grid pattern */}
        <div
          className="absolute inset-0 -z-10 animate-grid-fade"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)/0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — copy */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-6 relative overflow-hidden"
                whileHover={{ scale: 1.03 }}
              >
                <Sparkles className="w-4 h-4" />
                Ahora con generación de cursos por IA
                <BorderBeam size={80} duration={6} colorFrom="hsl(var(--primary))" colorTo="hsl(var(--accent))" />
              </motion.div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.02] mb-6">
                Capacita a tu equipo{" "}
                <span className="relative inline-block">
                  <span className="text-gradient">como un juego</span>
                  <motion.svg
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 300 12"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.8, duration: 1 }}
                  >
                    <motion.path
                      d="M2 8 Q 75 2, 150 6 T 298 4"
                      stroke="hsl(var(--primary))"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.8, duration: 1 }}
                    />
                  </motion.svg>
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-8 leading-relaxed">
                Crea cursos, lanza quizzes, mide resultados. Tu equipo sube de nivel mientras aprende — inspirado en Duolingo, diseñado para empresas.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <Link to="/auth?mode=register">
                  <ShimmerButton className="text-base font-semibold h-12 px-8">
                    Crear cuenta gratis <ArrowRight className="w-5 h-5 ml-2 inline" />
                  </ShimmerButton>
                </Link>
                <Button size="lg" variant="outline" asChild className="text-base px-8 h-12 group">
                  <Link to="/auth">
                    <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                    Ver demo
                  </Link>
                </Button>
              </div>
              {/* Trust line */}
              <div className="flex items-center gap-4 mt-8 text-sm text-muted-foreground">
                <div className="flex -space-x-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-background gradient-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                      {["AC", "MR", "JS", "LF"][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 fill-xp text-xp" />)}
                    <span className="font-semibold text-foreground ml-1">4.9</span>
                  </div>
                  <p className="text-xs">+500 equipos ya capacitan con Kibbo</p>
                </div>
              </div>
            </motion.div>

            {/* Right — Mascot + floating cards */}
            <motion.div
              className="relative flex justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              {/* Glow halo */}
              <div className="absolute inset-0 flex items-center justify-center -z-10">
                <div className="w-72 h-72 rounded-full bg-gradient-to-tr from-primary/30 to-accent/30 blur-3xl animate-pulse-glow" />
              </div>

              <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
                <KibboMascot className="w-56 h-56 md:w-72 md:h-72 drop-shadow-2xl" />
              </motion.div>

              {/* Floating XP card */}
              <motion.div className="absolute -top-2 -right-2 md:top-0 md:right-4" animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                <div className="bg-card rounded-2xl shadow-elevated p-3 flex items-center gap-3 border border-border relative overflow-hidden">
                  <div className="w-9 h-9 rounded-xl bg-xp/10 flex items-center justify-center"><Star className="w-5 h-5 text-xp" /></div>
                  <div className="text-left">
                    <p className="text-sm font-bold">+<NumberTicker value={25} /> XP</p>
                    <p className="text-xs text-muted-foreground">Quiz completado</p>
                  </div>
                  <BorderBeam size={60} duration={5} colorFrom="hsl(var(--xp))" colorTo="hsl(var(--primary))" />
                </div>
              </motion.div>

              {/* Floating streak card */}
              <motion.div className="absolute bottom-4 -left-4 md:bottom-8 md:-left-2" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }}>
                <div className="bg-card rounded-2xl shadow-elevated p-3 flex items-center gap-3 border border-border">
                  <div className="w-9 h-9 rounded-xl bg-streak/10 flex items-center justify-center"><Flame className="w-5 h-5 text-streak" /></div>
                  <div className="text-left">
                    <p className="text-sm font-bold">🔥 <NumberTicker value={7} /> días</p>
                    <p className="text-xs text-muted-foreground">Racha activa</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating level card */}
              <motion.div className="absolute -bottom-6 right-8 md:-bottom-4 md:right-12" animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}>
                <div className="bg-card rounded-2xl shadow-elevated p-3 flex items-center gap-3 border border-border">
                  <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center"><Award className="w-5 h-5 text-success" /></div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Nivel <NumberTicker value={5} /></p>
                    <p className="text-xs text-muted-foreground">¡Subiste!</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </section>

      {/* ── Logos marquee ── */}
      <section className="py-10 border-y border-border bg-muted/20">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
          Equipos que confían en Kibbo
        </p>
        <Marquee>
          {["ACME CORP", "TECHSTART", "NORDIC LABS", "VERTEX AI", "LUMA", "STARFORGE", "ECHOWAVE", "PIXELFLOW"].map((name) => (
            <div
              key={name}
              className="flex items-center justify-center px-8 py-3 rounded-xl border border-border bg-card/50 text-muted-foreground/70 hover:text-foreground transition-colors font-bold tracking-widest text-sm whitespace-nowrap"
            >
              {name}
            </div>
          ))}
        </Marquee>
      </section>

      {/* ── App Preview Mockup ── */}
      <section className="py-20 px-4 relative">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Aprender nunca fue tan satisfactorio</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Una experiencia diseñada al detalle. Cada interacción está pensada para enganchar.
          </p>
        </motion.div>
        <div className="container mx-auto">
          <motion.div
            className="rounded-2xl border border-border bg-card shadow-elevated overflow-hidden max-w-5xl mx-auto relative"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <BorderBeam size={250} duration={12} delay={0} />
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
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progreso</span><span>67%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }} whileInView={{ width: "67%" }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.5 }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {[{ v: 450, l: "XP", icon: Star, c: "text-xp" }, { v: 5, l: "Nivel", icon: Award, c: "text-primary" }, { v: 7, l: "Racha", icon: Flame, c: "text-streak" }].map(s => (
                    <div key={s.l} className="bg-muted/50 rounded-xl p-3 text-center">
                      <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.c}`} />
                      <p className="text-lg font-bold text-foreground"><NumberTicker value={s.v} /></p>
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

      {/* ── Stats con NumberTicker ── */}
      <section className="py-16 border-y border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { v: 95, suf: "%", l: "Tasa de completación" },
              { v: 3, suf: "x", l: "Más engagement" },
              { v: 10, suf: "min", l: "Lecciones diarias" },
              { v: 50, suf: "%", l: "Menos tiempo de capacitación" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <p className="text-4xl md:text-6xl font-extrabold text-gradient">
                  <NumberTicker value={s.v} />{s.suf}
                </p>
                <p className="text-sm text-muted-foreground mt-2">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section id="how" className="py-24 px-4">
        <div className="container mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Cómo funciona</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2 mb-4">De cero a equipo capacitado en 3 pasos</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Tres pasos para transformar la capacitación de tu empresa.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-transparent via-border to-transparent" />
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

      {/* ── Gamification highlight ── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-50">
          <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-streak/20 blur-3xl animate-aurora" />
          <div className="absolute bottom-0 -right-20 w-96 h-96 rounded-full bg-xp/20 blur-3xl animate-aurora [animation-delay:-10s]" />
        </div>
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="text-xs font-bold text-streak uppercase tracking-[0.2em]">Gamificación de verdad</span>
              <h2 className="text-3xl md:text-5xl font-bold mt-2 mb-6">
                Mecánicas que <span className="text-gradient">enganchan</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                XP, rachas, niveles, ligas semanales, misiones diarias e insignias. Todo respaldado por la psicología del aprendizaje y métricas reales.
              </p>
              <ul className="space-y-4">
                {[
                  { icon: Star, t: "Sistema de XP y niveles", d: "+10 XP por lección, +25 por quiz. Sube de nivel cada 100 XP." },
                  { icon: Flame, t: "Rachas diarias", d: "Mantén el fuego encendido aprendiendo cada día." },
                  { icon: Trophy, t: "Insignias y logros", d: "Desbloquea hitos por completar cursos, mantener rachas o dominar áreas." },
                  { icon: Rocket, t: "Misiones diarias", d: "Quests rotativas que mantienen a tu equipo enganchado." },
                ].map((item) => (
                  <li key={item.t} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{item.t}</p>
                      <p className="text-sm text-muted-foreground">{item.d}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Right — XP card stack */}
            <motion.div
              className="relative h-[500px]"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              {/* Big XP ring card */}
              <motion.div
                className="absolute top-0 right-0 w-72 p-6 rounded-3xl bg-card border border-border shadow-elevated"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity }}
              >
                <BorderBeam size={120} duration={8} colorFrom="hsl(var(--primary))" colorTo="hsl(var(--xp))" />
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Tu progreso</p>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-5xl font-extrabold text-gradient"><NumberTicker value={1240} /></span>
                  <span className="text-sm text-muted-foreground mb-2">XP total</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }} whileInView={{ width: "80%" }} viewport={{ once: true }} transition={{ duration: 1.5 }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">160 XP para Nivel 13</p>
              </motion.div>

              {/* Streak card */}
              <motion.div
                className="absolute top-32 left-0 w-60 p-5 rounded-3xl bg-card border border-border shadow-elevated"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-streak/10 flex items-center justify-center">
                    <Flame className="w-6 h-6 text-streak" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold"><NumberTicker value={14} /> días</p>
                    <p className="text-xs text-muted-foreground">Racha activa</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {[1,2,3,4,5,6,7].map((d) => (
                    <div key={d} className={`flex-1 h-8 rounded-md ${d <= 6 ? "bg-streak" : "bg-muted"} flex items-center justify-center text-[10px] font-bold ${d <= 6 ? "text-streak-foreground" : "text-muted-foreground"}`}>
                      {["L","M","X","J","V","S","D"][d-1]}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Achievement card */}
              <motion.div
                className="absolute bottom-0 right-12 w-64 p-5 rounded-3xl gradient-primary text-primary-foreground shadow-primary"
                animate={{ y: [0, -6, 0], rotate: [-1, 1, -1] }}
                transition={{ duration: 6, repeat: Infinity, delay: 0.5 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="w-8 h-8" />
                  <div>
                    <p className="font-bold">¡Logro desbloqueado!</p>
                    <p className="text-xs opacity-80">Maestro de la IA</p>
                  </div>
                </div>
                <p className="text-xs opacity-90">+100 XP bonus</p>
              </motion.div>

              {/* Leaderboard mini */}
              <motion.div
                className="absolute bottom-20 left-8 w-56 p-4 rounded-2xl bg-card border border-border shadow-elevated"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, delay: 1.5 }}
              >
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Top equipo</p>
                {[
                  { n: "María", xp: 1450, c: "bg-xp text-xp-foreground" },
                  { n: "Tú", xp: 1240, c: "gradient-primary text-primary-foreground" },
                  { n: "Carlos", xp: 980, c: "bg-muted text-muted-foreground" },
                ].map((u, i) => (
                  <div key={u.n} className="flex items-center gap-2 mb-1.5">
                    <div className={`w-6 h-6 rounded-full ${u.c} flex items-center justify-center text-[10px] font-bold`}>{i+1}</div>
                    <span className="text-sm flex-1 font-medium">{u.n}</span>
                    <span className="text-xs text-muted-foreground">{u.xp} XP</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Admin vs Collaborator ── */}
      <section className="py-24 px-4 bg-muted/20">
        <div className="container mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Una plataforma, dos experiencias</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Diseñada tanto para quien gestiona como para quien aprende.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <motion.div
              className="p-8 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all relative overflow-hidden"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-5">
                <Shield className="w-7 h-7 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Para Administradores</h3>
              <ul className="space-y-3 text-muted-foreground text-sm">
                {["Crea cursos con lecciones y quizzes", "Genera cursos completos con IA", "Invita colaboradores con un código", "Visualiza analytics en tiempo real", "Gestiona roles y equipos"].map(t => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />{t}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              className="p-8 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all relative overflow-hidden"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-5">
                <Gamepad2 className="w-7 h-7 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Para Colaboradores</h3>
              <ul className="space-y-3 text-muted-foreground text-sm">
                {["Aprende con microlecciones interactivas", "Gana XP y sube de nivel", "Mantén tu racha diaria", "Desbloquea logros e insignias", "Compite en el ranking del equipo"].map(t => (
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
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Todo lo que necesitas para capacitar</h2>
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
                className="group p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated hover:border-primary/30 transition-all duration-300 relative overflow-hidden"
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

      {/* ── Testimonials marquee ── */}
      <section id="testimonials" className="py-24 bg-muted/20 border-y border-border">
        <div className="container mx-auto px-4 mb-12">
          <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Testimonios</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2 mb-4">Equipos que ya enganchan</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Lo que dicen quienes ya transformaron su capacitación con Kibbo.
            </p>
          </motion.div>
        </div>
        <Marquee>
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="w-[360px] shrink-0 p-6 rounded-2xl bg-card border border-border shadow-card"
            >
              <Quote className="w-5 h-5 text-primary/40 mb-3" />
              <p className="text-sm text-foreground leading-relaxed mb-4">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {t.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </Marquee>
        <div className="mt-6">
          <Marquee reverse slow>
            {[...testimonials].reverse().map((t) => (
              <div
                key={t.name + "-r"}
                className="w-[360px] shrink-0 p-6 rounded-2xl bg-card border border-border shadow-card"
              >
                <Quote className="w-5 h-5 text-accent/40 mb-3" />
                <p className="text-sm text-foreground leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-bold">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Preguntas frecuentes</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-2">Todo lo que necesitas saber</h2>
          </motion.div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border border-border bg-card rounded-2xl mb-3 px-5 data-[state=open]:shadow-card">
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA with Mascot ── */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <div className="gradient-hero rounded-3xl p-12 md:p-16 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent)]" />
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-primary/30 blur-3xl animate-aurora" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-accent/30 blur-3xl animate-aurora [animation-delay:-9s]" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="shrink-0">
                <div className="relative">
                  <KibboMascot className="w-32 h-32 md:w-40 md:h-40 drop-shadow-2xl" />
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
                <h2 className="text-3xl md:text-5xl font-bold mb-4 text-primary-foreground">
                  Empieza a capacitar hoy
                </h2>
                <p className="text-primary-foreground/80 text-lg max-w-xl mb-8">
                  Crea tu workspace en minutos y transforma la forma en que tu equipo aprende. Sin tarjeta de crédito.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-center md:items-start justify-center md:justify-start">
                  <Link to="/auth?mode=register">
                    <ShimmerButton
                      className="text-base font-semibold h-12 px-8"
                      background="hsl(var(--primary-foreground))"
                      shimmerColor="hsl(var(--primary))"
                    >
                      <span className="text-foreground">Crear cuenta gratis</span>
                      <ArrowRight className="w-5 h-5 ml-2 inline text-foreground" />
                    </ShimmerButton>
                  </Link>
                  <Button size="lg" variant="ghost" asChild className="text-base px-8 h-12 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                    <Link to="/auth"><MessageSquare className="w-4 h-4 mr-2" /> Hablar con ventas</Link>
                  </Button>
                </div>
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
                <img src={kibboLogo} alt="Kibbo" className="w-7 h-7 rounded-lg object-cover" />
                <span className="font-bold text-foreground">Kibbo</span>
              </div>
              <p className="text-xs text-muted-foreground">Capacitación corporativa que engancha.</p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Producto</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#how" className="hover:text-foreground transition-colors">Cómo funciona</a></li>
                <li><a href="#testimonials" className="hover:text-foreground transition-colors">Testimonios</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
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
