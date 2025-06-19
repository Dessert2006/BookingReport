import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, updateDoc, query, where, doc } from "firebase/firestore";

function Login({ setAuth }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const users = querySnapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
      const user = users.find(
        (u) => u.username === username && u.password === password
      );
      if (user) {
        // Set user as active in Firestore
        await updateDoc(doc(db, "users", user.id), { active: true });
        setAuth({ isLoggedIn: true, role: user.role, permissions: user.permissions, username: user.username, id: user.id });
        navigate("/");
      } else {
        setError("Invalid credentials");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow p-4" style={{ minWidth: 350, maxWidth: 400 }}>
        <div className="text-center mb-4">
          <img src={require("../dmslogo.png")} alt="Logo" style={{ height: 60, marginBottom: 10 }} />
          <h3 className="fw-bold mt-2 mb-0" style={{ letterSpacing: 1 }}>DMS Booking Login</h3>
          <p className="text-muted mb-0" style={{ fontSize: 14 }}>Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Username</label>
            <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="mb-3">
            <label className="form-label">Password</label>
            <div className="input-group">
              <input
                type={showPassword ? "text" : "password"}
                className="form-control"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                tabIndex="-1"
                onClick={() => setShowPassword((v) => !v)}
                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button type="submit" className="btn btn-primary w-100 mt-2" disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
        </form>
      </div>
    </div>
  );
}

export default Login;
