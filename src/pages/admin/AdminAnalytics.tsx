import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function AdminAnalytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analíticas</h1>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Panel de analíticas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-12">
            Próximamente: métricas de engagement, progreso por equipo y reportes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
