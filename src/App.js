import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import MasterData from "./pages/MasterData";
import AddBooking from "./pages/AddBooking";
import Entries from "./pages/Entries";
import MasterDataManager from "./pages/MasterDataManager";
import CompletedFiles from "./pages/CompletedFiles";
import BookingRequestForm from "./pages/BookingRequestForm";
import Dashboard from "./components/Dashboard";
import Login from "./pages/Login";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminPanel from "./pages/AdminPanel";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase"; // Adjust the import based on your file structure

function ProtectedRoute({ isLoggedIn, children, permissions, page }) {
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (permissions && !permissions.includes(page)) return <div>Access Denied</div>;
  return children;
}

function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("auth");
    return saved ? JSON.parse(saved) : { isLoggedIn: false, role: null, permissions: [] };
  });

  useEffect(() => {
    localStorage.setItem("auth", JSON.stringify(auth));
  }, [auth]);

  return (
    <Router>
      <div className="container-fluid">
        {/* Navbar */}
        {auth.isLoggedIn && (
          <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
            <div className="container-fluid">
              <Link className="navbar-brand" to="/">📊 Dashboard</Link>
              {/* Hamburger for mobile */}
              <button
                className="navbar-toggler"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#navbarNav"
                aria-controls="navbarNav"
                aria-expanded="false"
                aria-label="Toggle navigation"
              >
                <span className="navbar-toggler-icon"></span>
              </button>
              {/* Collapsible nav menu */}
              <div className="collapse navbar-collapse" id="navbarNav">
                <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                  {auth.permissions.includes("dashboard") && <li className="nav-item"><Link className="nav-link" to="/">Dashboard</Link></li>}
                  {auth.permissions.includes("addBooking") && <li className="nav-item"><Link className="nav-link" to="/booking">Add Booking Entry</Link></li>}
                  {auth.permissions.includes("entries") && <li className="nav-item"><Link className="nav-link" to="/entries">View Entries</Link></li>}
                  {auth.permissions.includes("completedFiles") && <li className="nav-item"><Link className="nav-link" to="/completed-files">Completed Files</Link></li>}
                  {auth.permissions.includes("master") && <li className="nav-item"><Link className="nav-link" to="/master">Add Master Data</Link></li>}
                  {auth.permissions.includes("manageMaster") && <li className="nav-item"><Link className="nav-link" to="/manage-master">Manage Master Data</Link></li>}
                  {auth.permissions.includes("bookingRequest") && <li className="nav-item"><Link className="nav-link" to="/booking-request">Booking Request Form</Link></li>}
                  {auth.role === "admin" && (
                    <li className="nav-item">
                      <Link className="nav-link" to="/admin-panel">Admin Panel</Link>
                    </li>
                  )}
                </ul>
                <span className="navbar-text text-white me-3 fw-bold" style={{ letterSpacing: 1 }}>
                  {auth.username}
                </span>
                <button className="btn btn-outline-light" onClick={async () => {
                  if (auth.id) {
                    await updateDoc(doc(db, "users", auth.id), { active: false });
                  }
                  setAuth({ isLoggedIn: false, role: null, permissions: [], username: null, id: null });
                }}>Logout</button>
              </div>
            </div>
          </nav>
        )}
        {/* Main Content Area */}
        <div className="container-fluid mt-4">
          <Routes>
            <Route path="/login" element={<Login setAuth={setAuth} />} />
            <Route path="/" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="/booking-request" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="bookingRequest"><BookingRequestForm /></ProtectedRoute>} />
            <Route path="/booking" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="addBooking"><AddBooking auth={auth} /></ProtectedRoute>} />
            <Route path="/entries" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="entries"><Entries auth={auth} /></ProtectedRoute>} />
            <Route path="/completed-files" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="completedFiles"><CompletedFiles /></ProtectedRoute>} />
            <Route path="/master" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="master"><MasterData /></ProtectedRoute>} />
            <Route path="/manage-master" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="manageMaster"><MasterDataManager /></ProtectedRoute>} />
            <Route path="/admin-panel" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="manageMaster"><AdminPanel /></ProtectedRoute>} />
          </Routes>
        </div>
        {/* Toast Notifications */}
        <ToastContainer position="bottom-right" autoClose={3000} />
      </div>
    </Router>
  );
}

export default App;