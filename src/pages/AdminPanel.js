import React, { useState, useEffect } from 'react';
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

const allPermissions = [
  { key: "dashboard", label: "Dashboard" },
  { key: "addBooking", label: "Add Booking Entry" },
  { key: "entries", label: "View Entries" },
  { key: "completedFiles", label: "Completed Files" },
  { key: "master", label: "Add Master Data" },
  { key: "manageMaster", label: "Manage Master Data" },
  { key: "bookingRequest", label: "Booking Request Form" },
];

function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user", permissions: [] });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editShowPassword, setEditShowPassword] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "users"));
      let userList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // If no admin exists, add default admin
      if (!userList.some(u => u.role === "admin")) {
        const defaultAdmin = {
          username: "admin",
          password: "admin123",
          role: "admin",
          permissions: allPermissions.map(p => p.key),
        };
        await addDoc(collection(db, "users"), defaultAdmin);
        userList = [...userList, { id: querySnapshot.docs[0].id, ...defaultAdmin }];
      }
      setUsers(userList);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const handlePermissionChange = (perm, checked) => {
    setNewUser((prev) => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, perm]
        : prev.permissions.filter((p) => p !== perm),
    }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    const docRef = await addDoc(collection(db, "users"), newUser);
    setUsers([...users, { id: docRef.id, ...newUser }]);
    setNewUser({ username: "", password: "", role: "user", permissions: [] });
  };

  const handleEdit = (idx) => {
    setEditIdx(idx);
    setEditUser({ ...users[idx] });
  };

  const handleEditChange = (field, value) => {
    setEditUser((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditPermissionChange = (perm, checked) => {
    setEditUser((prev) => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, perm]
        : prev.permissions.filter((p) => p !== perm),
    }));
  };

  const handleSaveEdit = async (id) => {
    const userDoc = doc(db, "users", id);
    await updateDoc(userDoc, editUser);
    const updatedUsers = [...users];
    updatedUsers[editIdx] = { ...editUser };
    setUsers(updatedUsers);
    setEditIdx(null);
    setEditUser(null);
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "users", id));
    setUsers(users.filter((u) => u.id !== id));
  };

  const handleRoleChange = (role) => {
    setNewUser((prev) => ({
      ...prev,
      role,
      permissions: role === "admin" ? allPermissions.map(p => p.key) : [],
    }));
  };

  return (
    <div className="container">
      <style>
        {`
          body {
            margin: 0;
            font-family: Arial, sans-serif;
          }
          .container {
            display: flex;
            min-height: 100vh;
            background-color: #f4f4f4;
          }
          .sidebar {
            width: 250px;
            background-color: #fff;
            box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
          }
          .sidebar-header {
            display: flex;
            align-items: center;
            padding: 15px;
            border-bottom: 1px solid #ddd;
          }
          .sidebar-header img {
            height: 40px;
            margin-right: 10px;
          }
          .sidebar-header h2 {
            font-size: 18px;
            font-weight: bold;
            margin: 0;
          }
          .sidebar nav a {
            display: block;
            padding: 10px 15px;
            color: #333;
            text-decoration: none;
          }
          .sidebar nav a:hover {
            background-color: #f0f0f0;
            transition: background-color 0.3s;
          }
          .main-content {
            flex: 1;
            padding: 20px;
          }
          .content-wrapper {
            max-width: 1000px;
            margin: 0 auto;
          }
          .content-wrapper h1 {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
          }
          .error {
            padding: 10px;
            background-color: #ffe6e6;
            color: #cc0000;
            border-radius: 5px;
            margin-bottom: 15px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          @media (max-width: 768px) {
            .grid {
              grid-template-columns: 1fr;
            }
          }
          .card {
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          }
          .card h2 {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .form-group {
            margin-bottom: 15px;
          }
          .form-group label {
            display: block;
            font-size: 14px;
            color: #555;
            margin-bottom: 5px;
          }
          .form-group input,
          .form-group select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
          }
          .form-group input:focus,
          .form-group select:focus {
            border-color: #4b5e aa;
            outline: none;
            transition: border-color 0.3s;
          }
          .permissions-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
          }
          .permission-item {
            display: flex;
            align-items: center;
          }
          .permission-item input {
            width: 16px;
            height: 16px;
            margin-right: 8px;
          }
          .permission-item label {
            font-size: 13px;
            color: #666;
          }
          .submit-btn {
            width: 100%;
            padding: 10px;
            background-color: #4b5eaa;
            color: #fff;
            border: none;
            border-radius: 5px;
            font-size: 14px;
            cursor: pointer;
          }
          .submit-btn:hover {
            background-color: #3f4f8c;
            transition: background-color 0.3s;
          }
          .table-container {
            overflow-x: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead {
            background-color: #f7f7f7;
          }
          th {
            padding: 10px;
            text-align: left;
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
          }
          td {
            padding: 10px;
            font-size: 14px;
            color: #333;
            border-top: 1px solid #ddd;
          }
          tr:hover {
            background-color: #f9f9f9;
            transition: background-color 0.3s;
          }
          .badge {
            padding: 5px 10px;
            font-size: 12px;
            border-radius: 10px;
            display: inline-flex;
          }
          .badge-admin {
            background-color: #e6f0ff;
            color: #4b5eaa;
          }
          .badge-user {
            background-color: #f0f0f0;
            color: #666;
          }
          .delete-btn {
            color: #cc0000;
            background: none;
            border: none;
            font-size: 14px;
            cursor: pointer;
          }
          .delete-btn:hover {
            color: #990000;
            transition: color 0.3s;
          }
          .delete-btn:disabled {
            color: #ccc;
            cursor: not-allowed;
          }
        `}
      </style>
      <div className="main-content">
        <div className="content-wrapper">
          <h1>User Management</h1>
          {error && <div className="error">{error}</div>}
          <div className="grid">
            <div className="card">
              <h2>Add New User</h2>
              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="Username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <div className="input-group mb-2">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      placeholder="Password"
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
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
                <div className="form-group">
                  <label>Role</label>
                  <select
                    className="form-select mb-2"
                    value={newUser.role}
                    onChange={e => handleRoleChange(e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Permissions</label>
                  <div className="permissions-grid">
                    {allPermissions.map((perm) => (
                      <div key={perm.key} className="permission-item">
                        <input
                          type="checkbox"
                          checked={newUser.permissions.includes(perm.key)}
                          onChange={(e) => handlePermissionChange(perm.key, e.target.checked)}
                          id={perm.key}
                        />
                        <label htmlFor={perm.key}>{perm.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <button type="submit" className="submit-btn">Add User</button>
              </form>
            </div>
            <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light animate__animated animate__fadeIn">
              <div className="card shadow-lg p-4 w-100" style={{ maxWidth: 1400 }}>
                <h2>Existing Users</h2>
                {loading ? (
                  <div className="text-center py-4">Loading users...</div>
                ) : (
                  <div className="table-responsive animate__animated animate__fadeInUp">
                    <table className="table table-bordered table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Username</th>
                          <th>Role</th>
                          <th>Permissions</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u, idx) => (
                          <tr key={u.id} className={editIdx === idx ? "bg-light border border-2 align-top" : "align-top"} style={editIdx === idx ? { boxShadow: '0 2px 8px #e0e0e0' } : {}}>
                            {editIdx === idx ? (
                              <>
                                <td style={{ minWidth: 120, verticalAlign: 'top' }}>
                                  <input type="text" className="form-control form-control-sm mb-2" value={editUser.username} onChange={e => handleEditChange("username", e.target.value)} />
                                  <div className="input-group input-group-sm">
                                    <input
                                      type={editShowPassword ? "text" : "password"}
                                      className="form-control"
                                      value={editUser.password || ""}
                                      onChange={e => handleEditChange("password", e.target.value)}
                                      placeholder="Password"
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary"
                                      tabIndex="-1"
                                      onClick={() => setEditShowPassword((v) => !v)}
                                      style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                                    >
                                      {editShowPassword ? "🙈" : "👁️"}
                                    </button>
                                  </div>
                                </td>
                                <td style={{ minWidth: 90, verticalAlign: 'top' }}>
                                  <select className="form-select form-select-sm mb-2" value={editUser.role} onChange={e => handleEditChange("role", e.target.value)}>
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </td>
                                <td style={{ minWidth: 220, verticalAlign: 'top' }}>
                                  <div className="d-flex flex-column flex-wrap" style={{ minHeight: 90 }}>
                                    {allPermissions.map((perm) => (
                                      <div key={perm.key} className="form-check mb-1">
                                        <input
                                          className="form-check-input"
                                          type="checkbox"
                                          checked={editUser.permissions.includes(perm.key)}
                                          onChange={e => handleEditPermissionChange(perm.key, e.target.checked)}
                                          id={`edit-${perm.key}-${u.id}`}
                                        />
                                        <label className="form-check-label ms-1" htmlFor={`edit-${perm.key}-${u.id}`}>{perm.label}</label>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td style={{ minWidth: 80, verticalAlign: 'top' }}>
                                  {u.active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}
                                </td>
                                <td style={{ minWidth: 110, verticalAlign: 'top' }}>
                                  <div className="d-flex flex-column gap-2">
                                    <button className="btn btn-success btn-sm w-100" onClick={() => handleSaveEdit(u.id)}>Save</button>
                                    <button className="btn btn-secondary btn-sm w-100" onClick={() => { setEditIdx(null); setEditUser(null); }}>Cancel</button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ minWidth: 120 }}>{u.username}</td>
                                <td style={{ minWidth: 90 }}><span className={`badge bg-${u.role === "admin" ? "primary" : "secondary"}`}>{u.role}</span></td>
                                <td style={{ minWidth: 220 }}>{u.permissions.map(p => allPermissions.find(ap => ap.key === p)?.label).join(", ")}</td>
                                <td style={{ minWidth: 80 }}>
                                  {u.active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}
                                </td>
                                <td style={{ minWidth: 110 }}>
                                  <div className="d-flex flex-column gap-2">
                                    <button className="btn btn-warning btn-sm w-100" onClick={() => handleEdit(idx)}>Edit</button>
                                    <button className="btn btn-danger btn-sm w-100" onClick={() => handleDelete(u.id)}>Delete</button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;