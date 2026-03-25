import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Copy, CheckCircle2, Shield, User, Loader2, Clock, XCircle, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanyUser {
  id: string;
  full_name: string;
  xp_total: number;
  level: number;
  current_streak: number;
  last_activity_date: string | null;
  role: string;
  status: string;
}

export default function AdminUsers() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [togglingRole, setTogglingRole] = useState<string | null>(null);
  const [approvingUser, setApprovingUser] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile?.company_id) return;
    fetchData();
  }, [profile?.company_id]);

  const fetchData = async () => {
    const [profilesRes, companyRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, xp_total, level, current_streak, last_activity_date, status")
        .eq("company_id", profile!.company_id!),
      supabase.from("companies").select("*").eq("id", profile!.company_id!).single(),
    ]);

    if (companyRes.data) setCompany(companyRes.data);

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
        profilesRes.data.map((p) => ({
          ...p,
          role: rolesMap[p.id] || "collaborator",
          status: (p as any).status || "active",
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
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast({ title: "Rol actualizado", description: `Usuario cambiado a ${newRole}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTogglingRole(null);
    }
  };

  const approveUser = async (userId: string) => {
    setApprovingUser(userId);
    try {
      const { error } = await supabase.rpc("approve_user", { _target_user_id: userId });
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u))
      );
      toast({ title: "Usuario aprobado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApprovingUser(null);
    }
  };

  const rejectUser = async (userId: string) => {
    setApprovingUser(userId);
    try {
      const { error } = await supabase.rpc("reject_user", { _target_user_id: userId });
      if (error) throw error;
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast({ title: "Usuario rechazado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApprovingUser(null);
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
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "Sin nombre"}</TableCell>
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
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={togglingRole === u.id}
                          onClick={() => toggleRole(u.id, u.role)}
                        >
                          {togglingRole === u.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : u.role === "admin" ? (
                            "Hacer colaborador"
                          ) : (
                            "Hacer admin"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card className="shadow-card">
            <CardContent className="pt-6">
              {pendingUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay solicitudes pendientes
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "Sin nombre"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveUser(u.id)}
                              disabled={approvingUser === u.id}
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
                              disabled={approvingUser === u.id}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
