// Stage 1G-B · LoginForm.
//
// Email/password + Google sign-in built on top of AuthContext. Does not
// touch the Supabase client directly. When env vars are missing, renders
// a muted disabled state pointing to Lovable Cloud setup.

import { useState, type FormEvent } from "react";
import { AlertCircle, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/use-auth";
import { isSupabaseConfigured } from "@/lib/supabase-client";

const UNCONFIGURED_COPY = "Подключите Lovable Cloud для входа";

export interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { status, signInWithPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const configured = isSupabaseConfigured();
  const loading = status === "loading";
  const disabled = loading || submitting || !configured;

  if (!configured) {
    return (
      <div
        data-testid="login-form-unconfigured"
        className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-[12px] text-muted-foreground"
      >
        {UNCONFIGURED_COPY}
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await signInWithPassword(email, password);
      if (err) {
        setError(err.message || "Не удалось войти");
        return;
      }
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) setError(err.message || "Не удалось войти через Google");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit} aria-label="Форма входа">
      <div className="space-y-1.5">
        <Label htmlFor="login-email" className="text-[12px]">
          Email
        </Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          disabled={disabled}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-password" className="text-[12px]">
          Пароль
        </Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          disabled={disabled}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={disabled} className="sm:flex-1">
          <LogIn className="h-4 w-4" aria-hidden />
          {submitting ? "Вход…" : "Войти"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={handleGoogle}
          className="sm:flex-1"
        >
          Войти через Google
        </Button>
      </div>
    </form>
  );
}
