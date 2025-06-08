import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import MasterData from "./pages/MasterData";
import AddBooking from "./pages/AddBooking";
import Entries from "./pages/Entries";
import MasterDataManager from "./pages/MasterDataManager";
import CompletedFiles from "./pages/CompletedFiles";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <Router>
      <div className="container-fluid">
        {/* Navbar */}
        <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
          <div className="container-fluid">
            <Link className="navbar-brand" to="/">Dashboard</Link>

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
                <li className="nav-item">
                  <Link className="nav-link" to="/master">Add Master Data</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/booking">Add Booking Entry</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/entries">View Entries</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/manage-master">Manage Master Data</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/completed-files">Completed Files</Link>
                </li>
              </ul>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="container mt-4">
          <Routes>
            <Route path="/" element={<h2>Welcome to the Dashboard! Please select an option from the menu.</h2>} />
            <Route path="/master" element={<MasterData />} />
            <Route path="/booking" element={<AddBooking />} />
            <Route path="/entries" element={<Entries />} />
            <Route path="/manage-master" element={<MasterDataManager />} />
            <Route path="/completed-files" element={<CompletedFiles />} />
          </Routes>
        </div>

        {/* Toast Notifications */}
        <ToastContainer position="bottom-right" autoClose={3000} />
      </div>
    </Router>
  );
}

export default App;
