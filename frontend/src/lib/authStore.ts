"use client";

import { bindDomainStores, clearDomainCaches } from "@/lib/domainCaches";

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  business_type: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
};

const TOKEN_KEY = "kpm_auth_token";
const USER_KEY = "kpm_auth_user";

type Listener = (state: AuthState) => void;

class AuthStore {
  private state: AuthState = { token: null, user: null, hydrated: false };
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const rawUser = localStorage.getItem(USER_KEY);
        const user = rawUser ? (JSON.parse(rawUser) as AuthUser) : null;
        this.state = { token, user, hydrated: true };
      } catch {
        this.state = { token: null, user: null, hydrated: true };
      }
    }
  }

  public getState() {
    return this.state;
  }

  public getToken() {
    return this.state.token;
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  public setSession(token: string, user: AuthUser) {
    const previousId = this.state.user?.id;
    this.state = { token, user, hydrated: true };
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    if (previousId !== user.id) {
      clearDomainCaches();
    }
    bindDomainStores(user.id);
    this.notify();
  }

  public clearSession() {
    this.state = { token: null, user: null, hydrated: true };
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    clearDomainCaches();
    this.notify();
  }

  public updateUser(user: AuthUser) {
    this.state = { ...this.state, user, hydrated: true };
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    this.notify();
  }
}

export const authStore = new AuthStore();
