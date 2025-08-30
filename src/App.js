import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import { Navbar, Nav, NavDropdown, Container, Button } from "react-bootstrap";

import MasterData from "./pages/MasterData";
import AddBooking from "./pages/AddBooking";
import Entries from "./pages/Entries";
import MasterDataManager from "./pages/MasterDataManager";
import CompletedFiles from "./pages/CompletedFiles";
import BookingRequestForm from "./pages/BookingRequestForm";
import Dashboard from "./components/Dashboard";
import Login from "./pages/Login";
import AdminPanel from "./pages/AdminPanel";
// import UpdateSailingRoute from "./UpdateSailingRoute";
// import RTGS from "./pages/RTGS";
// import HBLCreation from "./pages/HBLCreation";
// import HBLEdit from "./pages/HBLEdit";
// import HBLPrint from "./pages/HBLPrint";
import Locals from "./pages/Locals";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.min.css"; // make sure this is in index.js too

import { updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

function ProtectedRoute({ isLoggedIn, children, permissions, page, role }) {
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (role === "admin") return children;
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
      <div className="container-fluid p-0">
        {auth.isLoggedIn && (
          <Navbar bg="primary" variant="dark" expand="lg">
            <Container fluid>
              <Navbar.Brand>Booking Portal</Navbar.Brand>
              <Navbar.Toggle aria-controls="navbar-nav" />
              <Navbar.Collapse id="navbar-nav">
                <Nav className="me-auto align-items-center">
                  {auth.permissions.includes("dashboard") && <Nav.Link as={Link} to="/" className="mx-2 text-nowrap">Dashboard</Nav.Link>}
                  {auth.permissions.includes("addBooking") && <Nav.Link as={Link} to="/booking" className="mx-2 text-nowrap">Add Booking</Nav.Link>}
                  {auth.permissions.includes("entries") && <Nav.Link as={Link} to="/entries" className="mx-2 text-nowrap">View Entries</Nav.Link>}
                  {auth.permissions.includes("completedFiles") && <Nav.Link as={Link} to="/completed-files" className="mx-2 text-nowrap">Completed Files</Nav.Link>}
                  {auth.permissions.includes("master") && <Nav.Link as={Link} to="/master" className="mx-2 text-nowrap">Add Master</Nav.Link>}
                  {auth.permissions.includes("manageMaster") && <Nav.Link as={Link} to="/manage-master" className="mx-2 text-nowrap">Manage Master</Nav.Link>}
                  {auth.permissions.includes("bookingRequest") && <Nav.Link as={Link} to="/booking-request" className="mx-2 text-nowrap">Booking Request</Nav.Link>}
                  {(auth.role === "admin" || auth.permissions.includes("locals")) && <Nav.Link as={Link} to="/locals" className="mx-2 text-nowrap">Locals</Nav.Link>}
                  {/* {(auth.role === "admin" || auth.permissions.includes("updateSailing")) && (
                    <Nav.Link as={Link} to="/update-sailing" className="mx-2 text-nowrap">Update Sailing</Nav.Link>
                  )} */}
                  {auth.role === "admin" && (
                    <>
                      <Nav.Link as={Link} to="/admin-panel" className="mx-2 text-nowrap">Admin</Nav.Link>
                      {/* <Nav.Link as={Link} to="/rtgs" className="mx-2 text-nowrap">RTGS</Nav.Link>
                      <NavDropdown title="HBL" id="hbl-nav-dropdown" className="mx-2 text-nowrap">
                        <NavDropdown.Item as={Link} to="/hbl-creation">HBL Creation</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/hbl-edit">HBL Edit</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/hbl-print">HBL Print</NavDropdown.Item>
                      </NavDropdown> */}
                    </>
                  )}
                </Nav>
                <Navbar.Text className="text-white fw-bold me-3 text-nowrap">
                  {auth.username}
                </Navbar.Text>
                <Button
                  variant="outline-light"
                  size="sm"
                  onClick={async () => {
                    if (auth.id) {
                      await updateDoc(doc(db, "users", auth.id), { active: false });
                    }
                    setAuth({ isLoggedIn: false, role: null, permissions: [], username: null, id: null });
                  }}
                >
                  Logout
                </Button>
              </Navbar.Collapse>
            </Container>
          </Navbar>
        )}

        <div className="container-fluid mt-4">
          <Routes>
            <Route path="/login" element={<Login setAuth={setAuth} />} />
            <Route path="/" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="dashboard" role={auth.role}><Dashboard /></ProtectedRoute>} />
            <Route path="/booking-request" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="bookingRequest" role={auth.role}><BookingRequestForm /></ProtectedRoute>} />
            <Route path="/booking" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="addBooking" role={auth.role}><AddBooking auth={auth} /></ProtectedRoute>} />
            <Route path="/entries" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="entries" role={auth.role}><Entries auth={auth} /></ProtectedRoute>} />
            <Route path="/completed-files" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="completedFiles" role={auth.role}><CompletedFiles auth={auth} /></ProtectedRoute>} />
            <Route path="/master" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="master" role={auth.role}><MasterData /></ProtectedRoute>} />
            <Route path="/manage-master" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="manageMaster" role={auth.role}><MasterDataManager /></ProtectedRoute>} />
            <Route path="/admin-panel" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="manageMaster" role={auth.role}><AdminPanel /></ProtectedRoute>} />
            {/* <Route path="/update-sailing" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="updateSailing" role={auth.role}><UpdateSailingRoute /></ProtectedRoute>} />
            <Route path="/rtgs" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="rtgs" role={auth.role}><RTGS auth={auth} /></ProtectedRoute>} />
            <Route path="/hbl-creation" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="hblCreation" role={auth.role}><HBLCreation /></ProtectedRoute>} />
            <Route path="/hbl-edit" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="hblCreation" role={auth.role}><HBLEdit /></ProtectedRoute>} />
            <Route path="/hbl-print" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="hblCreation" role={auth.role}><HBLPrint /></ProtectedRoute>} /> */}
            <Route path="/locals" element={<ProtectedRoute isLoggedIn={auth.isLoggedIn} permissions={auth.permissions} page="locals" role={auth.role}><Locals auth={auth} /></ProtectedRoute>} />
          </Routes>
        </div>

        <ToastContainer position="bottom-right" autoClose={3000} />
      </div>
    </Router>
  );
}

export default App;
