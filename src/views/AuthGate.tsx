import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { StorageScope } from "../state/StorageScope";

export function AuthGate({
  children,
  beforeSignOut,
}: {
  children: ReactNode;
  beforeSignOut?: () => Promise<void>;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Не удалось проверить вход. Попробуйте войти снова.");
        setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!supabaseEnabled || !supabase) return children;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const result = signUp
        ? await supabase!.auth.signUp({ email, password })
        : await supabase!.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signUp && !result.data.session) {
        setMessage("Проверьте почту и подтвердите адрес, чтобы войти.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось выполнить вход",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading-screen">Проверяем вход…</div>;

  if (!session) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={submit}>
          <p className="auth-kicker">ДОСТАТЬ ЛИСТЫ!</p>
          <h1>{signUp ? "Создать аккаунт" : "Войти"}</h1>
          <p className="auth-copy">
            Войдите, чтобы хранить листы героев в своём аккаунте.
          </p>
          <label htmlFor="auth-email">Электронная почта</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="auth-password">Пароль</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={signUp ? "new-password" : "current-password"}
            minLength={signUp ? 8 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? "Подождите…"
              : signUp
                ? "Зарегистрироваться"
                : "Войти"}
          </button>
          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setSignUp((value) => !value);
              setError("");
              setMessage("");
            }}
          >
            {signUp ? "Уже есть аккаунт? Войти" : "Создать аккаунт"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="auth-account-bar">
        <span>{session.user.email}</span>
        {error && <span role="alert">{error}</span>}
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            setError("");
            try {
              await beforeSignOut?.();
              const result = await supabase!.auth.signOut();
              if (result.error) throw result.error;
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Не удалось выйти. Попробуйте снова.",
              );
            } finally {
              setSigningOut(false);
            }
          }}
        >
          {signingOut ? "Выходим…" : "Выйти"}
        </button>
      </div>
      <StorageScope.Provider key={session.user.id} value={session.user.id}>
        <div inert={signingOut}>{children}</div>
      </StorageScope.Provider>
    </>
  );
}
