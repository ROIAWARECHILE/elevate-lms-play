import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function AdminUsers() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Usuarios</h1>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Gestión de usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-12">
            Próximamente: gestión de usuarios, invitaciones y permisos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
