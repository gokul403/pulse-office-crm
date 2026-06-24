import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import api from "@/lib/api-client";

export type AppRole = "admin" | "manager" | "employee";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
}

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  login: (email: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  async function checkAuth() {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.get<{
        user: User;
        profile: Profile;
        roles: AppRole[];
      }>("/auth/me");

      setUser(data.user);
      setProfile(data.profile);
      setRoles(data.roles);
    } catch (err) {
      console.error("Auth check failed, clearing token", err);
      localStorage.removeItem("token");
      setUser(null);
      setProfile(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function login(email: string, password: string) {
    const data = await api.post<{
      token: string;
      user: User;
      profile: Profile;
      roles: AppRole[];
    }>("/auth/login", { email, password });

    localStorage.setItem("token", data.token);
    setUser(data.user);
    setProfile(data.profile);
    setRoles(data.roles);
  }

  async function signOut() {
    localStorage.removeItem("token");
    setUser(null);
    setProfile(null);
    setRoles([]);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        profile,
        roles,
        loading,
        isAdmin: roles.includes("admin"),
        isManager: roles.includes("manager"),
        isEmployee: roles.includes("employee"),
        login,
        refresh: checkAuth,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
