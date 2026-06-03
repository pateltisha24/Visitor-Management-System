import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { FiShield, FiZap, FiBarChart2 } from "react-icons/fi";

const points = [
  { icon: FiZap, text: "Real-time age, gender & sentiment" },
  { icon: FiBarChart2, text: "Live, aggregated dashboards" },
  { icon: FiShield, text: "Anonymous — no faces ever stored" },
];

export const AuthLayout = ({ eyebrow, title, subtitle, children }) => {
  return (
    <main className="container grid min-h-[calc(100vh-4rem)] items-center gap-12 py-10 lg:grid-cols-2 lg:gap-20">
      {/* Form side */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-md"
      >
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </motion.div>

      {/* Brand / visual side */}
      <div className="relative hidden overflow-hidden rounded-3xl bg-foreground p-12 text-background lg:block">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 dotted opacity-10" />
        <div className="relative flex h-full flex-col justify-between">
          <NavLink to="/" className="font-display text-2xl font-bold">
            Face<span className="text-primary">Sense</span>
          </NavLink>

          <div>
            <p className="font-display text-3xl font-semibold leading-tight tracking-tight">
              Read the room,<br /> in real time.
            </p>
            <ul className="mt-8 space-y-4">
              {points.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-background/80">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-background/10 text-primary">
                    <p.icon size={16} />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-background/50">Visitor intelligence for physical spaces.</p>
        </div>
      </div>
    </main>
  );
};
