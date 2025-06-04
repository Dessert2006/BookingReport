import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import MasterData from "./pages/MasterData";
import AddBooking from "./pages/AddBooking";
import Entries from "./pages/Entries";
import MasterDataManager from "./pages/MasterDataManager"; // ⬅️ Import for Manage Master
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <Router>
      <div className="container-fluid">
        <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
          <div className="container-fluid">
            <Link className="navbar-brand" to="/">Dashboard</Link>
            <div className="collapse navbar-collapse">
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
                  <Link className="nav-link" to="/manage-master">Manage Master Data</Link> {/* ⬅️ New Menu Link */}
                </li>
              </ul>
            </div>
          </div>
        </nav>

        <div className="container mt-4">
          <Routes>
            <Route path="/" element={<h2>Welcome to the Dashboard! Please select an option from menu.</h2>} />
            <Route path="/master" element={<MasterData />} />
            <Route path="/booking" element={<AddBooking />} />
            <Route path="/entries" element={<Entries />} />
            <Route path="/manage-master" element={<MasterDataManager />} /> {/* ⬅️ New Route */}
          </Routes>
        </div>

        {/* ✅ Correct position for ToastContainer */}
        <ToastContainer position="bottom-right" autoClose={3000} />
      </div>
    </Router>
  );
}

export default App;
