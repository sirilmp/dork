import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { Navbar } from './components/Navbar';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { AcceptInvitePage } from './auth/AcceptInvitePage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectBoardPage } from './pages/ProjectBoardPage';
import { BacklogPage } from './pages/BacklogPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      {children}
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <div className="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>
      </>
    );
  }

  return (
    <>
    <Toaster richColors position="top-right" />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/invite/:token" element={<AcceptInvitePage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <ProjectsListPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/board"
        element={
          <ProtectedRoute>
            <AppShell>
              <ProjectBoardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/backlog"
        element={
          <ProtectedRoute>
            <AppShell>
              <BacklogPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute adminOnly>
            <AppShell>
              <AdminSettingsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
