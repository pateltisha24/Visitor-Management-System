
import { NavLink } from "react-router-dom";
import "./Navbar.css";
import { useAuth } from "../store/auth";

export const Navbar = () => {
  const { isLoggedIn } = useAuth();

  return (
    <>
      <header>
        <div className="container1">
          <div className="logo">
          <NavLink to="/">
            <img src="/images/facesense_logonew.png" alt="" />
            </NavLink>
          </div>
         
          <nav>
            <ul>
              <li>
                <NavLink to="/"> Home </NavLink>
              </li>
              <li>
                <NavLink to="/about"> About </NavLink>
              </li>
              <li>
                <NavLink to="/contact"> Contact </NavLink>
              </li>
              {isLoggedIn ? (
                <>  
                  <li>
                    <NavLink to="/service"> Dashboard </NavLink>
                  </li>
                  <li>
                    <NavLink to="/logout"> Logout </NavLink>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <NavLink to="/register"> Register </NavLink>
                  </li>
                  <li>
                    <NavLink to="/login"> Login </NavLink>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
};
