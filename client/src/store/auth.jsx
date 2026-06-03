import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../api";

export const AuthContext = createContext();

// Sentinel token for the offline fallback demo (used only if the API is unreachable).
export const DEMO_TOKEN = "demo-session";
const DEMO_USER = { organisation: "Demo Retail", email: "demo@facesense.app" };
// Shared, read-only demo account seeded in the DB — the demo logs into this so
// every feature works against real data.
const DEMO_CREDENTIALS = { email: "demo@facesense.app", password: "demo1234" };

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);

  // Derive directly from token so it updates synchronously with it (no lag that
  // would make ProtectedRoute bounce a fresh login back to /login).
  const isLoggedIn = !!token;
  const isOffline = token === DEMO_TOKEN;            // API unreachable → static sample
  const isDemo = isOffline || user?.email === DEMO_CREDENTIALS.email; // demo session (read-only)

  const storeTokenInLS = (serverToken) => {
    setToken(serverToken);
    localStorage.setItem("token", serverToken);
  };

  // One-click demo: log into the shared seeded demo account so all features work
  // against real data. Falls back to an offline sentinel session if the API is down.
  const enterDemo = async () => {
    try {
      const res = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(DEMO_CREDENTIALS) });
      if (res.ok) {
        const data = await res.json();
        storeTokenInLS(data.token);
        return true;
      }
    } catch (e) {
      /* fall through to offline demo */
    }
    setUser(DEMO_USER);
    storeTokenInLS(DEMO_TOKEN);
    return false;
  };

  const LogoutUser = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
  };

  // Validate the stored token and load the current user.
  const userAuthentication = async () => {
    if (token === DEMO_TOKEN) {
      setUser(DEMO_USER);
      return;
    }
    try {
      const response = await apiFetch("/api/auth/user", { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        setUser(data.userData);
      } else {
        LogoutUser();
      }
    } catch (error) {
      console.log("Error fetching user data:", error);
    }
  };

  useEffect(() => {
    if (token) userAuthentication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, isLoggedIn, isDemo, isOffline, storeTokenInLS, enterDemo, LogoutUser, user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const authContextValue = useContext(AuthContext);
  if (!authContextValue) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return authContextValue;
};
