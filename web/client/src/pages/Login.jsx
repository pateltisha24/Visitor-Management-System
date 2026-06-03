import { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";
import { apiFetch } from "../api";
import { toast } from "react-toastify";
import { FiArrowRight, FiLock, FiPlay } from "react-icons/fi";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/button";
import { Input, Label } from "../components/ui/input";

export const Login = () => {
  const [user, setUser] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { storeTokenInLS, enterDemo } = useAuth();

  const handleDemo = async () => {
    await enterDemo();
    toast.success("Welcome to the FaceSense demo");
    navigate("/service");
  };

  const handleInput = (e) => setUser({ ...user, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch(`/api/auth/login`, {
        method: "POST",
        body: JSON.stringify(user),
      });
      const res_data = await response.json();
      if (response.ok) {
        storeTokenInLS(res_data.token);
        setUser({ email: "", password: "" });
        toast.success("Welcome back");
        navigate("/service");
      } else {
        toast.error(res_data.extraDetails ? res_data.extraDetails : res_data.message);
      }
    } catch (error) {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Log in to your dashboard"
      subtitle="See live visitor analytics for your spaces."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@company.com"
            autoComplete="email" required value={user.email} onChange={handleInput} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••"
            autoComplete="current-password" required value={user.password} onChange={handleInput} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : <>Log in <FiArrowRight /></>}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="outline" size="lg" className="w-full" onClick={handleDemo}>
        <FiPlay /> Explore the live demo
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">No sign-up — jump straight into a sample dashboard.</p>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <FiLock className="mr-1 inline -translate-y-px" size={12} />
        New here?{" "}
        <NavLink to="/register" className="font-medium text-primary hover:underline">Create an account</NavLink>
      </p>
    </AuthLayout>
  );
};
