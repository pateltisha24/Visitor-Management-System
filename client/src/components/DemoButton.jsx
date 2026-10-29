import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FiGrid, FiPlay } from "react-icons/fi";
import { useAuth } from "../store/auth";
import { Button } from "./ui/button";

// The one way into the demo, wherever it's offered: signs into the shared,
// read-only demo account and opens the dashboard, with no sign-up. Someone
// already signed in goes straight to their own dashboard instead.
//   onDone: runs before navigating (e.g. to close the mobile menu)
export const DemoButton = ({ children, onDone, ...props }) => {
  const { isLoggedIn, enterDemo } = useAuth();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  const open = async () => {
    if (!isLoggedIn) {
      setOpening(true);
      try {
        await enterDemo();
        toast.success("Welcome to the FaceSense demo");
      } finally {
        setOpening(false);
      }
    }
    onDone?.();
    navigate("/service");
  };

  const label = isLoggedIn ? <><FiGrid /> Open your dashboard</> : children || <><FiPlay /> Explore the live demo</>;
  return (
    <Button {...props} onClick={open} disabled={opening}>
      {opening ? "Opening the demo…" : label}
    </Button>
  );
};
