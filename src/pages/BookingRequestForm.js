import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, setDoc, arrayUnion } from "firebase/firestore";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import Select from "react-select";

// Utility to safely parse and format dates
const formatDate = (dateValue) => {
  if (!dateValue) {
    // If date is missing, return today's date as a fallback
    return new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  }

  // Handle Firestore Timestamp
  if (dateValue && typeof dateValue.toDate === "function") {
    return dateValue.toDate().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  }

  // Handle string, Date object, or other formats
  let date;
  if (typeof dateValue === "string") {
    // Try parsing common formats
    date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      // Try parsing YYYY-MM-DD explicitly
      const parts = dateValue.split('-');
      if (parts.length === 3) {
        date = new Date(parts[0], parts[1] - 1, parts[2]); // Month is 0-based
      }
    }
  } else {
    date = new Date(dateValue);
  }

  if (isNaN(date.getTime())) {
    console.warn(`Invalid date value: ${JSON.stringify(dateValue)}`);
    // Fallback to today's date if parsing fails
    return new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  }
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
};

function BookingRequestForm() {
  const [formData, setFormData] = useState({
    location: "",
    reqDate: "",
    customer: "",
    shipper: "",
    pol: "",
    pod: "",
    equipmentType: "",
    cargo: "",
    cargoWt: "",
    line: "",
    sqRa: "",
    vessel: "",
    etd: "",
    remarks: "",
    bookingReference: "",
    bookingNo: ""
  });
  const [masterData, setMasterData] = useState({
    location: [],
    customer: [],
    pol: [],
    pod: [],
    equipmentType: [],
    line: [],
    vessel: []
  });
  const [modalData, setModalData] = useState({
    location: { name: "" },
    customer: { name: "" },
    pol: { name: "" },
    pod: { name: "" },
    equipmentType: { type: "" },
    line: { name: "" },
    vessel: { name: "" }
  });
  const [errors, setErrors] = useState({});
  const [requests, setRequests] = useState([]);
  const [showGrid, setShowGrid] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingGrid, setIsFetchingGrid] = useState(false);

  // Fetch master data
  useEffect(() => {
    const fetchMasterData = async () => {
      const masterFields = ["location", "customer", "pol", "pod", "equipmentType", "line", "vessel"];
      let newMasterData = { location: [], customer: [], pol: [], pod: [], equipmentType: [], line: [], vessel: [] };
      for (let field of masterFields) {
        const docRef = doc(db, "newMaster", field);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          newMasterData[field] = (docSnap.data().list || []).map(item =>
            field === "customer" ? item.name : (item.name || item.type || item || "")
          );
        }
      }
      setMasterData(newMasterData);
    };
    fetchMasterData();
  }, []);

  // Fetch booking requests
  const fetchRequests = async () => {
    setIsFetchingGrid(true);
    try {
      const querySnapshot = await getDocs(collection(db, "bookingRequests"));
      const requestList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Log the raw reqDate and etd values to debug
        console.log(`Document ID: ${doc.id}, reqDate: ${JSON.stringify(data.reqDate)}, etd: ${JSON.stringify(data.etd)}`);
        return {
          id: doc.id,
          ...data
        };
      });
      setRequests(requestList);
    } catch (error) {
      console.error("Error fetching booking requests:", error);
      toast.error("Failed to fetch booking requests.");
    } finally {
      setIsFetchingGrid(false);
    }
  };

  // Handle form input changes
  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value || "" }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    // Added reqDate to mandatory fields
    const mandatoryFields = ["location", "reqDate", "customer", "pol", "pod", "equipmentType", "line", "sqRa"];
    mandatoryFields.forEach(field => {
      if (!formData[field]) {
        newErrors[field] = `${fieldLabels[field]} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill all mandatory fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Normalize dates to ISO string (YYYY-MM-DD)
      const normalizedData = {
        ...formData,
        reqDate: formData.reqDate ? new Date(formData.reqDate).toISOString().split('T')[0] : "",
        etd: formData.etd ? new Date(formData.etd).toISOString().split('T')[0] : ""
      };
      await addDoc(collection(db, "bookingRequests"), normalizedData);
      toast.success("Booking request added successfully!");

      // Reset form
      setFormData({
        location: "",
        reqDate: "",
        customer: "",
        shipper: "",
        pol: "",
        pod: "",
        equipmentType: "",
        cargo: "",
        cargoWt: "",
        line: "",
        sqRa: "",
        vessel: "",
        etd: "",
        remarks: "",
        bookingReference: "",
        bookingNo: ""
      });
      setErrors({});
      if (showGrid) {
        await fetchRequests();
      }
    } catch (error) {
      console.error("Error adding booking request:", error);
      toast.error("Failed to add booking request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle grid view
  const handleShowRequests = async () => {
    if (!showGrid) {
      await fetchRequests();
    }
    setShowGrid(prev => !prev);
  };

  // Export to Excel
  const exportToExcel = () => {
    const rowsToExport = selectedRows.length > 0
      ? requests.filter(request => selectedRows.includes(request.id))
      : requests;

    const exportData = rowsToExport.map(request => {
      const row = {};
      columns.forEach(column => {
        if (column.field === "reqDate" || column.field === "etd") {
          row[column.headerName] = formatDate(request[column.field]);
        } else {
          row[column.headerName] = request[column.field] || "";
        }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Booking Requests");
    XLSX.writeFile(workbook, "booking_requests.xlsx");
  };

  // DataGrid columns
  const columns = [
    {
      field: "bookingNo",
      headerName: "Booking No",
      width: 120,
      editable: true,
      renderCell: (params) => params.value || "N/A"
    },
    {
      field: "location",
      headerName: "Location",
      width: 120,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.location
    },
    {
      field: "reqDate",
      headerName: "Req Date",
      width: 120,
      editable: true,
      type: "date",
      valueFormatter: ({ value }) => formatDate(value),
      valueParser: (value) => value ? new Date(value).toISOString().split('T')[0] : ""
    },
    {
      field: "customer",
      headerName: "Customer",
      width: 120,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.customer
    },
    {
      field: "shipper",
      headerName: "Shipper",
      width: 120,
      editable: true
    },
    {
      field: "pol",
      headerName: "POL",
      width: 120,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.pol
    },
    {
      field: "pod",
      headerName: "POD",
      width: 120,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.pod
    },
    {
      field: "equipmentType",
      headerName: "Equipment Type",
      width: 120,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.equipmentType
    },
    {
      field: "cargo",
      headerName: "Cargo",
      width: 120,
      editable: true
    },
    {
      field: "cargoWt",
      headerName: "Cargo Wt",
      width: 120,
      editable: true
    },
    {
      field: "line",
      headerName: "Line",
      width: 120,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.line
    },
    {
      field: "sqRa",
      headerName: "SQ/RA",
      width: 120,
      editable: true
    },
    {
      field: "vessel",
      headerName: "Vessel",
      width: 120,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.vessel
    },
    {
      field: "etd",
      headerName: "ETD",
      width: 120,
      editable: true,
      type: "date",
      valueFormatter: ({ value }) => formatDate(value),
      valueParser: (value) => value ? new Date(value).toISOString().split('T')[0] : ""
    },
    {
      field: "remarks",
      headerName: "Remarks",
      width: 150,
      editable: true
    },
    {
      field: "bookingReference",
      headerName: "Booking Reference",
      width: 120,
      editable: true
    }
  ];

  // Modal handling for adding new master data
  const openModal = (field) => {
    const modal = document.getElementById(`${field}Modal`);
    if (modal) {
      modal.classList.add('show');
      modal.style.display = 'block';
      document.body.classList.add('modal-open');
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      document.body.appendChild(backdrop);
    }
  };

  const closeModal = (field) => {
    const modal = document.getElementById(`${field}Modal`);
    if (modal) {
      modal.classList.remove('show');
      modal.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.remove();
    }
  };

  const handleModalInputChange = (field, subfield, value) => {
    setModalData({
      ...modalData,
      [field]: { ...modalData[field], [subfield]: value.toUpperCase() }
    });
  };

  const handleAddToMaster = async (field) => {
    const data = modalData[field];
    const key = field === "equipmentType" ? "type" : "name";
    if (!data[key].trim()) {
      toast.error(`Please enter a ${key} for ${field}.`);
      return;
    }

    const docRef = doc(db, "newMaster", field);
    const docSnap = await getDoc(docRef);
    let currentList = [];
    if (docSnap.exists()) {
      currentList = docSnap.data().list || [];
    }

    const isDuplicate = currentList.some(item => (item.name || item.type) === data[key]);
    if (!isDuplicate) {
      const newEntry = field === "equipmentType" ? { type: data.type } : { name: data.name };
      if (docSnap.exists()) {
        await updateDoc(docRef, {
          list: arrayUnion(newEntry)
        });
      } else {
        await setDoc(docRef, {
          list: [newEntry]
        });
      }
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} added successfully!`);
      setFormData({ ...formData, [field]: data[key].toUpperCase() });

      // Refresh master data
      const masterFields = ["location", "customer", "pol", "pod", "equipmentType", "line", "vessel"];
      let newMasterData = { location: [], customer: [], pol: [], pod: [], equipmentType: [], line: [], vessel: [] };
      for (let f of masterFields) {
        const docRef = doc(db, "newMaster", f);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          newMasterData[f] = (docSnap.data().list || []).map(item =>
            f === "customer" ? item.name : (item.name || item.type || item || "")
          );
        }
      }
      setMasterData(newMasterData);
    } else {
      toast.warn(`${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`);
    }

    setModalData({
      ...modalData,
      [field]: { [key]: "" }
    });
    closeModal(field);
  };

  const handleModalClose = (field) => {
    const key = field === "equipmentType" ? "type" : "name";
    setModalData({
      ...modalData,
      [field]: { [key]: "" }
    });
    closeModal(field);
  };

  // Create a Select component for dropdown fields
  const createSelect = (field, optionsList) => {
    const options = [
      { label: `Add a ${field}`, value: "add_new" },
      ...optionsList.map(s => ({ label: s, value: s }))
    ];

    const selectedOption = options.find(option => option.value === formData[field]);

    return (
      <div className="d-flex align-items-center">
        <div className="flex-grow-1">
          <Select
            options={options}
            value={
              selectedOption ||
              (formData[field] ? { label: formData[field], value: formData[field] } : null)
            }
            onChange={(selected) => {
              if (selected && selected.value === "add_new") {
                openModal(field);
              } else {
                handleChange(field, selected ? selected.value : "");
              }
            }}
            onInputChange={(inputValue, { action }) => {
              if (action === "input-change") {
                handleChange(field, inputValue);
              }
            }}
            isClearable
            placeholder={`Type or select ${field}...`}
          />
        </div>
        <button
          type="button"
          className="btn btn-success ms-2"
          onClick={() => openModal(field)}
        >
          +
        </button>

        <div
          className="modal fade"
          id={`${field}Modal`}
          tabIndex="-1"
          aria-labelledby={`${field}ModalLabel`}
          aria-hidden="true"
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id={`${field}ModalLabel`}>
                  Add {field.charAt(0).toUpperCase() + field.slice(1)}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => handleModalClose(field)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">
                    {field === "equipmentType" ? "Equipment Type" : `${field.charAt(0).toUpperCase() + field.slice(1)} Name`}{" "}
                    <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={`Enter ${field === "equipmentType" ? "equipment type" : field}`}
                    value={field === "equipmentType" ? modalData[field].type : modalData[field].name}
                    onChange={(e) => handleModalInputChange(field, field === "equipmentType" ? "type" : "name", e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleModalClose(field)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAddToMaster(field)}
                >
                  Save {field.charAt(0).toUpperCase() + field.slice(1)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* Form Section */}
      <h2 className="mb-4">Booking Request Form</h2>
      <form className="row g-3">
        <div className="col-md-4">
          <label>
            Location <span className="text-danger">*</span>
          </label>
          {createSelect("location", masterData.location)}
          {errors.location && (
            <small className="text-danger">{errors.location}</small>
          )}
        </div>
        <div className="col-md-4">
          <label>
            Req Date <span className="text-danger">*</span>
          </label>
          <input
            type="date"
            className="form-control"
            value={formData.reqDate}
            onChange={(e) => handleChange("reqDate", e.target.value)}
          />
          {errors.reqDate && (
            <small className="text-danger">{errors.reqDate}</small>
          )}
        </div>
        <div className="col-md-4">
          <label>
            Customer <span className="text-danger">*</span>
          </label>
          {createSelect("customer", masterData.customer)}
          {errors.customer && (
            <small className="text-danger">{errors.customer}</small>
          )}
        </div>
        <div className="col-md-4">
          <label>Shipper</label>
          <input
            type="text"
            className="form-control"
            value={formData.shipper}
            onChange={(e) => handleChange("shipper", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>
            POL <span className="text-danger">*</span>
          </label>
          {createSelect("pol", masterData.pol)}
          {errors.pol && (
            <small className="text-danger">{errors.pol}</small>
          )}
        </div>
        <div className="col-md-4">
          <label>
            POD <span className="text-danger">*</span>
          </label>
          {createSelect("pod", masterData.pod)}
          {errors.pod && (
            <small className="text-danger">{errors.pod}</small>
          )}
        </div>
        <div className="col-md-4">
          <label>
            Equipment Type <span className="text-danger">*</span>
          </label>
          {createSelect("equipmentType", masterData.equipmentType)}
          {errors.equipmentType && (
            <small className="text-danger">{errors.equipmentType}</small>
          )}
        </div>
        <div className="col-md-4">
          <label>Cargo</label>
          <input
            type="text"
            className="form-control"
            value={formData.cargo}
            onChange={(e) => handleChange("cargo", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>Cargo Wt</label>
          <input
            type="text"
            className="form-control"
            value={formData.cargoWt}
            onChange={(e) => handleChange("cargoWt", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>
            Line <span className="text-danger">*</span>
          </label>
          {createSelect("line", masterData.line)}
          {errors.line && (
            <small className="text-danger">{errors.line}</small>
          )}
        </div>
        <div className="col-md-4">
          <label>
            SQ/RA <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="form-control"
            value={formData.sqRa}
            onChange={(e) => handleChange("sqRa", e.target.value)}
          />
          {errors.sqRa && (
            <small className="text-danger">{errors.sqRa}</small>
          )}
        </div>
        <div className="col-md-4">
          <label>Vessel</label>
          {createSelect("vessel", masterData.vessel)}
        </div>
        <div className="col-md-4">
          <label>ETD</label>
          <input
            type="date"
            className="form-control"
            value={formData.etd}
            onChange={(e) => handleChange("etd", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>Remarks</label>
          <input
            type="text"
            className="form-control"
            value={formData.remarks}
            onChange={(e) => handleChange("remarks", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>Booking Reference</label>
          <input
            type="text"
            className="form-control"
            value={formData.bookingReference}
            onChange={(e) => handleChange("bookingReference", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>Booking No</label>
          <input
            type="text"
            className="form-control"
            value={formData.bookingNo}
            onChange={(e) => handleChange("bookingNo", e.target.value)}
          />
        </div>
        <div className="col-12 mt-3">
          <button
            className="btn btn-primary me-2"
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Adding..." : "➕ Add Request"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleShowRequests}
          >
            {showGrid ? "Hide Requests" : "Show Requests"}
          </button>
        </div>
      </form>

      {/* Grid Section */}
      <div className="mt-5">
        <h2 className="mb-4">Booking Requests</h2>
        {showGrid && (
          isFetchingGrid ? (
            <div className="text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div style={{ height: 400, width: "100%" }}>
              <DataGrid
                rows={requests}
                columns={columns}
                pageSize={10}
                rowsPerPageOptions={[5, 10, 20]}
                checkboxSelection
                disableSelectionOnClick
                onSelectionModelChange={(newSelection) => setSelectedRows(newSelection)}
                components={{
                  Toolbar: () => (
                    <div className="d-flex justify-content-between align-items-center p-2">
                      <GridToolbar />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={exportToExcel}
                      >
                        Export to Excel
                      </button>
                    </div>
                  ),
                }}
                initialState={{
                  pinnedColumns: { left: ["bookingNo"] },
                }}
                sx={{ borderRadius: 1, fontSize: "0.75rem" }}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

const fieldLabels = {
  location: "Location",
  customer: "Customer",
  pol: "POL",
  pod: "POD",
  equipmentType: "Equipment Type",
  line: "Line",
  sqRa: "SQ/RA",
  shipper: "Shipper",
  cargo: "Cargo",
  cargoWt: "Cargo Wt",
  vessel: "Vessel",
  etd: "ETD",
  remarks: "Remarks",
  bookingReference: "Booking Reference",
  bookingNo: "Booking No",
  reqDate: "Req Date",
};

export default BookingRequestForm;