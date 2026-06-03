import { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";
import { apiFetch } from "../api";
import { toast } from "react-toastify";
import { FiArrowRight } from "react-icons/fi";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/button";
import { Input, Label } from "../components/ui/input";

export const Register = () => {
  const [user, setUser] = useState({ organisation: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { storeTokenInLS } = useAuth();

  const handleInput = (e) => setUser({ ...user, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(user),
      });
      const res_data = await response.json();
      if (response.ok) {
        storeTokenInLS(res_data.token);
        setUser({ organisation: "", email: "", password: "" });
        toast.success("Account created — welcome aboard");
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
      eyebrow="Get started"
      title="Create your account"
      subtitle="Set up your workspace and connect your first camera."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="organisation">Organisation</Label>
          <Input id="organisation" name="organisation" placeholder="Acme Retail"
            required value={user.organisation} onChange={handleInput} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@company.com"
            autoComplete="email" required value={user.email} onChange={handleInput} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="at least 6 characters"
            autoComplete="new-password" required value={user.password} onChange={handleInput} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Creating account…" : <>Create account <FiArrowRight /></>}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <NavLink to="/login" className="font-medium text-primary hover:underline">Log in</NavLink>
      </p>
    </AuthLayout>
  );
};
