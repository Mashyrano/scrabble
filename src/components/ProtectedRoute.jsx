import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback /> }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return fallback;
  }

  if (!isAuthenticated) {
    // Come back here after logging in, so a shared table link still works.
    const here = location.pathname + location.search;
    const query = here !== '/' ? '?returnTo=' + encodeURIComponent(here) : '';
    return <Navigate to={'/login' + query} replace />;
  }

  return <Outlet />;
}
