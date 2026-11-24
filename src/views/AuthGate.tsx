import { SiteLanguageSwitch } from "../components/LanguageSwitch";
import { useLocale } from "../i18n/locale";
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
  const { t } = useLocale();
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
        setError(t("Не удалось проверить вход. Попробуйте войти снова.", "Couldn’t verify your session. Sign in again."));
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

  useEffect(() => {
    if (supabaseEnabled && !session && !offlineAccount) {
      document.title = GUEST_TABS.includes(tab) ? t("Кодекс — Достать листы!", "Codex — Dostat Listy!")
        : t("Вход — Достать листы!", "Sign in — Dostat Listy!");
    }
  }, [tab, session, offlineAccount, t]);

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
        setMessage(t("Проверьте почту и подтвердите адрес, чтобы войти.", "Check your email and confirm your address to sign in."));
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Не удалось выполнить вход", "Couldn’t sign in"),
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
          : t("Не удалось выйти. Попробуйте снова.", "Couldn’t sign out. Try again."),
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
  if (loading && !user) return <LoadingScreen label={t("Проверяем вход…", "Checking sign-in…")} hint={t("Подключаемся к вашим героям", "Connecting to your heroes")} />;

  if (!user && GUEST_TABS.includes(tab)) {
    return <GuestApp tab={tab} onSignIn={() => setTab("sheet")} />;
  }

  if (!user) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={submit}>
          <SiteLanguageSwitch />
          <SiteLogo variant="mark" className="auth-logo" />
          <p className="auth-kicker">{t("ДОСТАТЬ ЛИСТЫ!", "DOSTAT LISTY!")}</p>
          <h1>{signUp ? t("Создать аккаунт", "Create an account") : t("Вход в Достать листы!", "Sign in to Dostat Listy!")}</h1>
          <p className="auth-copy">
            {t("Листы персонажей для Draw Steel: бои, ресурсы, способности и правила под рукой.", "Track combat, resources, and abilities on your Draw Steel character sheet, with the rules close at hand.")}{" "}
            {signUp
              ? t("Создайте аккаунт, чтобы хранить героев.", "Create an account to save your heroes.")
              : t("Войдите, чтобы вернуться к своим героям.", "Sign in to return to your heroes.")}
          </p>
          <label htmlFor="auth-email">{t("Электронная почта", "Email")}</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="auth-password">{t("Пароль", "Password")}</label>
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
          <Button className="auth-password-toggle" icon={showPassword ? "eye-off" : "eye"} iconOnly variant="ghost" aria-label={showPassword ? t("Скрыть пароль", "Hide password") : t("Показать пароль", "Show password")} aria-pressed={showPassword} aria-controls="auth-password" onClick={() => setShowPassword(!showPassword)} />
          </div>
          {signUp && <p id="auth-password-hint" className="muted small">{t("Не менее 8 символов", "At least 8 characters")}</p>}
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
              ? t("Подождите…", "Please wait…")
              : signUp
                ? t("Зарегистрироваться", "Sign up")
                : t("Войти", "Sign in")}
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
            {signUp ? t("Уже есть аккаунт? Войти", "Already have an account? Sign in") : t("Создать аккаунт", "Create an account")}
          </button>
          <button
            className="auth-switch"
            type="button"
            onClick={() => setTab("codex")}
          >
            {t("Смотреть Кодекс без входа", "Browse the Codex as a guest")}
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
