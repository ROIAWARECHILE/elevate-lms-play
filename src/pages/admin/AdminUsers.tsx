import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  CheckCircle2,
  Shield,
  User,
  Loader2,
  Clock,
  XCircle,
  KeyRound,
  MoreHorizontal,
  Eye,
  RotateCcw,
  Trash2,
  Zap,
  Flame,
  BookOpen,
  Trophy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanyUser {
  id: string;
  full_name: string;
  xp_total: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  job_title: string | null;
  role: string;
  status: string;
  email?: string | null;
  requested_at?: string | null;
}

interface UserDetail {
  user: CompanyUser;
  completedLessons: number;
  completedCourses: number;
  totalMistakes: number;
  achievements: number;
  recentXp: { source: string; xp_amount: number; created_at: string }[];
}

type ConfirmAction = { type: "remove" | "reset"; user: CompanyUser } | null;

function formatRelative(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace instantes";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export default function AdminUsers() {
  const { profile, user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [togglingRole, setTogglingRole] = useState<string | null>(null);
  const [approvingUser, setApprovingUser] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  useEffect(() => {
    if (!profile?.company_id) return;
    fetchData();
  }, [profile?.company_id]);

  // Realtime: refresh list when any profile in this company changes status
  useEffect(() => {
    if (!profile?.company_id) return;
    const channel = supabase
      .channel(`admin-users-${profile.company_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `company_id=eq.${profile.company_id}` },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

  const fetchData = async () => {
    const [profilesRes, companyRes, pendingRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, xp_total, level, current_streak, longest_streak, last_activity_date, job_title, status, created_at, updated_at")
        .eq("company_id", profile!.company_id!),
      supabase.from("companies").select("*").eq("id", profile!.company_id!).single(),
      supabase.rpc("get_pending_users"),
    ]);

    if (companyRes.data) setCompany(companyRes.data);

    const pendingMap: Record<string, { email: string | null; requested_at: string | null }> = {};
    (pendingRes.data || []).forEach((p: any) => {
      pendingMap[p.id] = { email: p.email ?? null, requested_at: p.requested_at ?? null };
    });

    if (profilesRes.data) {
      const userIds = profilesRes.data.map((p) => p.id);
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const rolesMap: Record<string, string> = {};
      rolesData?.forEach((r: any) => {
        if (r.role === "admin") rolesMap[r.user_id] = "admin";
        else if (!rolesMap[r.user_id]) rolesMap[r.user_id] = r.role;
      });

      setUsers(
        profilesRes.data.map((p: any) => ({
          ...p,
          role: rolesMap[p.id] || "collaborator",
          status: p.status || "active",
          email: pendingMap[p.id]?.email ?? null,
          requested_at: pendingMap[p.id]?.requested_at ?? p.updated_at ?? p.created_at,
        }))
      );
    }
    setLoading(false);
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    setTogglingRole(userId);
    const newRole = currentRole === "admin" ? "collaborator" : "admin";
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      toast({ title: "Rol actualizado", description: `Usuario cambiado a ${newRole}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTogglingRole(null);
    }
  };

  const approveUser = async (userId: string) => {
    // Optimistic update first for instant UX
    setApprovingUser(userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u)));
    try {
      const { error } = await supabase.rpc("approve_user", { _target_user_id: userId });
      if (error) throw error;
      toast({ title: "Usuario aprobado" });
    } catch (e: any) {
      // rollback
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "pending" } : u)));
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApprovingUser(null);
    }
  };

  const approveAllPending = async () => {
    setBulkApproving(true);
    const previousUsers = users;
    setUsers((prev) => prev.map((u) => (u.status === "pending" ? { ...u, status: "active" } : u)));
    try {
      const { data, error } = await supabase.rpc("approve_all_pending_users");
      if (error) throw error;
      toast({ title: `${data || 0} usuario(s) aprobado(s)` });
    } catch (e: any) {
      setUsers(previousUsers);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBulkApproving(false);
    }
  };

  const rejectUser = async (userId: string) => {
    setApprovingUser(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { target_user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast({ title: "Usuario rechazado y eliminado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApprovingUser(null);
    }
  };

  const openDetail = async (u: CompanyUser) => {
    setDetail({ user: u, completedLessons: 0, completedCourses: 0, totalMistakes: 0, achievements: 0, recentXp: [] });
    setDetailLoading(true);
    try {
      const [lessonsRes, coursesRes, mistakesRes, achRes, xpRes] = await Promise.all([
        supabase.from("user_progress").select("lesson_id", { count: "exact", head: true })
          .eq("user_id", u.id).eq("completed", true).not("lesson_id", "is", null),
        supabase.from("user_progress").select("course_id")
          .eq("user_id", u.id).eq("completed", true).not("course_id", "is", null),
        supabase.from("user_mistakes").select("id", { count: "exact", head: true })
          .eq("user_id", u.id).eq("mastered", false),
        supabase.from("user_achievements").select("id", { count: "exact", head: true })
          .eq("user_id", u.id),
        supabase.from("user_xp_log").select("source, xp_amount, created_at")
          .eq("user_id", u.id).order("created_at", { ascending: false }).limit(10),
      ]);

      const uniqueCourses = new Set((coursesRes.data || []).map((r: any) => r.course_id)).size;

      setDetail({
        user: u,
        completedLessons: lessonsRes.count || 0,
        completedCourses: uniqueCourses,
        totalMistakes: mistakesRes.count || 0,
        achievements: achRes.count || 0,
        recentXp: xpRes.data || [],
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  const performAction = async () => {
    if (!confirmAction) return;
    const { type, user: u } = confirmAction;
    setActionLoading(u.id);
    try {
      if (type === "remove") {
        const { data, error } = await supabase.functions.invoke("admin-delete-user", {
          body: { target_user_id: u.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
        toast({ title: "Usuario eliminado", description: `${u.full_name || "Usuario"} ha sido borrado por completo` });
      } else {
        const { error } = await supabase.rpc("reset_user_progress", { _target_user_id: u.id });
        if (error) throw error;
        setUsers((prev) =>
          prev.map((x) =>
            x.id === u.id
              ? { ...x, xp_total: 0, level: 1, current_streak: 0, longest_streak: 0, last_activity_date: null }
              : x
          )
        );
        toast({ title: "Progreso reiniciado", description: `Se ha reiniciado el progreso de ${u.full_name || "Usuario"}` });
      }
      setConfirmAction(null);
      setDetail(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const copyInviteCode = () => {
    if (!company?.invite_code) return;
    navigator.clipboard.writeText(company.invite_code);
    setCopied(true);
    toast({ title: "Código copiado", description: "Comparte este código con tu equipo" });
    setTimeout(() => setCopied(false), 2000);
  };

  const activeUsers = users.filter((u) => u.status === "active");
  const pendingUsers = users.filter((u) => u.status === "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Button onClick={copyInviteCode} variant="outline" className="gap-2">
          {copied ? <CheckCircle2 className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
          {copied ? "¡Copiado!" : `Código: ${company?.invite_code || "..."}`}
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Users className="w-4 h-4" /> Activos ({activeUsers.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" /> Pendientes ({pendingUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>XP</TableHead>
                    <TableHead>Racha</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => openDetail(u)}
                            className="hover:underline text-left"
                          >
                            {u.full_name || "Sin nombre"}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"} className="gap-1">
                            {u.role === "admin" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {u.role === "admin" ? "Admin" : "Colaborador"}
                          </Badge>
                        </TableCell>
                        <TableCell>{u.level}</TableCell>
                        <TableCell>{u.xp_total}</TableCell>
                        <TableCell>{u.current_streak} 🔥</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {u.last_activity_date || "Nunca"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={actionLoading === u.id}>
                                {actionLoading === u.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="w-4 h-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => openDetail(u)}>
                                <Eye className="w-4 h-4 mr-2" /> Ver progreso
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={togglingRole === u.id}
                                onClick={() => toggleRole(u.id, u.role)}
                              >
                                <Shield className="w-4 h-4 mr-2" />
                                {u.role === "admin" ? "Hacer colaborador" : "Hacer admin"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={isSelf}
                                onClick={() => setConfirmAction({ type: "reset", user: u })}
                              >
                                <RotateCcw className="w-4 h-4 mr-2" /> Reiniciar progreso
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={isSelf}
                                className="text-destructive focus:text-destructive"
                                onClick={() => setConfirmAction({ type: "remove", user: u })}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar de la empresa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card className="shadow-card">
            <CardContent className="pt-6">
              {pendingUsers.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-success" />
                  <p className="text-muted-foreground">No hay solicitudes pendientes</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground">
                      {pendingUsers.length} solicitud{pendingUsers.length === 1 ? "" : "es"} esperando aprobación
                    </p>
                    <Button
                      size="sm"
                      onClick={approveAllPending}
                      disabled={bulkApproving}
                      className="gap-2"
                    >
                      {bulkApproving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Aprobar a todos
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Solicitado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name || "Sin nombre"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatRelative(u.requested_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => approveUser(u.id)}
                                disabled={approvingUser === u.id || bulkApproving}
                                className="gap-1"
                              >
                                {approvingUser === u.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectUser(u.id)}
                                disabled={approvingUser === u.id || bulkApproving}
                                className="gap-1"
                              >
                                <XCircle className="w-4 h-4" />
                                Rechazar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.user.full_name || "Usuario"}</DialogTitle>
            <DialogDescription>
              {detail?.user.job_title || "Sin cargo"} · Nivel {detail?.user.level}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatTile icon={Zap} label="XP Total" value={detail.user.xp_total} color="text-xp" bg="bg-xp/10" />
                <StatTile icon={Flame} label="Racha" value={detail.user.current_streak} color="text-streak" bg="bg-streak/10" />
                <StatTile icon={BookOpen} label="Lecciones" value={detail.completedLessons} color="text-success" bg="bg-success/10" />
                <StatTile icon={Trophy} label="Logros" value={detail.achievements} color="text-primary" bg="bg-primary/10" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Cursos completados</p>
                  <p className="font-semibold text-lg">{detail.completedCourses}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Errores pendientes</p>
                  <p className="font-semibold text-lg">{detail.totalMistakes}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Actividad XP reciente</h3>
                {detail.recentXp.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividad registrada</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {detail.recentXp.map((x, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-b-0">
                        <span className="text-muted-foreground">{x.source}</span>
                        <span className="font-medium text-xp">+{x.xp_amount} XP</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detail.user.id !== currentUser?.id && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => setConfirmAction({ type: "reset", user: detail.user })}
                  >
                    <RotateCcw className="w-4 h-4" /> Reiniciar progreso
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={() => setConfirmAction({ type: "remove", user: detail.user })}
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Confirm action */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "remove" ? "¿Eliminar usuario?" : "¿Reiniciar progreso?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "remove"
                ? `Se eliminará a ${confirmAction.user.full_name || "este usuario"} de la empresa. Se borrarán XP, lecciones, errores, logros y misiones. Esta acción no se puede deshacer.`
                : `Se borrará todo el XP, nivel, rachas, lecciones completadas, errores y logros de ${confirmAction?.user.full_name || "este usuario"}. El usuario seguirá en la empresa.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={performAction}
              disabled={!!actionLoading}
              className={confirmAction?.type === "remove" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : confirmAction?.type === "remove" ? (
                "Eliminar"
              ) : (
                "Reiniciar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-bold text-lg">{value}</p>
    </div>
  );
}
