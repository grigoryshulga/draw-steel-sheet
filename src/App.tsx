import { lazy, Suspense, useRef } from "react";
import { LoadingScreen } from "./components/Topbar";
import { ViewErrorBoundary } from "./components/ViewErrorBoundary";
import { AuthGate } from "./views/AuthGate";

// Public reading and sign-in do not need hero calculations or editing data.
const WorkspaceApp = lazy(() => import("./WorkspaceApp"));

export default function App() {
  const beforeSignOut = useRef<() => Promise<void>>(async () => undefined);
  return (
    <AuthGate beforeSignOut={() => beforeSignOut.current()}>
      <ViewErrorBoundary>
        <Suspense fallback={<LoadingScreen label="Загрузка листа" />}>
          <WorkspaceApp beforeSignOut={beforeSignOut} />
        </Suspense>
      </ViewErrorBoundary>
    </AuthGate>
  );
}
