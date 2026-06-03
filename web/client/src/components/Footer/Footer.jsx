import { NavLink } from "react-router-dom";
import { FiMail, FiPhone } from "react-icons/fi";
import { useAuth } from "../../store/auth";

const navGroups = [
  {
    title: "Product",
    links: [
      { to: "/", label: "Home" },
      { to: "/about", label: "About" },
      { to: "/privacy", label: "Privacy" },
    ],
  },
  {
    title: "Account",
    links: [
      { to: "/register", label: "Register" },
      { to: "/login", label: "Log in" },
      { to: "/contact", label: "Contact" },
    ],
  },
];

export const Footer = () => {
  const { isLoggedIn } = useAuth();
  // The footer is marketing chrome — hide it in the app for logged-in users (demo included).
  if (isLoggedIn) return null;

  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="container py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <span className="font-display text-2xl font-bold tracking-tight">
              Face<span className="text-primary">Sense</span>
            </span>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Real-time visitor intelligence for physical spaces — age, gender and
              sentiment, decoded from any camera and turned into decisions.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5"><FiPhone className="text-primary" /> +1 (857) 399-5023</li>
              <li className="flex items-center gap-2.5"><FiMail className="text-primary" /> pateltisha24@gmail.com</li>
            </ul>
          </div>

          {navGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.title}</h4>
              <ul className="mt-4 space-y-3">
                {group.links.map((l) => (
                  <li key={l.to}>
                    <NavLink to={l.to} className="text-sm text-foreground/80 transition-colors hover:text-primary">
                      {l.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} FaceSense · Built at Stat Modeller</p>
          <p className="text-xs">Anonymous analytics · no faces stored</p>
        </div>
      </div>
    </footer>
  );
};
