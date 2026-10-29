import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FiPlay } from "react-icons/fi";
import { useAuth } from "../store/auth";
import { Button } from "./ui/button";

// The one way into the demo, wherever it's offered: signs into the shared,
// read-only demo account and opens its sample dashboard, with no sign-up. It
// only ever means the demo, so it's hidden from someone signed into their own
// account (their dashboard is in the account menu).
//   onDone: runs before navigating (e.g. to close the mobile menu)
export const DemoButton = ({ children, onDone, ...props }) => {
  const { isLoggedIn, isDemo, enterDemo } = useAuth();
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

  if (isLoggedIn && !isDemo) return null;
  return (
    <Button {...props} onClick={open} disabled={opening}>
      {opening ? "Opening the demo…" : children || <><FiPlay /> Explore the live demo</>}
    </Button>
  );
};
