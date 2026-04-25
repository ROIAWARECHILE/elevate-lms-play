import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "collaborator";

interface Profile {
  id: string;
  company_id: string | null;
  full_name: string;
  avatar_url: string | null;
  job_title: string;
  department: string;
  xp_total: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  level: number;
  status: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isPending: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  isAdmin: false,
  isPending: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

const PROFILE_RETRY_DELAYS = [0, 350];

function getLocalDate(date?: Date): string {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function validateStreak(profile: Profile): Promise<Profile> {
  const lastActivity = profile.last_activity_date;
  if (!lastActivity || profile.current_streak === 0) return profile;

  const today = getLocalDate();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterday);

  if (lastActivity === today || lastActivity === yesterdayStr) {
    return profile;
  }

  await supabase
    .from("profiles")
    .update({ current_streak: 0 })
    .eq("id", profile.id);

  return { ...profile, current_streak: 0 };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const profileRequestId = useRef(0);

  const loadProfile = useCallback(async (currentUser: User) => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < PROFILE_RETRY_DELAYS.length; attempt += 1) {
      const delay = PROFILE_RETRY_DELAYS[attempt];
      if (delay > 0) await wait(delay);

      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", currentUser.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", currentUser.id),
      ]);

      if (rolesRes.error) {
        lastError = rolesRes.error;
      }

      if (profileRes.error) {
        lastError = profileRes.error;
      }

      if (profileRes.data) {
        const validated = await validateStreak(profileRes.data as Profile);
        return {
          profile: validated,
          roles: (rolesRes.data ?? []).map((r: any) => r.role as AppRole),
        };
      }

      // Defensive recovery for accounts created while the profile trigger was delayed or unavailable.
      // The RPC is SECURITY DEFINER and keeps roles in public.user_roles, never on profiles.
      if (attempt === 0) {
        try {
          await (supabase.rpc as any)("ensure_user_profile", {
            _full_name: currentUser.user_metadata?.full_name ?? currentUser.email ?? "",
          });
        } catch (error) {
          lastError = error;
        }
      }
    }

    if (lastError) {
      console.error("Unable to load auth profile", lastError);
    }

    return { profile: null, roles: [] as AppRole[] };
  }, []);

  useEffect(() => {
    let mounted = true;

    // Supabase best practice: register the listener first and do not await Supabase
    // queries inside the auth callback. Profile loading is handled in a separate effect.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((error) => {
        console.error("Unable to restore auth session", error);
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) {
      setLoading(true);
      return;
    }

    if (!user) {
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const requestId = profileRequestId.current + 1;
    profileRequestId.current = requestId;
    setLoading(true);

    loadProfile(user)
      .then(({ profile: nextProfile, roles: nextRoles }) => {
        if (cancelled || profileRequestId.current !== requestId) return;
        setProfile(nextProfile);
        setRoles(nextRoles);
      })
      .finally(() => {
        if (!cancelled && profileRequestId.current === requestId) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, user?.id, loadProfile]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const requestId = profileRequestId.current + 1;
    profileRequestId.current = requestId;
    setLoading(true);
    const { profile: nextProfile, roles: nextRoles } = await loadProfile(user);
    if (profileRequestId.current === requestId) {
      setProfile(nextProfile);
      setRoles(nextRoles);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isAdmin: roles.includes("admin"),
        isPending: profile?.status === "pending",
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
