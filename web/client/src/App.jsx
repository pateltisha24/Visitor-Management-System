import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React, { Suspense, lazy } from "react";
import { ToastContainer } from "react-toastify";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer/Footer";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Lazy-load route components so heavy deps (recharts, framer-motion) ship in
// their own chunks instead of the initial bundle.
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const About = lazy(() => import("./pages/About").then((m) => ({ default: m.About })));
const Contact = lazy(() => import("./pages/Contact").then((m) => ({ default: m.Contact })));
const Service = lazy(() => import("./pages/Service"));
const Settings = lazy(() => import("./pages/Settings"));
const Connect = lazy(() => import("./pages/Connect"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Logout = lazy(() => import("./pages/Logout").then((m) => ({ default: m.Logout })));
const ErrorPage = lazy(() => import("./pages/Error").then((m) => ({ default: m.Error })));

const PageFallback = () => (
  <div className="grid min-h-[60vh] place-items-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
  </div>
);

const App = () => {
  return (
    <Router>
      <Navbar />
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover theme="colored" />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/service" element={<ProtectedRoute><Service /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/connect" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </Suspense>
      <Footer />
    </Router>
  );
};

export default App;
