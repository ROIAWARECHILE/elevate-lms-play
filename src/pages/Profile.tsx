import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Zap, Flame, Trophy, Award, BookOpen, Pencil, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [completedCourses, setCompletedCourses] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editJob, setEditJob] = useState("");
  const [saving, setSaving] = useState(false);
  const [xpHistory, setXpHistory] = useState<{ week: string; xp: number }[]>([]);

  const level = profile?.level || 1;
  const xpTotal = profile?.xp_total || 0;
  const xpForLevel = (n: number) => Math.round(100 * Math.pow(n, 1.4));
  const xpCurrentLevelStart = xpForLevel(level);
  const xpNextLevel = xpForLevel(level + 1);
  const xpInCurrentLevel = xpTotal - xpCurrentLevelStart;
  const xpNeeded = xpNextLevel - xpCurrentLevelStart;
  const xpProgress = Math.min((xpInCurrentLevel / xpNeeded) * 100, 100);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const { data } = await supabase
        .from("user_progress")
        .select("course_id")
        .eq("user_id", user.id)
        .eq("completed", true)
        .not("course_id", "is", null);

      if (data) {
        const uniqueCourses = new Set(data.map((r) => r.course_id));
        setCompletedCourses(uniqueCourses.size);
      }
    };
    fetchStats();
  }, [user]);

  // XP histórico por semana (últimas 7 semanas)
  useEffect(() => {
    if (!user) return;
    const fetchXpHistory = async () => {
      const weeks: { week: string; xp: number }[] = [];
      const now = new Date();
      for (let w = 6; w >= 0; w--) {
        const start = new Date(now);
        start.setDate(now.getDate() - w * 7 - now.getDay());
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);

        const { data } = await supabase
          .from("user_xp_log")
          .select("xp_amount")
          .eq("user_id", user.id)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString());

        const total = (data ?? []).reduce((acc, r) => acc + (r.xp_amount ?? 0), 0);
        const label = w === 0 ? "Esta sem." : `Sem -${w}`;
        weeks.push({ week: label, xp: total });
      }
      setXpHistory(weeks);
    };
    fetchXpHistory();
  }, [user]);

  const openEdit = () => {
    setEditName(profile?.full_name ?? "");
    setEditJob(profile?.job_title ?? "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editName.trim(), job_title: editJob.trim() })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setEditOpen(false);
      toast({ title: "Perfil actualizado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    { label: "XP Total", value: xpTotal, icon: Zap, color: "text-xp", bg: "bg-xp/10" },
    { label: "Racha actual", value: profile?.current_streak || 0, icon: Flame, color: "text-streak", bg: "bg-streak/10", suffix: " días" },
    { label: "Mejor racha", value: profile?.longest_streak || 0, icon: Award, color: "text-primary", bg: "bg-primary/10", suffix: " días" },
    { label: "Cursos completados", value: completedCourses, icon: BookOpen, color: "text-success", bg: "bg-success/10" },
  ];

  const maxXp = Math.max(...xpHistory.map((h) => h.xp), 1);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div
        className="text-center relative"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <motion.div
          className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-4 shadow-primary"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
        >
          {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
        </motion.div>
        <h1 className="text-2xl font-bold">{profile?.full_name || "Usuario"}</h1>
        <p className="text-muted-foreground">{user?.email}</p>
        {profile?.job_title && (
          <p className="text-sm text-muted-foreground mt-1">{profile.job_title}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-muted-foreground gap-1.5"
          onClick={openEdit}
        >
          <Pencil className="w-3.5 h-3.5" /> Editar perfil
        </Button>
      </motion.div>

      {/* Level Progress */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="shadow-card gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Nivel <AnimatedCounter value={level} duration={600} />
              </span>
              <span className="text-sm text-muted-foreground">
                <AnimatedCounter value={xpInCurrentLevel} duration={600} /> / {xpNeeded} XP
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full gradient-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08, type: "spring", stiffness: 300, damping: 25 }}
            whileHover={{ y: -2, scale: 1.02 }}
          >
            <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold">
                    <AnimatedCounter value={stat.value} duration={800} suffix={stat.suffix} />
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* XP Histórico */}
      {xpHistory.some((h) => h.xp > 0) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="shadow-card">
            <CardContent className="p-5">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-xp" /> XP últimas 7 semanas
              </p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={xpHistory} barCategoryGap="20%">
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                    formatter={(v: number) => [`${v} XP`, ""]}
                    labelStyle={{ display: "none" }}
                  />
                  <Bar dataKey="xp" radius={[4, 4, 0, 0]}>
                    {xpHistory.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.xp === maxXp ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <AchievementsGrid />
      </motion.div>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-job">Cargo / Rol</Label>
              <Input
                id="edit-job"
                value={editJob}
                onChange={(e) => setEditJob(e.target.value)}
                placeholder="Ej: Diseñadora UX"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={saving || !editName.trim()} className="gradient-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
