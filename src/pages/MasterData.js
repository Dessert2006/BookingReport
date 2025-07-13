import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

function MasterData() {
  // Add temporary state for email input strings
  const [emailInputs, setEmailInputs] = useState({
    customerEmail: '',
    salesPersonEmail: ''
  });

  const [newMaster, setNewMaster] = useState({
    customer: { name: "", contactPerson: "", customerEmail: [], contactNumber: "", address: "", salesPerson: "", salesPersonEmail: [] },
    line: { name: "", contactPerson: "", email: "", contactNumber: "" },
    pol: { name: "" },
    pod: { name: "" },
    fpod: { name: "", country: "" },
    vessel: { name: "", flag: "" },
    equipmentType: { type: "" }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState({ open: false, field: "" });
  const [progress, setProgress] = useState(0);

  // State to store all sales persons from customers
  const [salesPersons, setSalesPersons] = useState([]);

  const fieldDefinitions = {
    customer: [
      { label: "Customer Name", key: "name", required: true },
      { label: "Contact Person", key: "contactPerson" },
      { label: "Customer Email (comma-separated)", key: "customerEmail", type: "text" },
      { label: "Contact Number", key: "contactNumber", type: "tel" },
      { label: "Address", key: "address" },
      { label: "Sales Person Name", key: "salesPerson" },
      { label: "Sales Person Email (comma-separated)", key: "salesPersonEmail", type: "text" }
    ],
    line: [
      { label: "Line Name", key: "name", required: true },
      { label: "Contact Person", key: "contactPerson" },
      { label: "Email", key: "email", type: "email" },
      { label: "Contact Number", key: "contactNumber", type: "tel" }
    ],
    pol: [{ label: "POL Name", key: "name", required: true }],
    pod: [{ label: "POD Name", key: "name", required: true }],
    fpod: [
      { label: "FPOD Name", key: "name", required: true },
      { label: "Country", key: "country" }
    ],
    vessel: [
      { label: "Vessel Name", key: "name", required: true },
      { label: "Flag", key: "flag" }
    ],
    equipmentType: [{ label: "Equipment Type", key: "type", required: true }]
  };

  const fieldColors = {
    customer: "#0d6efd",
    line: "#6610f2", 
    pol: "#20c997",
    pod: "#fd7e14",
    fpod: "#198754",
    vessel: "#dc3545",
    equipmentType: "#6f42c1"
  };

  const fieldIcons = {
    customer: "👥",
    line: "🚢",
    pol: "🏭",
    pod: "🏢",
    fpod: "🌍",
    vessel: "⛵",
    equipmentType: "📦"
  };

  useEffect(() => {
    const totalFields = Object.keys(newMaster).length;
    const filledFields = Object.keys(newMaster).filter(field => 
      fieldDefinitions[field].some(f => 
        f.key.includes("Email") ? newMaster[field][f.key].length > 0 : newMaster[field][f.key].trim()
      )
    ).length;
    setProgress((filledFields / totalFields) * 100);
  }, [newMaster]);

  // Fetch all sales persons from Firestore on mount
  useEffect(() => {
    const fetchSalesPersons = async () => {
      try {
        const docRef = doc(db, "newMaster", "customer");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const list = docSnap.data().list || [];
          // Extract unique sales person names and their emails (case-insensitive, trimmed)
          const map = {};
          list.forEach(item => {
            if (item.salesPerson && item.salesPersonEmail && item.salesPersonEmail.length > 0) {
              const normName = item.salesPerson.trim().toUpperCase();
              if (!map[normName]) {
                map[normName] = { name: item.salesPerson.trim(), emails: item.salesPersonEmail };
              }
            }
          });
          setSalesPersons(Object.values(map));
        }
      } catch (err) {
        console.error("Failed to fetch sales persons", err);
      }
    };
    fetchSalesPersons();
  }, []);

  const showToast = (message, type = 'info') => {
    console.log(`Toast: ${message} (${type})`);
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '2000';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('fade');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const handleInputChange = (field, subfield, value) => {
    let processedValue = value;
    // For email fields, update the temp string state
    if (field === 'customer' && (subfield === 'customerEmail' || subfield === 'salesPersonEmail')) {
      setEmailInputs({
        ...emailInputs,
        [subfield]: value
      });
      // Don't update newMaster here, will update on blur or save
      return;
    }
    if (typeof value === 'string' && !subfield.includes("Email")) {
      processedValue = value.toUpperCase();
    }
    setNewMaster({
      ...newMaster,
      [field]: { ...newMaster[field], [subfield]: processedValue }
    });
  };

  // On blur, update the array in newMaster for email fields
  const handleEmailBlur = (field, subfield) => {
    const value = emailInputs[subfield] || '';
    const emailArray = value.split(',').map(email => email.trim().toLowerCase()).filter(email => email);
    setNewMaster({
      ...newMaster,
      [field]: { ...newMaster[field], [subfield]: emailArray }
    });
  };

  const openModal = (field) => {
    if (field === 'customer') {
      setEmailInputs({
        customerEmail: newMaster.customer.customerEmail.join(', '),
        salesPersonEmail: newMaster.customer.salesPersonEmail.join(', ')
      });
    }
    setShowModal({ open: true, field });
  };

  const closeModal = () => {
    setShowModal({ open: false, field: "" });
  };

  const addToMaster = async (field, data) => {
    console.log(`Attempting to add to ${field}:`, data);
    try {
      const docRef = doc(db, "newMaster", field);
      const docSnap = await getDoc(docRef);
      
      const normalizedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.map(v => v.toLowerCase()) : 
          typeof value === 'string' ? value.toUpperCase() : value
        ])
      );

      if (docSnap.exists()) {
        const existingData = docSnap.data().list || []; // Changed from items to list
        const isDuplicate = existingData.some(item => 
          (item.name || item.type)?.toUpperCase() === (normalizedData.name || normalizedData.type)?.toUpperCase()
        );

        if (isDuplicate) {
          showToast(`${capitalize(field)} '${data.name || data.type}' already exists.`, "warning");
          console.log(`Duplicate found for ${field}: ${data.name || data.type}`);
          return false;
        }

        await updateDoc(docRef, {
          list: arrayUnion(normalizedData) // Changed from items to list
        });
        console.log(`Successfully updated ${field} document`);
      } else {
        await setDoc(docRef, {
          list: [normalizedData] // Changed from items to list
        });
        console.log(`Successfully created new ${field} document`);
      }
      
      showToast(`${capitalize(field)} added successfully!`, "success");
      return true;
    } catch (error) {
      console.error("Error adding to master:", error);
      showToast(`Failed to add ${field}: ${error.message}`, "error");
      return false;
    }
  };

  const handleAddSingle = async (field) => {
    setIsLoading(true);
    if (field === 'customer') {
      setNewMaster((prev) => ({
        ...prev,
        customer: {
          ...prev.customer,
          customerEmail: emailInputs.customerEmail.split(',').map(e => e.trim().toLowerCase()).filter(e => e),
          salesPersonEmail: emailInputs.salesPersonEmail.split(',').map(e => e.trim().toLowerCase()).filter(e => e)
        }
      }));
    }
    console.log(`Handle add single for ${field}`);
    
    const data = newMaster[field];
    const requiredFields = fieldDefinitions[field].filter(f => f.required).map(f => f.key);
    
    if (!requiredFields.every(key => data[key].trim())) {
      showToast(`Please enter all required fields for ${field}.`, "error");
      setIsLoading(false);
      return;
    }

    if (field === "customer") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (data.customerEmail.some(email => email && !emailRegex.test(email))) {
        showToast("Please enter valid customer email addresses.", "error");
        setIsLoading(false);
        return;
      }
      if (data.salesPersonEmail.some(email => email && !emailRegex.test(email))) {
        showToast("Please enter valid sales person email addresses.", "error");
        setIsLoading(false);
        return;
      }
    }

    const added = await addToMaster(field, data);
    if (added) {
      setNewMaster({
        ...newMaster,
        [field]: Object.fromEntries(
          Object.keys(data).map(key => [key, key.includes("Email") ? [] : ""])
        )
      });
    }
    
    setIsLoading(false);
    closeModal();
  };

  const handleAddAll = async () => {
    console.log("Handling add all");
    const filledFields = Object.keys(newMaster).filter(field => 
      fieldDefinitions[field].some(f => 
        f.key.includes("Email") ? newMaster[field][f.key].length > 0 : newMaster[field][f.key].trim()
      )
    );

    if (filledFields.length === 0) {
      showToast("Please fill at least one field to add.", "error");
      return;
    }

    setIsLoading(true);
    let addedCount = 0;
    
    for (let field of filledFields) {
      const requiredFields = fieldDefinitions[field].filter(f => f.required).map(f => f.key);
      if (requiredFields.every(key => newMaster[field][key].trim())) {
        const data = newMaster[field];
        if (field === "customer") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (data.customerEmail.some(email => email && !emailRegex.test(email))) {
            showToast(`Invalid customer email in ${field}.`, "error");
            continue;
          }
          if (data.salesPersonEmail.some(email => email && !emailRegex.test(email))) {
            showToast(`Invalid sales person email in ${field}.`, "error");
            continue;
          }
        }
        const added = await addToMaster(field, data);
        if (added) addedCount++;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (addedCount > 0) {
      showToast(`Added ${addedCount} master entr${addedCount > 1 ? "ies" : "y"} successfully!`, "success");
      setNewMaster({
        customer: { name: "", contactPerson: "", customerEmail: [], contactNumber: "", address: "", salesPerson: "", salesPersonEmail: [] },
        line: { name: "", contactPerson: "", email: "", contactNumber: "" },
        pol: { name: "" },
        pod: { name: "" },
        fpod: { name: "", country: "" },
        vessel: { name: "", flag: "" },
        equipmentType: { type: "" }
      });
    } else {
      showToast("No new entries were added.", "warning");
    }
    
    setIsLoading(false);
  };

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  const isAnyFieldFilled = Object.values(newMaster).some(data => 
    Object.values(data).some(value => 
      Array.isArray(value) ? value.length > 0 : value.trim()
    )
  );

  return (
    <div className="container-fluid py-4" style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
    }}>
      <style>{`
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 8px;
          color: white;
          z-index: 2000;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
        }
        .toast.show {
          opacity: 1;
        }
        .toast-success { background-color: #28a745; }
        .toast-error { background-color: #dc3545; }
        .toast-warning { background-color: #ffc107; color: #212529; }
        .toast-info { background-color: #17a2b8; }
        
        .master-card {
          border-radius: 12px;
          border: none;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          background: white;
        }
        
        .master-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        
        .card-header-custom {
          padding: 1.5rem;
          color: white;
          border: none;
          text-align: center;
        }
        
        .form-control {
          border: 2px solid #e9ecef;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }
        
        .form-control:focus {
          border-color: #0d6efd;
          box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
          outline: none;
        }
        
        .form-label {
          font-weight: 600;
          color: #495057;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }
        
        .btn {
          font-weight: 600;
          border-radius: 8px;
          padding: 0.75rem 1.5rem;
          transition: all 0.2s ease;
        }
        
        .btn:hover {
          transform: translateY(-1px);
        }
        
        .btn:disabled {
          transform: none;
        }
        
        .progress {
          height: 8px;
          border-radius: 10px;
          background-color: #e9ecef;
        }
        
        .progress-bar {
          background: linear-gradient(90deg, #0d6efd, #6610f2);
          border-radius: 10px;
          transition: width 0.3s ease;
        }
        
        .modal {
          display: ${showModal.open ? 'block' : 'none'};
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          z-index: 1050;
          backdrop-filter: blur(4px);
        }
        
        .modal-dialog {
          position: relative;
          width: auto;
          max-width: 700px;
          margin: 2rem auto;
          pointer-events: none;
        }
        
        .modal-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          pointer-events: auto;
          border: none;
        }
        
        .modal-header {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #e9ecef;
          background-color: #495057;
          color: white;
          border-radius: 12px 12px 0 0;
        }
        
        .modal-body {
          padding: 2rem;
        }
        
        .modal-footer {
          padding: 1.5rem 2rem;
          border-top: 1px solid #e9ecef;
          background-color: #f8f9fa;
          border-radius: 0 0 12px 12px;
        }
        
        .modal-title {
          font-weight: 700;
          color: white;
        }
        
        .close {
          background: none;
          border: none;
          font-size: 1.5rem;
          line-height: 1;
          color: white;
          opacity: 0.8;
          cursor: pointer;
          padding: 0;
          margin-left: auto;
        }
        
        .close:hover {
          opacity: 1;
        }
        
        .spinner-border {
          width: 1rem;
          height: 1rem;
        }
        
        .field-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          display: block;
        }
        
        .stats-card {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          border: 1px solid #e9ecef;
        }
        
        .badge {
          font-size: 0.7rem;
        }
      `}</style>

      <div className="container">
        <div className="row mb-5">
          <div className="col-12 text-center">
            <h1 className="display-5 mb-3" style={{ color: '#2c3e50', fontWeight: '700' }}>
              Master Data Management
            </h1>
            <p className="text-muted fs-5 mb-4">Create and manage your master data efficiently</p>
            
            {progress > 0 && (
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-semibold text-muted">Overall Progress</span>
                  <span className="badge bg-primary">{Math.round(progress)}% complete</span>
                </div>
                <div className="progress" style={{ maxWidth: '400px', margin: '0 auto' }}>
                  <div 
                    className="progress-bar"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="row g-4 mb-5">
          {Object.keys(fieldDefinitions).map((field, index) => (
            <div className="col-lg-4 col-md-6" key={field}>
              <div className="card master-card h-100">
                <div 
                  className="card-header-custom"
                  style={{ backgroundColor: fieldColors[field] }}
                >
                  <div className="field-icon">{fieldIcons[field]}</div>
                  <h5 className="card-title mb-1 text-uppercase fw-bold">
                    {capitalize(field)}
                  </h5>
                  <small style={{ opacity: 0.9 }}>
                    {fieldDefinitions[field].length} field{fieldDefinitions[field].length > 1 ? 's' : ''}
                  </small>
                </div>
                
                <div className="card-body p-4 d-flex flex-column justify-content-between">
                  <div>
                    {fieldDefinitions[field].slice(0, 3).map(({ label, key, required }) => (
                      <div key={key} className="mb-2 d-flex justify-content-between align-items-center">
                        <small className="text-muted">
                          {label} {required && <span className="text-danger">*</span>}
                        </small>
                        {newMaster[field][key] && Array.isArray(newMaster[field][key]) ? 
                          newMaster[field][key].length > 0 && <span className="badge bg-success">✓</span> :
                          newMaster[field][key].trim() && <span className="badge bg-success">✓</span>
                        }
                      </div>
                    ))}
                    {fieldDefinitions[field].length > 3 && (
                      <small className="text-muted">+{fieldDefinitions[field].length - 3} more fields...</small>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    className="btn w-100 mt-3 text-white"
                    style={{ 
                      backgroundColor: fieldColors[field],
                      borderColor: fieldColors[field]
                    }}
                    onClick={() => openModal(field)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Processing...
                      </>
                    ) : (
                      <>Add {capitalize(field)}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isAnyFieldFilled && (
          <div className="row">
            <div className="col-12 text-center">
              <div className="stats-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
                <h5 className="text-primary mb-3">
                  <span style={{ fontSize: '2rem' }}>🚀</span>
                  <br />
                  Ready to save all data?
                </h5>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleAddAll}
                  disabled={isLoading}
                  style={{ minWidth: '200px' }}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Processing All...
                    </>
                  ) : (
                    "Add All Master Data"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal.open && (
        <div className="modal">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header d-flex justify-content-between align-items-center">
                <h5 className="modal-title d-flex align-items-center">
                  <span className="me-3" style={{ fontSize: '1.5rem' }}>
                    {fieldIcons[showModal.field]}
                  </span>
                  Add New {capitalize(showModal.field)}
                </h5>
                <button type="button" className="close" onClick={closeModal}>
                  <span>×</span>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="row g-3">
                  {fieldDefinitions[showModal.field]?.map(({ label, key, type = "text", required }) => (
                    <div className="col-md-6" key={key}>
                      <label className="form-label">
                        {label} 
                        {required && <span className="text-danger ms-1">*</span>}
                      </label>
                      {/* For salesPerson, use a single input with datalist for suggestions */}
                      {showModal.field === 'customer' && key === 'salesPerson' && salesPersons.length > 0 ? (
                        <>
                          <select
                            className="form-control"
                            value={newMaster.customer.salesPerson}
                            onChange={e => {
                              const val = e.target.value;
                              const selected = salesPersons.find(sp => sp.name === val);
                              setNewMaster({
                                ...newMaster,
                                customer: {
                                  ...newMaster.customer,
                                  salesPerson: val,
                                  salesPersonEmail: selected ? selected.emails : []
                                }
                              });
                              setEmailInputs(inputs => ({ ...inputs, salesPersonEmail: selected ? selected.emails.join(', ') : '' }));
                              if (!selected) {
                                setNewMaster(prev => ({
                                  ...prev,
                                  customer: {
                                    ...prev.customer,
                                    salesPerson: val,
                                    salesPersonEmail: []
                                  }
                                }));
                                setEmailInputs(inputs => ({ ...inputs, salesPersonEmail: '' }));
                              }
                            }}
                            style={{ textTransform: 'uppercase' }}
                          >
                            <option value="">Select Sales Person</option>
                            {salesPersons.map(sp => (
                              <option key={sp.name} value={sp.name}>{sp.name}</option>
                            ))}
                          </select>
                        </>
                      ) : showModal.field === 'customer' && key === 'salesPersonEmail' && salesPersons.length > 0 ? (
                        <select
                          className="form-control"
                          value={newMaster.customer.salesPersonEmail[0] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setNewMaster({
                              ...newMaster,
                              customer: {
                                ...newMaster.customer,
                                salesPersonEmail: val ? [val] : []
                              }
                            });
                            setEmailInputs(inputs => ({ ...inputs, salesPersonEmail: val }));
                          }}
                          style={{ textTransform: 'none' }}
                        >
                          <option value="">Select Sales Person Email</option>
                          {salesPersons
                            .flatMap(sp => sp.emails)
                            .filter((email, idx, arr) => arr.indexOf(email) === idx)
                            .map(email => (
                              <option key={email} value={email}>{email}</option>
                            ))}
                        </select>
                      ) : (
                        <input
                          type={type}
                          className="form-control"
                          placeholder={`Enter ${label.toLowerCase()}${key.includes("Email") ? " (comma-separated)" : ""}`}
                          value={
                            showModal.field === 'customer' && (key === 'customerEmail' || key === 'salesPersonEmail')
                              ? emailInputs[key]
                              : Array.isArray(newMaster[showModal.field][key])
                                ? newMaster[showModal.field][key].join(", ")
                                : newMaster[showModal.field][key]
                          }
                          onChange={(e) => handleInputChange(showModal.field, key, e.target.value)}
                          onBlur={
                            showModal.field === 'customer' && (key === 'customerEmail' || key === 'salesPersonEmail')
                              ? () => handleEmailBlur(showModal.field, key)
                              : undefined
                          }
                          required={required}
                          style={key.includes('Email') ? { textTransform: 'none' } : { textTransform: 'uppercase' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="modal-footer d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn text-white"
                  style={{ 
                    backgroundColor: fieldColors[showModal.field],
                    borderColor: fieldColors[showModal.field]
                  }}
                  onClick={() => handleAddSingle(showModal.field)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    `Save ${capitalize(showModal.field)}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterData;