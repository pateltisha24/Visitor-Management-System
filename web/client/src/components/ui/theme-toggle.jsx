import { useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";

export const ThemeToggle = ({ className = "" }) => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      title={dark ? "Switch to light" : "Switch to dark"}
      className={`grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`}
    >
      {dark ? <FiSun size={17} /> : <FiMoon size={17} />}
    </button>
  );
};
