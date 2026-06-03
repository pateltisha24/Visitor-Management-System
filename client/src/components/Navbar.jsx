import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FiMenu, FiX, FiArrowUpRight, FiPlay, FiSettings, FiLogOut, FiGrid, FiVideo, FiChevronDown } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../store/auth";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ui/theme-toggle";
import { cn } from "../lib/utils";

const Brand = () => (
  <NavLink to="/" className="flex items-center gap-2.5 group">
    <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-foreground text-background">
      <span className="absolute h-1.5 w-1.5 rounded-full bg-primary -translate-x-[6px] -translate-y-[3px]" />
      <span className="absolute h-1.5 w-1.5 rounded-full bg-background translate-x-[6px] -translate-y-[3px]" />
      <span className="absolute bottom-2 h-[6px] w-3.5 rounded-b-full border-b-2 border-background" />
    </span>
    <span className="font-display text-xl font-bold tracking-tight">
      Face<span className="text-primary">Sense</span>
    </span>
  </NavLink>
);

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

const AccountMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const initials = (user?.organisation || user?.email || "U").slice(0, 2).toUpperCase();

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 transition-colors hover:bg-secondary"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials}</span>
        <FiChevronDown size={14} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lift">
          <div className="border-b border-border px-4 py-3">
            <div className="truncate text-sm font-medium">{user?.organisation || "Account"}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <nav className="p-1.5">
            <MenuItem to="/service" icon={FiGrid} label="Dashboard" onClick={() => setOpen(false)} />
            <MenuItem to="/connect" icon={FiVideo} label="Connect camera" onClick={() => setOpen(false)} />
            <MenuItem to="/settings" icon={FiSettings} label="Settings" onClick={() => setOpen(false)} />
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
            >
              <FiLogOut size={15} className="text-muted-foreground" /> Log out
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

const MenuItem = ({ to, icon: Icon, label, onClick }) => (
  <NavLink to={to} onClick={onClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary">
    <Icon size={15} className="text-muted-foreground" /> {label}
  </NavLink>
);

export const Navbar = () => {
  const { isLoggedIn, enterDemo, user, LogoutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleDemo = async () => {
    await enterDemo();
    setOpen(false);
    toast.success("Welcome to the FaceSense demo");
    navigate("/service");
  };

  const handleLogout = () => {
    LogoutUser();
    setOpen(false);
    toast.success("Logged out");
    navigate("/login");
  };

  const navItem = ({ isActive }) =>
    cn(
      "relative text-sm font-medium transition-colors hover:text-foreground",
      isActive ? "text-foreground" : "text-muted-foreground"
    );

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="relative flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Brand />

        {!isLoggedIn && (
          <nav className="hidden items-center gap-8 md:absolute md:left-1/2 md:top-1/2 md:flex md:-translate-x-1/2 md:-translate-y-1/2">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navItem}>
                {({ isActive }) => (
                  <span className="relative">
                    {l.label}
                    {isActive && <span className="absolute -bottom-1.5 left-0 h-0.5 w-full rounded-full bg-primary" />}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="hidden items-center gap-3 md:flex">
          {!isLoggedIn && (
            <Button variant="ghost" size="sm" onClick={handleDemo}>
              <FiPlay /> Live demo
            </Button>
          )}
          <ThemeToggle />
          {isLoggedIn ? (
            <AccountMenu user={user} onLogout={handleLogout} />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <NavLink to="/login">Log in</NavLink>
              </Button>
              <Button asChild size="sm">
                <NavLink to="/register">Get started <FiArrowUpRight /></NavLink>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            className="grid h-10 w-10 place-items-center rounded-lg hover:bg-secondary"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/70 bg-background md:hidden">
          <div className="flex flex-col gap-1 px-4 py-4">
            {!isLoggedIn && links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
                {l.label}
              </NavLink>
            ))}
            {isLoggedIn && (
              <NavLink to="/settings" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">Settings</NavLink>
            )}
            {!isLoggedIn && (
              <Button variant="outline" className="mt-2 w-full" onClick={handleDemo}>
                <FiPlay /> Live demo
              </Button>
            )}
            <div className="mt-2 flex gap-2">
              {isLoggedIn ? (
                <Button variant="outline" className="flex-1" onClick={handleLogout}><FiLogOut /> Log out</Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="flex-1"><NavLink to="/login" onClick={() => setOpen(false)}>Log in</NavLink></Button>
                  <Button asChild className="flex-1"><NavLink to="/register" onClick={() => setOpen(false)}>Get started</NavLink></Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
