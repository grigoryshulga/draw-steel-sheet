import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { AccountContext, StorageScope } from "../state/StorageScope";
import { SiteLogo } from "../components/SiteLogo";
import { LoadingScreen } from "../components/Topbar";
import { Button } from "../components/ui";
import { useHashTab } from "../lib/hooks";
import { TABS } from "../navigation";
import { GUEST_TABS, GuestApp } from "./GuestApp";
import { readOfflineAccount, rememberOfflineAccount } from "../lib/offline-account";

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
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pendingSignOut, setPendingSignOut] = useState<{ localError: string } | null>(null);
  const [offlineAccount, setOfflineAccount] = useState(() => readOfflineAccount(navigator.onLine));
  const [tab, setTab] = useHashTab("sheet", TABS);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const connectivity = () => {
      setOfflineAccount(readOfflineAccount(navigator.onLine));
      if (navigator.onLine) void supabase!.auth.getSession().then(({ data }) => {
        if (active) { setSession(data.session); setLoading(false); }
      }).catch(() => { if (active) setLoading(false); });
    };
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
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
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession) rememberOfflineAccount({ id: nextSession.user.id, email: nextSession.user.email ?? "" });
      else if (event === "SIGNED_OUT") { rememberOfflineAccount(null); setOfflineAccount(null); }
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
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
      const result = await supabase!.auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      rememberOfflineAccount(null);
      setOfflineAccount(null);
      setPendingSignOut(null);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "PendingHeroEditsError") {
        setPendingSignOut({ localError: "localError" in cause ? String(cause.localError) : "" });
        return;
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось выйти. Попробуйте снова.",
      );
    } finally {
      setSigningOut(false);
    }
  }

  // Public reading does not depend on the session request completing. Authenticated
  // character controls still wait for the normal session boundary below.
  const user = session?.user ?? offlineAccount;
  if (loading && !user && GUEST_TABS.includes(tab)) {
    return <GuestApp tab={tab} onSignIn={() => setTab("sheet")} />;
  }
  if (loading && !user) return <LoadingScreen label="Проверяем вход…" hint="Подключаемся к вашим героям" />;

  if (!user && GUEST_TABS.includes(tab)) {
    return <GuestApp tab={tab} onSignIn={() => setTab("sheet")} />;
  }

  if (!user) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={submit}>
          <SiteLogo variant="mark" className="auth-logo" />
          <p className="auth-kicker">ДОСТАТЬ ЛИСТЫ!</p>
          <h1>{signUp ? "Создать аккаунт" : "Вход в Достать листы!"}</h1>
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
          <div className="auth-password-field">
          <input
            id="auth-password"
            type={showPassword ? "text" : "password"}
            aria-describedby={signUp ? "auth-password-hint" : undefined}
            autoComplete={signUp ? "new-password" : "current-password"}
            minLength={signUp ? 8 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button className="auth-password-toggle" icon={showPassword ? "eye-off" : "eye"} iconOnly variant="ghost" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} aria-pressed={showPassword} aria-controls="auth-password" onClick={() => setShowPassword(!showPassword)} />
          </div>
          {signUp && <p id="auth-password-hint" className="muted small">Не менее 8 символов</p>}
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
              setShowPassword(false);
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
      <StorageScope.Provider key={user.id} value={user.id}>
        <AccountContext.Provider
          value={{
            email: user.email ?? "",
            signingOut,
            signOut: () => void signOut(),
            pendingSignOut,
            cancelSignOut: () => setPendingSignOut(null),
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
