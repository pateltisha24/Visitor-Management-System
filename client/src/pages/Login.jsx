import { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";
import { apiFetch } from "../api";
import { toast } from "react-toastify";
import { FiArrowRight, FiLock } from "react-icons/fi";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/button";
import { Input, Label } from "../components/ui/input";

export const Login = () => {
  const [user, setUser] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { storeTokenInLS } = useAuth();

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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <FiLock className="mr-1 inline -translate-y-px" size={12} />
        New here?{" "}
        <NavLink to="/register" className="font-medium text-primary hover:underline">Create an account</NavLink>
      </p>
    </AuthLayout>
  );
};
