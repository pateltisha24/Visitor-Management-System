import { NavLink } from "react-router-dom";
import { FiArrowLeft, FiAlertCircle } from "react-icons/fi";
import { Button } from "../components/ui/button";

export const Error = () => {
  return (
    <main className="container grid min-h-[calc(100vh-4rem)] place-items-center py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <FiAlertCircle size={26} />
        </div>
        <h1 className="mt-6 font-display text-7xl font-bold tracking-tight">404</h1>
        <h2 className="mt-2 text-xl font-semibold">Page not found</h2>
        <p className="mt-3 text-muted-foreground">
          The page you're looking for doesn't exist or has moved. Let's get you back on track.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild><NavLink to="/"><FiArrowLeft /> Return home</NavLink></Button>
          <Button asChild variant="outline"><NavLink to="/contact">Report a problem</NavLink></Button>
        </div>
      </div>
    </main>
  );
};
