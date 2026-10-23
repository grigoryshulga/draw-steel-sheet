import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { AccountContext, StorageScope } from "../state/StorageScope";
import { SiteLogo } from "../components/SiteLogo";
import { useHashTab } from "../lib/hooks";
import { TABS } from "../navigation";
import { GUEST_TABS, GuestApp } from "./GuestApp";

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
  const [tab, setTab] = useHashTab("sheet", TABS);

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

  async function signOut() {
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
  }

  if (loading) return <div className="loading-screen">Проверяем вход…</div>;

  if (!session && GUEST_TABS.includes(tab)) {
    return <GuestApp tab={tab} onSignIn={() => setTab("sheet")} />;
  }

  if (!session) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={submit}>
          <SiteLogo variant="mark" className="auth-logo" />
          <p className="auth-kicker">ДОСТАТЬ ЛИСТЫ!</p>
          <h1>Добро пожаловать, герой!</h1>
          <p className="auth-copy">
            Листы персонажей для Draw Steel на русском: бои, ресурсы,
            способности и правила под рукой.{" "}
            {signUp
              ? "Создайте аккаунт, чтобы хранить героев."
              : "Войдите, чтобы вернуться к своим героям."}
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
          <button
            className="auth-switch"
            type="button"
            onClick={() => setTab("codex")}
          >
            Смотреть Кодекс без входа
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      <StorageScope.Provider key={session.user.id} value={session.user.id}>
        <AccountContext.Provider
          value={{
            email: session.user.email ?? "",
            signingOut,
            signOut: () => void signOut(),
          }}
        >
          {error && (
            <p className="auth-account-error" role="alert">
              {error}
            </p>
          )}
          <div inert={signingOut}>{children}</div>
        </AccountContext.Provider>
      </StorageScope.Provider>
    </>
  );
}
