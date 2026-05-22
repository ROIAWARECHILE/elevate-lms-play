import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { motion } from "framer-motion";
import { Loader2, Zap, Users, BookOpen, Target, Flame, Trophy } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

type Period = "7d" | "30d" | "90d";

interface KPIs {
  xpTotal: number;
  activeUsers: number;
  lessonsCompleted: number;
  completionRate: number;
}

interface TopUser {
  full_name: string | null;
  xp_total: number | null;
  level: number | null;
  current_streak: number | null;
}

interface CourseCompletion {
  title: string;
  count: number;
}

interface ChartPoint {
  date: string;
  value: number;
}

function getStartDate(period: Period): string {
  const d = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysInRange(startIso: string): string[] {
  const days: string[] = [];
  const start = new Date(startIso);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const cur = new Date(start);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const fadeIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export default function AdminAnalytics() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({ xpTotal: 0, activeUsers: 0, lessonsCompleted: 0, completionRate: 0 });
  const [lineData, setLineData] = useState<ChartPoint[]>([]);
  const [barData, setBarData] = useState<ChartPoint[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [courseCompletion, setCourseCompletion] = useState<CourseCompletion[]>([]);

  useEffect(() => {
    if (!profile?.company_id) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id, period]);

  const fetchData = async () => {
    setLoading(true);
    const companyId = profile!.company_id!;
    const startDate = getStartDate(period);

    const { data: profileIds } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", companyId);
    const userIds = profileIds?.map((p) => p.id) ?? [];

    const [xpRes, progressRes, allProgressRes, topUsersRes] = await Promise.all([
      supabase
        .from("user_xp_log")
        .select("xp_amount, created_at, user_id")
        .eq("company_id", companyId)
        .gte("created_at", startDate)
        .order("created_at", { ascending: true }),

      userIds.length > 0
        ? supabase
            .from("user_progress")
            .select("completed_at, lesson_id, course_id, courses(title)")
            .in("user_id", userIds)
            .eq("completed", true)
            .gte("completed_at", startDate)
            .not("lesson_id", "is", null)
        : Promise.resolve({ data: [] as any[] }),

      userIds.length > 0
        ? supabase
            .from("user_progress")
            .select("id, lesson_id")
            .in("user_id", userIds)
            .gte("created_at", startDate)
            .not("lesson_id", "is", null)
        : Promise.resolve({ data: [] as any[] }),

      supabase
        .from("profiles")
        .select("full_name, xp_total, level, current_streak")
        .eq("company_id", companyId)
        .order("xp_total", { ascending: false })
        .limit(10),
    ]);

    const xpLogs = xpRes.data ?? [];
    const completed = progressRes.data ?? [];
    const allStarted = allProgressRes.data ?? [];
    const users = topUsersRes.data ?? [];

    // KPIs
    const xpTotal = xpLogs.reduce((s, l) => s + (l.xp_amount ?? 0), 0);
    const activeUsers = new Set(xpLogs.map((l) => l.user_id)).size;
    const lessonsCompleted = completed.length;
    const completionRate =
      allStarted.length > 0 ? Math.round((lessonsCompleted / allStarted.length) * 100) : 0;
    setKpis({ xpTotal, activeUsers, lessonsCompleted, completionRate });

    // LineChart: XP acumulado por día
    const days = daysInRange(startDate);
    const xpByDay: Record<string, number> = {};
    for (const log of xpLogs) {
      const day = (log.created_at ?? "").slice(0, 10);
      if (day) xpByDay[day] = (xpByDay[day] ?? 0) + (log.xp_amount ?? 0);
    }
    let running = 0;
    setLineData(days.map((day) => {
      running += xpByDay[day] ?? 0;
      return { date: shortDate(day), value: running };
    }));

    // BarChart: lecciones completadas por día
    const lessonsByDay: Record<string, number> = {};
    for (const p of completed) {
      const day = (p.completed_at ?? "").slice(0, 10);
      if (day) lessonsByDay[day] = (lessonsByDay[day] ?? 0) + 1;
    }
    setBarData(days.map((day) => ({ date: shortDate(day), value: lessonsByDay[day] ?? 0 })));

    // Top usuarios
    setTopUsers(users);

    // Completaciones por curso
    const countByCourse: Record<string, { title: string; count: number }> = {};
    for (const p of completed) {
      const courseTitle = (p.courses as any)?.title ?? "Sin nombre";
      const key = p.course_id ?? courseTitle;
      if (!countByCourse[key]) countByCourse[key] = { title: courseTitle, count: 0 };
      countByCourse[key].count++;
    }
    setCourseCompletion(Object.values(countByCourse).sort((a, b) => b.count - a.count));

    setLoading(false);
  };

  const kpiCards = [
    { label: "XP generado", value: kpis.xpTotal, icon: Zap, color: "text-xp", bg: "bg-xp/10", suffix: " XP" },
    { label: "Usuarios activos", value: kpis.activeUsers, icon: Users, color: "text-primary", bg: "bg-primary/10", suffix: "" },
    { label: "Lecciones completadas", value: kpis.lessonsCompleted, icon: BookOpen, color: "text-success", bg: "bg-success/10", suffix: "" },
    { label: "Tasa de finalización", value: kpis.completionRate, icon: Target, color: "text-streak", bg: "bg-streak/10", suffix: "%" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analíticas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Métricas de engagement y aprendizaje de tu equipo</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="7d">7 días</TabsTrigger>
            <TabsTrigger value="30d">30 días</TabsTrigger>
            <TabsTrigger value="90d">90 días</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi, i) => (
              <motion.div key={kpi.label} {...fadeIn} transition={{ delay: 0.05 * i, type: "spring", stiffness: 300, damping: 25 }}>
                <Card className="shadow-card hover:shadow-elevated transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>
                      <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-bold leading-none">
                        <AnimatedCounter value={kpi.value} duration={800} suffix={kpi.suffix} />
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{kpi.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div {...fadeIn} transition={{ delay: 0.2 }}>
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-xp" /> XP acumulado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lineData.some((d) => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => [`${v} XP`, "XP acumulado"]} />
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12 text-sm">Sin actividad en este período</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...fadeIn} transition={{ delay: 0.25 }}>
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-success" /> Lecciones por día
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {barData.some((d) => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip formatter={(v: number) => [v, "Completadas"]} />
                        <Bar dataKey="value" fill="hsl(var(--primary) / 0.7)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12 text-sm">Sin completaciones en este período</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div {...fadeIn} transition={{ delay: 0.3 }}>
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-xp" /> Top usuarios
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {topUsers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Usuario</TableHead>
                          <TableHead className="text-right">XP</TableHead>
                          <TableHead className="text-right">Nivel</TableHead>
                          <TableHead className="text-right">Racha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topUsers.map((u, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium truncate max-w-[120px]">
                              {u.full_name ?? "Usuario"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="bg-xp/10 text-xp font-semibold">
                                {u.xp_total ?? 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm">{u.level ?? 1}</TableCell>
                            <TableCell className="text-right">
                              <span className="flex items-center justify-end gap-1 text-streak text-sm font-semibold">
                                <Flame className="w-3 h-3" />{u.current_streak ?? 0}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">Sin usuarios registrados</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...fadeIn} transition={{ delay: 0.35 }}>
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> Completaciones por curso
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {courseCompletion.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Curso</TableHead>
                          <TableHead className="text-right">Completaciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {courseCompletion.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium truncate max-w-[200px]">{c.title}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{c.count}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">Sin completaciones en este período</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
