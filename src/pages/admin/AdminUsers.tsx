import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Copy, CheckCircle2, Shield, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { APP_URL } from "@/lib/constants";

interface CompanyUser {
  id: string;
  full_name: string;
  xp_total: number;
  level: number;
  current_streak: number;
  last_activity_date: string | null;
  role: string;
}

export default function AdminUsers() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [togglingRole, setTogglingRole] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.company_id) return;
    fetchData();
  }, [profile?.company_id]);

  const fetchData = async () => {
    const [profilesRes, companyRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, xp_total, level, current_streak, last_activity_date")
        .eq("company_id", profile!.company_id!),
      supabase.from("companies").select("*").eq("id", profile!.company_id!).single(),
    ]);

    if (companyRes.data) setCompany(companyRes.data);

    if (profilesRes.data) {
      // Fetch roles for all users
      const userIds = profilesRes.data.map((p) => p.id);
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const rolesMap: Record<string, string> = {};
      rolesData?.forEach((r: any) => {
        // If user has admin role, mark as admin
        if (r.role === "admin") rolesMap[r.user_id] = "admin";
        else if (!rolesMap[r.user_id]) rolesMap[r.user_id] = r.role;
      });

      setUsers(
        profilesRes.data.map((p) => ({
          ...p,
          role: rolesMap[p.id] || "collaborator",
        }))
      );
    }
    setLoading(false);
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    setTogglingRole(userId);
    const newRole = currentRole === "admin" ? "collaborator" : "admin";

    try {
      // Delete existing role and insert new one
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

  const copyInviteLink = () => {
    if (!company) return;
    const link = `${window.location.origin}/join/${company.slug}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Enlace copiado", description: "Comparte este enlace con tu equipo" });
  };

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
        <Button onClick={copyInviteLink} variant="outline" className="gap-2">
          <Copy className="w-4 h-4" /> Copiar enlace de invitación
        </Button>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Equipo ({users.length} miembros)
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              {users.map((u) => (
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
    </div>
  );
}
