import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectBoardPage } from './pages/ProjectBoardPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      {children}
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
  );
}
