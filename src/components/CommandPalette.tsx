// Global command palette (⌘K) inspired by Linear / Vercel.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  User,
  Users,
  PlusCircle,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface CourseHit {
  id: string;
  title: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<CourseHit[]>([]);
  const navigate = useNavigate();
  const { isAdmin, signOut, profile } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || !profile?.company_id) return;
    (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .eq("company_id", profile.company_id)
        .order("updated_at", { ascending: false })
        .limit(8);
      setCourses((data as CourseHit[]) ?? []);
    })();
  }, [open, profile?.company_id]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar o ejecutar acciones…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        <CommandGroup heading="Navegación">
          <CommandItem onSelect={() => go("/app")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/courses")}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Mis cursos</span>
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/leaderboard")}>
            <Trophy className="mr-2 h-4 w-4" />
            <span>Ranking</span>
            <CommandShortcut>G R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/profile")}>
            <User className="mr-2 h-4 w-4" />
            <span>Mi perfil</span>
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Administración">
              <CommandItem onSelect={() => go("/app/admin/courses")}>
                <BookOpen className="mr-2 h-4 w-4" />
                Gestionar cursos
              </CommandItem>
              <CommandItem onSelect={() => go("/app/admin/courses/new")}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear curso
              </CommandItem>
              <CommandItem onSelect={() => go("/app/admin/courses/generate")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generar curso con IA
              </CommandItem>
              <CommandItem onSelect={() => go("/app/admin/users")}>
                <Users className="mr-2 h-4 w-4" />
                Usuarios
              </CommandItem>
              <CommandItem onSelect={() => go("/app/admin/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {courses.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Cursos recientes">
              {courses.map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => go(isAdmin ? `/app/admin/courses/${c.id}` : `/app/courses/${c.id}`)}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  {c.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Cuenta">
          <CommandItem
            onSelect={async () => {
              setOpen(false);
              await signOut();
              navigate("/auth");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
