

import React, { createContext, useContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);
  const [user,setUser] = useState("");

  useEffect(() => {
    setIsLoggedIn(!!token);
  }, [token]);

  const storeTokenInLS = (serverToken) => {
    setToken(serverToken);
    localStorage.setItem("token", serverToken);
    
  };

  const LogoutUser = () => {
    setToken("");
    localStorage.removeItem("token");
  };
 //jwt authuntication

//  const userAuthentication = async () =>{
//   try {
//     const response = await fetch("http://localhost:5000/api/auth/user",{
//       methods :"GET",
//       // headers:{
//       //   Authorization:`Bearer ${token}`,
//       // },
//       credentials: 'include',
//     });

//     if(response.ok){
//      const data = await response.json(); 
//      console.log("user data ",data.userData);
//      setUser(data.userData);
//     }
    
//   } catch (error) {
//     console.log("Error fetching user data:", error);
//   }
//  };

//  useEffect(() => {
//   if(token){
//     userAuthentication();
//   }

//  }, []);
  return (
    <AuthContext.Provider value={{ isLoggedIn, storeTokenInLS, LogoutUser ,user}}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const authContextValue = useContext(AuthContext);
  if (!authContextValue) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return authContextValue;
};
