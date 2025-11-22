import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-accent-green mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login page
  if (!isAuthenticated) {
    // Save the attempted location to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
