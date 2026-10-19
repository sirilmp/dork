import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { AcceptInvitePage } from './auth/AcceptInvitePage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { HomePage } from './pages/HomePage';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectBoardPage } from './pages/ProjectBoardPage';
import { BacklogPage } from './pages/BacklogPage';
import { ProjectSettingsPage } from './pages/ProjectSettingsPage';
import { TeamsPage } from './pages/TeamsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

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
            <Layout>
              <HomePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectsListPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/board"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectBoardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/backlog"
        element={
          <ProtectedRoute>
            <Layout>
              <BacklogPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectSettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teams"
        element={
          <ProtectedRoute>
            <Layout>
              <TeamsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute adminOnly>
            <Layout>
              <AdminSettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
