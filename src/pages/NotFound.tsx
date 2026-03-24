import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { KibboExpression } from "@/components/KibboExpression";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <KibboExpression expression="sad" className="w-32 h-32 mx-auto mb-6" />
        <h1 className="mb-2 text-5xl font-extrabold text-foreground">404</h1>
        <p className="mb-2 text-xl font-semibold text-foreground">¡Ups! Página no encontrada</p>
        <p className="mb-6 text-muted-foreground">Parece que esta página no existe o fue movida.</p>
        <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-primary hover:opacity-90 transition-opacity">
          Volver al inicio
        </a>
      </div>
    </div>
  );
};

export default NotFound;
