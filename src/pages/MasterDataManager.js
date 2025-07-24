import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { getDoc, doc, updateDoc, collection, getDocs, runTransaction, setDoc, query, where } from "firebase/firestore";
import { toast } from "react-toastify";

function MasterDataManager() {
  const [selectedMaster, setSelectedMaster] = useState("");
  const [masterList, setMasterList] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editData, setEditData] = useState({});
  const [newEntry, setNewEntry] = useState({});
  const [oldData, setOldData] = useState({}); // Store the original data before edit
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [customers, setCustomers] = useState([]);

  const masterOptions = [
    { value: "customer", label: "Customer", icon: "👥", color: "#0d6efd" },
    { value: "line", label: "Line", icon: "🚢", color: "#6610f2" },
    { value: "pol", label: "POL", icon: "🏭", color: "#20c997" },
    { value: "pod", label: "POD", icon: "🏢", color: "#fd7e14" },
    { value: "fpod", label: "FPOD", icon: "🌍", color: "#198754" },
    { value: "vessel", label: "Vessel", icon: "⛵", color: "#dc3545" },
    { value: "equipmentType", label: "Equipment Type", icon: "📦", color: "#6f42c1" },
  ];

  const fieldDefinitions = {
    customer: [
      { key: "name", label: "Name", required: true },
      { key: "contactPerson", label: "Contact Person" },
      { key: "customerEmail", label: "Customer Email" },
      { key: "contactNumber", label: "Contact Number" },
      { key: "address", label: "Address" },
      { key: "salesPerson", label: "Sales Person" },
      { key: "salesPersonEmail", label: "Sales Person Email" }
    ],
    line: [
      { key: "name", label: "Name", required: true },
      { key: "contactPerson", label: "Contact Person" },
      { key: "email", label: "Email" },
      { key: "contactNumber", label: "Contact Number" }
    ],
    pol: [{ key: "name", label: "Name", required: true }],
    pod: [{ key: "name", label: "Name", required: true }],
    fpod: [
      { key: "name", label: "Name", required: true },
      { key: "country", label: "Country" }
    ],
    vessel: [
      { key: "name", label: "Name", required: true },
      { key: "flag", label: "Flag" }
    ],
    equipmentType: [{ key: "type", label: "Type", required: true }]
  };

  useEffect(() => {
    if (selectedMaster) {
      console.log(`Fetching data for ${selectedMaster}`);
      fetchMasterList(selectedMaster);
      setShowAddForm(false);
    }
  }, [selectedMaster]);

  // Debug: Log vessel data if selected
  useEffect(() => {
    if (selectedMaster === 'vessel') {
      console.log('Current vessel masterList:', masterList);
    }
  }, [selectedMaster, masterList]);

  useEffect(() => {
    const fetchCustomers = async () => {
      const customerSnapshot = await getDocs(collection(db, "customers"));
      setCustomers(customerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCustomers();
  }, []);

  const fetchMasterList = async (field) => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "newMaster", field);
      const docSnap = await getDoc(docRef);
      console.log(`Fetched document for ${field}:`, docSnap.exists() ? docSnap.data() : "Document does not exist");

      if (docSnap.exists()) {
        const data = docSnap.data().list || [];
        console.log(`Master list for ${field}:`, data);
        setMasterList(data);
        setNewEntry({});
      } else {
        console.log(`No document found for ${field}, initializing empty list`);
        setMasterList([]);
        setNewEntry({});
      }
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast.error(`Error loading ${field} data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sort masterList alphabetically by 'name' or 'type' before rendering
  const sortedMasterList = [...masterList].sort((a, b) => {
    const key = selectedMaster === 'equipmentType' ? 'type' : 'name';
    const aValue = (a[key] || '').toUpperCase();
    const bValue = (b[key] || '').toUpperCase();
    if (aValue < bValue) return -1;
    if (aValue > bValue) return 1;
    return 0;
  });

  const handleEdit = (sortedIndex) => {
    console.log(`Editing sorted index ${sortedIndex}`);
    const item = sortedMasterList[sortedIndex];
    
    // Find the actual index in the original masterList
    const key = selectedMaster === 'equipmentType' ? 'type' : 'name';
    const actualIndex = masterList.findIndex(masterItem => 
      masterItem[key] === item[key]
    );
    
    console.log(`Actual index in masterList: ${actualIndex}`, item);
    setEditIndex(actualIndex);
    
    setEditData({
      ...item,
      customerEmail: item.customerEmail ? item.customerEmail.join(", ") : "",
      salesPersonEmail: item.salesPersonEmail ? item.salesPersonEmail.join(", ") : ""
    });
    setOldData(item); // Store the original data for comparison in handleSave
  };

  const handleSave = async (actualIndex) => {
    setIsLoading(true);
    console.log(`Saving edited data at actual index ${actualIndex}:`, editData);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const updatedData = {
      ...editData,
      customerEmail: editData.customerEmail
        ? editData.customerEmail.split(",").map(email => email.trim()).filter(email => email)
        : [],
      salesPersonEmail: editData.salesPersonEmail
        ? editData.salesPersonEmail.split(",").map(email => email.trim()).filter(email => email)
        : []
    };

    if (selectedMaster === "customer") {
      if (updatedData.customerEmail.some(email => email && !emailRegex.test(email))) {
        toast.error("Please enter valid customer email addresses.");
        setIsLoading(false);
        return;
      }
      if (updatedData.salesPersonEmail.some(email => email && !emailRegex.test(email))) {
        toast.error("Please enter valid sales person email addresses.");
        setIsLoading(false);
        return;
      }
    }

    const updatedList = [...masterList];
    updatedList[actualIndex] = updatedData;

    const docRef = doc(db, "newMaster", selectedMaster);
    try {
      await updateDoc(docRef, { list: updatedList });
      toast.success("Master data updated successfully!");
      setMasterList(updatedList);
      setEditIndex(null);

      // Trigger sync if any customer field has changed
      if (selectedMaster === "customer") {
        const hasChanges = Object.keys(updatedData).some(key => 
          JSON.stringify(updatedData[key]) !== JSON.stringify(oldData[key])
        );
        if (hasChanges) {
          await syncEntriesWithMaster(oldData.name, updatedData, selectedMaster);
        }
      }
    } catch (error) {
      console.error("Error updating document:", error);
      toast.error(`Failed to update ${selectedMaster} data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (sortedIndex) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;

    setIsLoading(true);
    const itemToDelete = sortedMasterList[sortedIndex];
    const key = selectedMaster === "equipmentType" ? "type" : "name";
    const valueToDelete = itemToDelete[key];

    console.log("Deleting item:", itemToDelete);

    const docRef = doc(db, "newMaster", selectedMaster);
    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        let currentList = [];
        if (docSnap.exists()) {
          currentList = Array.isArray(docSnap.data().list) ? docSnap.data().list : [];
        }

        // Find the index of the item in Firestore list by matching the unique identifier
        const firestoreIndex = currentList.findIndex(item => item[key] === valueToDelete);
        if (firestoreIndex === -1) {
          throw new Error(`Item ${valueToDelete} not found in Firestore`);
        }

        const updatedList = [...currentList];
        updatedList.splice(firestoreIndex, 1);
        transaction.set(docRef, { list: updatedList }, { merge: true });
      });

      await fetchMasterList(selectedMaster);
      toast.success("Master data deleted successfully!");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(`Failed to delete ${selectedMaster} data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    console.log(`Updating editData field ${field}:`, value);
    setEditData({ ...editData, [field]: value });
  };

  const handleNewEntryChange = (field, value) => {
    console.log(`Updating newEntry field ${field}:`, value);
    // Only convert to uppercase for non-email fields
    setNewEntry({
      ...newEntry,
      [field]: field.includes("Email") ? value : value.toUpperCase()
    });
  };

  const handleAddNewEntry = async () => {
    console.log(`Adding new entry for ${selectedMaster}:`, newEntry);
    const requiredFields = fieldDefinitions[selectedMaster].filter(f => f.required);
    const hasRequiredFields = requiredFields.every(field => 
      newEntry[field.key] && newEntry[field.key].trim()
    );

    if (!hasRequiredFields) {
      toast.error("Please fill all required fields before adding.");
      console.log("Missing required fields:", requiredFields);
      return;
    }

    setIsLoading(true);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const updatedEntry = {
      ...newEntry,
      customerEmail: newEntry.customerEmail
        ? newEntry.customerEmail.split(",").map(email => email.trim().toLowerCase()).filter(email => email)
        : [],
      salesPersonEmail: newEntry.salesPersonEmail
        ? newEntry.salesPersonEmail.split(",").map(email => email.trim().toLowerCase()).filter(email => email)
        : []
    };

    if (selectedMaster === "customer") {
      if (updatedEntry.customerEmail.some(email => email && !emailRegex.test(email))) {
        toast.error("Please enter valid customer email addresses.");
        setIsLoading(false);
        return;
      }
      if (updatedEntry.salesPersonEmail.some(email => email && !emailRegex.test(email))) {
        toast.error("Please enter valid sales person email addresses.");
        setIsLoading(false);
        return;
      }
    }

    const docRef = doc(db, "newMaster", selectedMaster);
    try {
      const docSnap = await getDoc(docRef);
      let updatedList = [];

      if (docSnap.exists()) {
        const existingData = docSnap.data().list || [];
        const isDuplicate = existingData.some(item => 
          (item.name || item.type)?.toUpperCase() === (updatedEntry.name || updatedEntry.type)?.toUpperCase()
        );

        if (isDuplicate) {
          toast.error(`${selectedMaster} '${updatedEntry.name || updatedEntry.type}' already exists.`);
          console.log(`Duplicate entry detected:`, updatedEntry);
          setIsLoading(false);
          return;
        }
        updatedList = [...existingData, updatedEntry];
      } else {
        updatedList = [updatedEntry];
      }

      await updateDoc(docRef, { list: updatedList });
      // Add customerId to the newly added customer if selectedMaster is customer
      if (selectedMaster === "customer") {
        // Fetch the updated list
        const updatedDocSnap = await getDoc(docRef);
        if (updatedDocSnap.exists()) {
          let listWithId = updatedDocSnap.data().list || [];
          // Find the last added customer (should be the last in the list)
          const lastIndex = listWithId.length - 1;
          if (lastIndex >= 0 && !listWithId[lastIndex].customerId) {
            listWithId[lastIndex].customerId = docRef.id;
            await updateDoc(docRef, { list: listWithId });
          }
        }
      }
      toast.success("New master data added successfully!");
      console.log(`Successfully added new entry to ${selectedMaster}:`, updatedEntry);
      setMasterList(updatedList);
      setNewEntry({});
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding new entry:", error);
      toast.error(`Failed to add ${selectedMaster} data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const syncEntriesWithMaster = async (oldName, newData, fieldType) => {
    console.log(`Syncing entries for ${fieldType}: ${oldName} ->`, newData);
    try {
      // Use a query to fetch only entries where the customer name matches oldName
      const entriesQuery = query(collection(db, "entries"), where(`${fieldType}.name`, "==", oldName));
      const entriesSnapshot = await getDocs(entriesQuery);
      const updates = [];

      for (const entryDoc of entriesSnapshot.docs) {
        const entryId = entryDoc.id;
        const docRef = doc(db, "entries", entryId);
        // Update all customer fields in the entry
        updates.push(updateDoc(docRef, { 
          [fieldType]: {
            ...newData,
            // Ensure email arrays are properly formatted
            customerEmail: newData.customerEmail || [],
            salesPersonEmail: newData.salesPersonEmail || []
          }
        }));
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        toast.success(`Entries synced for ${fieldType}: ${oldName} ➔ ${newData.name}`);
      } else {
        toast.info("No matching entries found to update.");
      }
    } catch (error) {
      console.error("Error syncing entries:", error);
      toast.error(`Failed to sync entries for ${fieldType}: ${error.message}`);
    }
  };

  const getCurrentMasterOption = () => {
    return masterOptions.find(option => option.value === selectedMaster) || {};
  };

  const getFieldsForMaster = () => {
    return fieldDefinitions[selectedMaster] || [];
  };

  // Helper function to get the sorted index for rendering
  const getSortedIndex = (item) => {
    const key = selectedMaster === 'equipmentType' ? 'type' : 'name';
    return sortedMasterList.findIndex(sortedItem => sortedItem[key] === item[key]);
  };

  return (
    <div className="container-fluid py-4" style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
    }}>
      <style>{`
        .master-selector-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          padding: 2rem;
          border: 1px solid #e9ecef;
          margin-bottom: 2rem;
        }
        
        .master-option {
          display: flex;
          align-items: center;
          padding: 1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
        }
        
        .master-option:hover {
          border-color: #0d6efd;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .master-option.selected {
          border-color: var(--color);
          background: rgba(13, 110, 253, 0.05);
        }
        
        .master-icon {
          font-size: 2rem;
          margin-right: 1rem;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(13, 110, 253, 0.1);
        }
        
        .data-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          border: 1px solid #e9ecef;
          overflow: hidden;
        }
        
        .data-header {
          padding: 1.5rem 2rem;
          border-bottom: 2px solid #e9ecef;
          background: #f8f9fa;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
        
        .btn {
          font-weight: 600;
          border-radius: 8px;
          padding: 0.75rem 1.5rem;
          transition: all 0.2s ease;
        }
        
        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        
        .btn:disabled {
          transform: none;
        }
        
        .table-container {
          max-height: 600px;
          overflow-y: auto;
          position: relative;
        }
        
        .grid-table {
          margin-bottom: 0;
          border-collapse: separate;
          border-spacing: 0;
        }
        
        .grid-table th {
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-bottom: 2px solid #adb5bd;
          color: #495057;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.8rem;
          letter-spacing: 0.5px;
          padding: 1rem 0.75rem;
          position: sticky;
          top: 0;
          z-index: 5;
          vertical-align: middle;
        }
        
        .grid-table th:first-child {
          border-left: 1px solid #dee2e6;
        }
        
        .grid-table th:last-child {
          border-right: 1px solid #dee2e6;
        }
        
        .grid-table td {
          vertical-align: middle;
          border: 1px solid #dee2e6;
          padding: 0.75rem;
          background-color: white;
        }
        
        .grid-table tbody tr:hover td {
          background-color: #f8f9fa;
        }
        
        .grid-table tbody tr:nth-child(even) td {
          background-color: #fafafa;
        }
        
        .grid-table tbody tr:nth-child(even):hover td {
          background-color: #f0f0f0;
        }
        
        .stats-card {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border: 1px solid #e9ecef;
        }
        
        .stats-number {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }
        
        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        
        .action-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        
        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .edit-btn {
          background-color: #f8f9fa;
          color: #6c757d;
          border: 1px solid #dee2e6;
        }
        
        .edit-btn:hover:not(:disabled) {
          background-color: #e9ecef;
          color: #495057;
        }
        
        .delete-btn {
          background-color: #f8f9fa;
          color: #dc3545;
          border: 1px solid #dee2e6;
        }
        
        .delete-btn:hover:not(:disabled) {
          background-color: #f5c2c7;
          color: #842029;
        }
        
        .save-btn {
          background-color: #d1edff;
          color: #0c63e4;
          border: 1px solid #b8daff;
        }
        
        .save-btn:hover:not(:disabled) {
          background-color: #9ec5fe;
          color: #084298;
        }
        
        .cancel-btn {
          background-color: #f8f9fa;
          color: #6c757d;
          border: 1px solid #dee2e6;
        }
        
        .cancel-btn:hover:not(:disabled) {
          background-color: #e9ecef;
          color: #495057;
        }
        
        .empty-state {
          text-align: center;
          padding: 3rem 2rem;
          color: #6c757d;
        }
        
        .empty-state-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }
        
        .add-form-container {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-top: 2px solid #dee2e6;
          padding: 1.5rem;
          position: sticky;
          top: 120px;
          z-index: 8;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .form-control-sm {
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        
        .form-control-sm:focus {
          border-color: #0d6efd;
          box-shadow: 0 0 0 0.15rem rgba(13, 110, 253, 0.1);
        }
      `}</style>

      <div className="container">
        <div className="row mb-4">
          <div className="col-12">
            <h1 className="display-6 mb-2" style={{ color: '#2c3e50', fontWeight: '700' }}>
              Master Data Manager
            </h1>
            <p className="text-muted">Manage and edit your master data efficiently</p>
          </div>
        </div>

        <div className="master-selector-card">
          <h5 className="mb-4">Select Master Data Type</h5>
          <div className="row">
            {masterOptions.map((option) => (
              <div className="col-lg-3 col-md-4 col-sm-6" key={option.value}>
                <div
                  className={`master-option ${selectedMaster === option.value ? 'selected' : ''}`}
                  style={{ '--color': option.color }}
                  onClick={() => setSelectedMaster(option.value)}
                >
                  <div className="master-icon" style={{ backgroundColor: `${option.color}15`, color: option.color }}>
                    {option.icon}
                  </div>
                  <div>
                    <div className="fw-semibold">{option.label}</div>
                    <small className="text-muted">
                      {fieldDefinitions[option.value]?.length || 0} fields
                    </small>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedMaster && (
          <div className="data-container">
            <div className="data-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <span 
                  className="me-3" 
                  style={{ 
                    fontSize: '1.5rem',
                    color: getCurrentMasterOption()?.color 
                  }}
                >
                  {getCurrentMasterOption()?.icon}
                </span>
                <div>
                  <h5 className="mb-0">{getCurrentMasterOption()?.label} Management</h5>
                  <small className="text-muted">
                    {masterList.length} record{masterList.length !== 1 ? 's' : ''} found
                  </small>
                </div>
              </div>
              <div className="d-flex gap-2">
                <div className="stats-card">
                  <div className="stats-number" style={{ color: getCurrentMasterOption()?.color }}>
                    {masterList.length}
                  </div>
                  <small>Total Records</small>
                </div>
                <button
                  className="btn text-white"
                  style={{ 
                    backgroundColor: getCurrentMasterOption()?.color,
                    borderColor: getCurrentMasterOption()?.color
                  }}
                  onClick={() => setShowAddForm(!showAddForm)}
                  disabled={isLoading}
                >
                  {showAddForm ? "Cancel" : "Add New"}
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="add-form-container">
                <h6 className="mb-3">Add New {getCurrentMasterOption()?.label}</h6>
                <div className="row g-3">
                  {getFieldsForMaster().map((field) => (
                    <div className="col-md-4" key={field.key}>
                      <label className="form-label">
                        {field.label}
                        {field.required && <span className="text-danger ms-1">*</span>}
                      </label>
                      <input
                        type={field.key.includes("Email") ? "text" : "text"}
                        className="form-control"
                        placeholder={`Enter ${field.label.toLowerCase()}${field.key.includes("Email") ? " (comma-separated)" : ""}`}
                        value={newEntry[field.key] || ""}
                        onChange={(e) => handleNewEntryChange(field.key, e.target.value)}
                      />
                    </div>
                  ))}
                  <div className="col-12">
                    <button
                      className="btn btn-success me-2"
                      onClick={handleAddNewEntry}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Adding...
                        </>
                      ) : (
                        "Add Entry"
                      )}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="table-container">
              {isLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-3"></div>
                  <p className="text-muted">Loading data...</p>
                </div>
              ) : masterList.length > 0 ? (
                <table className="grid-table table">
                  <thead>
                    <tr>
                      {getFieldsForMaster().map((field) => (
                        <th key={field.key}>{field.label}</th>
                      ))}
                      <th style={{ width: '150px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMasterList.map((item, sortedIndex) => {
                      const actualIndex = masterList.findIndex(masterItem => {
                        const key = selectedMaster === 'equipmentType' ? 'type' : 'name';
                        return masterItem[key] === item[key];
                      });
                      const isEditing = editIndex === actualIndex;

                      return (
                        <tr key={sortedIndex}>
                          {getFieldsForMaster().map((field) => (
                            <td key={field.key}>
                              {isEditing ? (
                                <input
                                  type={field.key.includes("Email") ? "text" : "text"}
                                  className="form-control form-control-sm"
                                  value={editData[field.key] || ""}
                                  onChange={(e) => handleChange(field.key, e.target.value)}
                                />
                              ) : (
                                // Vessel fallback: show string in Name column, blank in Flag if entry is a string
                                selectedMaster === 'vessel' && typeof item === 'string' ? (
                                  field.key === 'name' ? <span>{item}</span> : <span></span>
                                ) : (
                                  // Vessel fallback: show JSON if missing field (for legacy/other cases)
                                  selectedMaster === 'vessel' && !item[field.key] ? (
                                    <span style={{ color: 'red', fontSize: '0.8em' }}>{JSON.stringify(item)}</span>
                                  ) : (
                                    <span>
                                      {field.key.includes("Email")
                                        ? (item[field.key] || []).join(", ")
                                        : item[field.key] || ""}
                                    </span>
                                  )
                                )
                              )}
                            </td>
                          ))}
                          <td>
                            <div className="d-flex gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    className="action-btn save-btn"
                                    onClick={() => handleSave(actualIndex)}
                                    disabled={isLoading}
                                    title="Save changes"
                                  >
                                    {isLoading ? (
                                      <div className="spinner-border" style={{ width: '12px', height: '12px' }}></div>
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                        <polyline points="17,21 17,13 7,13 7,21"/>
                                        <polyline points="7,3 7,8 15,8"/>
                                      </svg>
                                    )}
                                  </button>
                                  <button
                                    className="action-btn cancel-btn"
                                    onClick={() => setEditIndex(null)}
                                    title="Cancel editing"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="18" y1="6" x2="6" y2="18"/>
                                      <line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="action-btn edit-btn"
                                    onClick={() => handleEdit(sortedIndex)}
                                    disabled={isLoading}
                                    title="Edit this entry"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                  <button
                                    className="action-btn delete-btn"
                                    onClick={() => handleDelete(sortedIndex)}
                                    disabled={isLoading}
                                    title="Delete this entry"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3,6 5,6 21,6"/>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                      <line x1="10" y1="11" x2="10" y2="17"/>
                                      <line x1="14" y1="11" x2="14" y2="17"/>
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">{getCurrentMasterOption()?.icon}</div>
                  <h5>No {getCurrentMasterOption()?.label} Records Found</h5>
                  <p className="text-muted">Start by adding your first {getCurrentMasterOption()?.label.toLowerCase()} entry.</p>
                  <button
                    className="btn text-white"
                    style={{ 
                      backgroundColor: getCurrentMasterOption()?.color,
                      borderColor: getCurrentMasterOption()?.color
                    }}
                    onClick={() => setShowAddForm(true)}
                  >
                    Add First Entry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedMaster && (
          <div className="text-center py-5">
            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }}>📊</div>
            <h5 className="text-muted">Select a master data type to begin</h5>
            <p className="text-muted">Choose from the options above to view and manage your data</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MasterDataManager;