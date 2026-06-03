import { Navigate } from "react-router-dom";
import { useAuth } from "../store/auth";

// Guards routes that require authentication. Redirects to /login when there is
// no token in context.
export const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
};

export default ProtectedRoute;
