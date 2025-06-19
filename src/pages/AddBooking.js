import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDoc, doc, updateDoc, setDoc, arrayUnion, getDocs, query, where } from "firebase/firestore";
import Select from "react-select";
import { toast } from "react-toastify";
import { getDefaultAuditFields } from "../utils/audit";
import { getAuth } from "firebase/auth";

function AddBooking({ auth }) {
  const [newEntry, setNewEntry] = useState({
    location: "",
    bookingDate: "",
    customer: "",
    bookingValidity: "",
    line: "",
    bookingNo: "",
    referenceNo: "", // Optional Reference NO
    pol: "",
    pod: "",
    fpod: "",
    equipmentDetails: [],
    vessel: "",
    voyage: "",
    portCutOff: "",
    siCutOff: "",
    etd: "",
    isNominated: false // <-- Add nomination field
  });

  const [masterData, setMasterData] = useState({
    locations: [],
    customers: [],
    lines: [],
    pols: [],
    pods: [],
    fpods: [],
    vessels: [],
    equipmentTypes: []
  });

  const [modalData, setModalData] = useState({
    location: { name: "" },
    customer: { name: "", contactPerson: "", customerEmail: [], contactNumber: "", address: "", salesPerson: "", salesPersonEmail: [] },
    line: { name: "", contactPerson: "", email: "", contactNumber: "" },
    pol: { name: "" },
    pod: { name: "" },
    fpod: { name: "", country: "" },
    vessel: { name: "", flag: "" },
    equipmentType: { type: "" }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState([]);

  const fieldDefinitions = {
    location: [{ label: "Location Name", key: "name", required: true }],
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

  const fetchMasterData = async () => {
    const masterFields = ["location", "customer", "line", "pol", "pod", "fpod", "vessel", "equipmentType"];
    let newMasterData = {
      locations: [],
      customers: [],
      lines: [],
      pols: [],
      pods: [],
      fpods: [],
      vessels: [],
      equipmentTypes: []
    };
    for (let field of masterFields) {
      const docRef = doc(db, "newMaster", field);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        newMasterData[field + (field === "equipmentType" ? "s" : "s")] = 
          (docSnap.data().list || []).map(item => {
            if (field === "fpod") {
              return `${item.name}, ${item.country}`;
            } else {
              return item.name || item.type || item || "";
            }
          });
      }
    }
    setMasterData(newMasterData);
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    const fetchCustomers = async () => {
      const customerSnapshot = await getDocs(collection(db, "customers"));
      setCustomers(customerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCustomers();
  }, []);

  const formatCutOffInput = (value) => {
    if (!value) return "";
    const numericValue = value.replace(/[^0-9]/g, "");
    if (numericValue.length === 8) {
      const day = numericValue.substring(0, 2);
      const month = numericValue.substring(2, 4);
      const hour = numericValue.substring(4, 6);
      const minute = numericValue.substring(6, 8);
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);

      if (
        dayNum >= 1 && dayNum <= 31 &&
        monthNum >= 1 && monthNum <= 12 &&
        hourNum >= 0 && hourNum <= 23 &&
        minuteNum >= 0 && minuteNum <= 59
      ) {
        return `${day}/${month}-${hour}${minute} HRS`;
      } else {
        toast.error("Invalid date or time. Please enter a valid DDMMHHMM (e.g., 06061800 for 06/06-1800 HRS)");
        return value;
      }
    }
    return numericValue;
  };

  const handleCutOffChange = (field, value) => {
    const formattedValue = formatCutOffInput(value.toUpperCase());
    setNewEntry({ ...newEntry, [field]: formattedValue });
  };

  const handleModalInputChange = (field, subfield, value) => {
    if (subfield === "customerEmail" || subfield === "salesPersonEmail") {
      const emailArray = value.split(",").map(email => email.trim().toUpperCase()).filter(email => email);
      setModalData({
        ...modalData,
        [field]: { ...modalData[field], [subfield]: emailArray }
      });
    } else {
      setModalData({
        ...modalData,
        [field]: { ...modalData[field], [subfield]: value.toUpperCase() }
      });
    }
  };

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

  const handleAddToMaster = async (field) => {
    const data = modalData[field];
    const requiredFields = fieldDefinitions[field].filter(f => f.required).map(f => f.key);
    if (!requiredFields.every(key => Array.isArray(data[key]) ? data[key].length > 0 : data[key].trim())) {
      toast.error(`Please enter all required fields for ${field}.`);
      return;
    }

    if (field === "customer") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (data.customerEmail.some(email => email && !emailRegex.test(email))) {
        toast.error("Please enter valid customer email addresses.");
        return;
      }
      if (data.salesPersonEmail.some(email => email && !emailRegex.test(email))) {
        toast.error("Please enter valid sales person email addresses.");
        return;
      }
    }

    const docRef = doc(db, "newMaster", field);
    const docSnap = await getDoc(docRef);
    let currentList = [];
    if (docSnap.exists()) {
      currentList = docSnap.data().list || [];
    }

    const isDuplicate = currentList.some(item => {
      if (field === "customer") {
        return item.name === data.name &&
               item.contactPerson === data.contactPerson &&
               JSON.stringify(item.customerEmail) === JSON.stringify(data.customerEmail) &&
               item.contactNumber === data.contactNumber &&
               item.address === data.address &&
               item.salesPerson === data.salesPerson &&
               JSON.stringify(item.salesPersonEmail) === JSON.stringify(data.salesPersonEmail);
      } else if (field === "fpod") {
        return item.name === data.name && item.country === data.country;
      } else if (field === "vessel") {
        return item.name === data.name && item.flag === data.flag;
      } else if (field === "equipmentType") {
        return item.type === data.type;
      } else {
        return item.name === data.name;
      }
    });

    if (!isDuplicate) {
      if (docSnap.exists()) {
        await updateDoc(docRef, {
          list: arrayUnion(data)
        });
      } else {
        await setDoc(docRef, {
          list: [data]
        });
      }
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} added successfully!`);
      if (field === "equipmentType") {
        setNewEntry({
          ...newEntry,
          equipmentDetails: [
            ...newEntry.equipmentDetails,
            { equipmentType: data.type.toUpperCase(), qty: "1", containerNo: "" }
          ]
        });
      } else {
        setNewEntry({ ...newEntry, [field]: (data.name || data.type).toUpperCase() });
      }
      await fetchMasterData();
    } else {
      toast.warn(`${field.charAt(0).toUpperCase() + field.slice(1)} with these details already exists.`);
    }

    setModalData({
      ...modalData,
      [field]: Object.fromEntries(
        Object.keys(data).map(key => [key, Array.isArray(data[key]) ? [] : ""])
      )
    });

    closeModal(field);
  };

  const handleModalClose = (field) => {
    setModalData({
      ...modalData,
      [field]: Object.fromEntries(
        Object.keys(modalData[field]).map(key => [key, Array.isArray(modalData[field][key]) ? [] : ""])
      )
    });
    closeModal(field);
  };

  const checkBookingNoExists = async (bookingNo) => {
    const q = query(collection(db, "entries"), where("bookingNo", "==", bookingNo));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  const handleAddEntry = async () => {
    if (
      newEntry.location &&
      newEntry.customer &&
      newEntry.line &&
      newEntry.pol &&
      newEntry.pod &&
      newEntry.fpod &&
      newEntry.vessel &&
      newEntry.equipmentDetails.length > 0 &&
      newEntry.bookingNo
    ) {
      setIsSubmitting(true);
      try {
        const bookingNoExists = await checkBookingNoExists(newEntry.bookingNo);
        if (bookingNoExists) {
          toast.error("Booking No already exists. Cannot proceed.");
          return;
        }

        const cutOffRegex = /^\d{2}\/\d{2}-\d{4} HRS$/;
        if (newEntry.portCutOff && !cutOffRegex.test(newEntry.portCutOff)) {
          toast.error("Port CutOff must be in the format DD/MM-HHMM HRS (e.g., 06/06-1800 HRS)");
          return;
        }
        if (newEntry.siCutOff && !cutOffRegex.test(newEntry.siCutOff)) {
          toast.error("SI CutOff must be in the format DD/MM-HHMM HRS (e.g., 06/06-1800 HRS)");
          return;
        }

        for (const detail of newEntry.equipmentDetails) {
          const numericQty = parseInt(detail.qty, 10);
          if (isNaN(numericQty) || numericQty <= 0) {
            toast.error(`Quantity for ${detail.equipmentType} must be a positive number greater than 0.`);
            return;
          }
          if (!detail.equipmentType) {
            toast.error("Equipment Type is required for all entries.");
            return;
          }
        }

        // Ensure each equipment detail has containerNo (default to empty string if missing)
        const equipmentDetailsWithContainerNo = newEntry.equipmentDetails.map(detail => ({
          equipmentType: detail.equipmentType,
          qty: detail.qty,
          containerNo: detail.containerNo !== undefined ? detail.containerNo : ""
        }));

        const finalVolume = equipmentDetailsWithContainerNo
          .map(detail => `${detail.qty} x ${detail.equipmentType}`)
          .join(", ");
        const username = auth?.username || "Unknown";
        const auditFields = getDefaultAuditFields(username);

        const entryData = {
          ...newEntry, 
          equipmentDetails: equipmentDetailsWithContainerNo, 
          volume: finalVolume,
          vgmFiled: false,
          siFiled: false,
          finalDG: false,
          firstPrinted: false,
          isfSent: false,
          sob: false,
          sobDate: "",
          correctionsFinalised: false,
          blReleased: false,
          blNo: "",
          poNo: "",
          remarks: "",
          isNominated: newEntry.isNominated,
          ...auditFields
        };

        await addDoc(collection(db, "entries"), entryData);

        await confirmAndAddToMaster("location", { name: newEntry.location });
        await confirmAndAddToMaster("customer", { 
          name: newEntry.customer, 
          contactPerson: "", 
          customerEmail: [], 
          contactNumber: "", 
          address: "", 
          salesPerson: "", 
          salesPersonEmail: [] 
        });
        await confirmAndAddToMaster("line", { name: newEntry.line });
        await confirmAndAddToMaster("pol", { name: newEntry.pol });
        await confirmAndAddToMaster("pod", { name: newEntry.pod });
        await confirmAndAddToMaster("fpod", { name: newEntry.fpod });
        await confirmAndAddToMaster("vessel", { name: newEntry.vessel });
        for (const detail of newEntry.equipmentDetails) {
          await confirmAndAddToMaster("equipmentType", { type: detail.equipmentType });
        }

        toast.success("🎉 Booking Entry Added Successfully!");

        setNewEntry({
          location: "",
          bookingDate: "",
          customer: "",
          bookingValidity: "",
          line: "",
          bookingNo: "",
          referenceNo: "",
          pol: "",
          pod: "",
          fpod: "",
          equipmentDetails: [],
          vessel: "",
          voyage: "",
          portCutOff: "",
          siCutOff: "",
          etd: "",
          isNominated: false // <-- reset nomination
        });
      } catch (error) {
        toast.error("Failed to add booking entry. Please try again.");
        console.error("Error adding entry:", error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      toast.error("Please fill all required fields!");
    }
  };

  const confirmAndAddToMaster = async (field, data) => {
    if (!data.name && !data.type) return;

    const docRef = doc(db, "newMaster", field);
    const docSnap = await getDoc(docRef);

    let currentList = [];
    if (docSnap.exists()) {
      currentList = docSnap.data().list || [];
    }

    if (!currentList.some(item => item.name === data.name || item.type === data.type)) {
      const confirmAdd = window.confirm(
        `${data.name || data.type} not found in Master ${field.toUpperCase()}. Do you want to add it?`
      );
      if (confirmAdd) {
        if (docSnap.exists()) {
          await updateDoc(docRef, {
            list: arrayUnion(data)
          });
        } else {
          await setDoc(docRef, {
            list: [data]
          });
        }
        await fetchMasterData();
      }
    }
  };

  const handleChange = (field, value) => {
    if (field === "bookingDate" || field === "bookingValidity" || field === "etd") {
      setNewEntry({ ...newEntry, [field]: value });
    } else {
      setNewEntry({ ...newEntry, [field]: value.toUpperCase() });
    }
  };

  const handleEquipmentDetailChange = (index, key, value) => {
    const updatedDetails = [...newEntry.equipmentDetails];
    if (key === "qty") {
      const numericValue = parseInt(value, 10);
      if (isNaN(numericValue) || numericValue <= 0) {
        updatedDetails[index] = { ...updatedDetails[index], [key]: "1" };
        if (value !== "") {
          toast.error(`Quantity for ${updatedDetails[index].equipmentType || "equipment"} must be a positive number greater than 0.`);
        }
      } else {
        updatedDetails[index] = { ...updatedDetails[index], [key]: numericValue.toString() };
      }
    } else {
      updatedDetails[index] = { ...updatedDetails[index], [key]: value.toUpperCase() };
    }
    setNewEntry({ ...newEntry, equipmentDetails: updatedDetails });
  };

  const addEquipmentDetail = () => {
    setNewEntry({
      ...newEntry,
      equipmentDetails: [...newEntry.equipmentDetails, { equipmentType: "", qty: "1", containerNo: "" }]
    });
  };

  const removeEquipmentDetail = (index) => {
    const updatedDetails = newEntry.equipmentDetails.filter((_, i) => i !== index);
    setNewEntry({ ...newEntry, equipmentDetails: updatedDetails });
  };

  const createSelect = (field, optionsList) => {
    const isEquipmentType = field === "equipmentType";
    const options = [
      { label: `➕ Add New ${field.charAt(0).toUpperCase() + field.slice(1)}`, value: "add_new" },
      ...optionsList.map(s => ({ label: s, value: s }))
    ];

    const customSelectStyles = {
      control: (provided, state) => ({
        ...provided,
        borderColor: state.isFocused ? '#0d6efd' : '#ced4da',
        boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(13, 110, 253, 0.25)' : 'none',
        borderRadius: '8px',
        minHeight: '42px',
        '&:hover': {
          borderColor: '#0d6efd'
        }
      }),
      option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#f8f9fa' : 'white',
        color: state.isSelected ? 'white' : '#212529',
        fontSize: '14px',
        padding: '10px 12px'
      }),
      placeholder: (provided) => ({
        ...provided,
        color: '#6c757d',
        fontSize: '14px'
      }),
      singleValue: (provided) => ({
        ...provided,
        fontSize: '14px'
      })
    };

    if (isEquipmentType) {
      return (
        <div className="equipment-section">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0" style={{ color: '#495057', fontWeight: '600' }}>Equipment Details</h6>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={addEquipmentDetail}
              style={{ borderRadius: '20px', fontSize: '12px', padding: '6px 16px' }}
            >
              ➕ Add Equipment
            </button>
          </div>
          
          {newEntry.equipmentDetails.length === 0 && (
            <div className="text-center py-4" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px dashed #dee2e6' }}>
              <p className="text-muted mb-2">No equipment added yet</p>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={addEquipmentDetail}
                style={{ borderRadius: '20px' }}
              >
                ➕ Add Your First Equipment
              </button>
            </div>
          )}

          {newEntry.equipmentDetails.map((detail, index) => (
            <div key={index} className="equipment-row mb-3 p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
              <div className="row g-2 align-items-center">
                <div className="col-md-5">
                  <label className="form-label text-muted" style={{ fontSize: '12px', fontWeight: '600' }}>Equipment Type</label>
                  <Select
                    options={options}
                    value={options.find(option => option.value === detail.equipmentType) || 
                           (detail.equipmentType ? { label: detail.equipmentType, value: detail.equipmentType } : null)}
                    onChange={(selected) => {
                      if (selected && selected.value === "add_new") {
                        openModal(field);
                      } else {
                        handleEquipmentDetailChange(index, "equipmentType", selected ? selected.value : "");
                      }
                    }}
                    onInputChange={(inputValue, { action }) => {
                      if (action === "input-change") {
                        handleEquipmentDetailChange(index, "equipmentType", inputValue);
                      }
                    }}
                    onBlur={() => {
                      const validOptions = optionsList.map(opt => opt.toUpperCase());
                      if (!validOptions.includes((detail.equipmentType || '').toUpperCase())) {
                        handleEquipmentDetailChange(index, "equipmentType", "");
                        toast.warn("Please select a valid equipment type from the list.");
                      }
                    }}
                    isClearable
                    placeholder="Select or type equipment..."
                    styles={customSelectStyles}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label text-muted" style={{ fontSize: '12px', fontWeight: '600' }}>Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    style={{ borderRadius: '8px', minHeight: '42px' }}
                    value={detail.qty}
                    onChange={(e) => handleEquipmentDetailChange(index, "qty", e.target.value)}
                    min="1"
                    step="1"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted" style={{ fontSize: '12px', fontWeight: '600' }}>Container No</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ borderRadius: '8px', minHeight: '42px' }}
                    value={detail.containerNo}
                    onChange={(e) => handleEquipmentDetailChange(index, "containerNo", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="col-md-1">
                  <label className="form-label" style={{ fontSize: '12px', visibility: 'hidden' }}>Action</label>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm w-100"
                    onClick={() => removeEquipmentDetail(index)}
                    style={{ borderRadius: '8px', minHeight: '42px' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {/* Modal for Equipment Type */}
          <div className="modal fade" id={`${field}Modal`} tabIndex="-1" aria-labelledby={`${field}ModalLabel`} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content" style={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid #e9ecef', borderRadius: '16px 16px 0 0' }}>
                  <h5 className="modal-title" id={`${field}ModalLabel`} style={{ fontWeight: '600', color: '#495057' }}>
                    ➕ Add New {field.charAt(0).toUpperCase() + field.slice(1)}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => handleModalClose(field)} aria-label="Close"></button>
                </div>
                <div className="modal-body" style={{ padding: '24px' }}>
                  {fieldDefinitions[field].map(({ label, key, type = "text", required }) => (
                    <div className="mb-3" key={key}>
                      <label className="form-label" style={{ fontWeight: '600', color: '#495057' }}>
                        {label} {required && <span className="text-danger">*</span>}
                      </label>
                      <input
                        type={type}
                        className="form-control"
                        style={{ borderRadius: '8px', minHeight: '42px' }}
                        placeholder={`Enter ${label}${key.includes("Email") ? " (comma-separated)" : ""}`}
                        value={Array.isArray(modalData[field][key]) ? modalData[field][key].join(", ") : modalData[field][key]}
                        onChange={(e) => handleModalInputChange(field, key, e.target.value)}
                        required={required}
                      />
                    </div>
                  ))}
                </div>
                <div className="modal-footer" style={{ borderTop: '1px solid #e9ecef', padding: '16px 24px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => handleModalClose(field)} style={{ borderRadius: '8px' }}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => handleAddToMaster(field)} style={{ borderRadius: '8px' }}>
                    Save {field.charAt(0).toUpperCase() + field.slice(1)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="select-with-add">
        <div className="d-flex align-items-end gap-2">
          <div className="flex-grow-1">
            <Select
              options={options}
              value={options.find(option => option.value === newEntry[field]) ||
                     (newEntry[field] ? { label: newEntry[field], value: newEntry[field] } : null)}
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
              onBlur={() => handleSelectBlur(field, optionsList)}
              isClearable
              placeholder={`Select or type ${field}...`}
              styles={customSelectStyles}
            />
          </div>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => openModal(field)}
            style={{ borderRadius: '8px', minHeight: '42px', padding: '0 16px' }}
          >
            ➕
          </button>
        </div>

        {/* Modal */}
        <div className="modal fade" id={`${field}Modal`} tabIndex="-1" aria-labelledby={`${field}ModalLabel`} aria-hidden="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid #e9ecef', borderRadius: '16px 16px 0 0' }}>
                <h5 className="modal-title" id={`${field}ModalLabel`} style={{ fontWeight: '600', color: '#495057' }}>
                  ➕ Add New {field.charAt(0).toUpperCase() + field.slice(1)}
                </h5>
                <button type="button" className="btn-close" onClick={() => handleModalClose(field)} aria-label="Close"></button>
              </div>
              <div className="modal-body" style={{ padding: '24px' }}>
                {fieldDefinitions[field].map(({ label, key, type = "text", required }) => (
                  <div className="mb-3" key={key}>
                    <label className="form-label" style={{ fontWeight: '600', color: '#495057' }}>
                      {label} {required && <span className="text-danger">*</span>}
                    </label>
                    <input
                      type={type}
                      className="form-control"
                      style={{ borderRadius: '8px', minHeight: '42px' }}
                      placeholder={`Enter ${label}${key.includes("Email") ? " (comma-separated)" : ""}`}
                      value={Array.isArray(modalData[field][key]) ? modalData[field][key].join(", ") : modalData[field][key]}
                      onChange={(e) => handleModalInputChange(field, key, e.target.value)}
                      required={required}
                    />
                  </div>
                ))}
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e9ecef', padding: '16px 24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => handleModalClose(field)} style={{ borderRadius: '8px' }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={() => handleAddToMaster(field)} style={{ borderRadius: '8px' }}>
                  Save {field.charAt(0).toUpperCase() + field.slice(1)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSelectBlur = (field, optionsList) => {
    // If the current value is not in the options, reset it
    const validOptions = optionsList.map(opt => opt.toUpperCase());
    if (!validOptions.includes((newEntry[field] || '').toUpperCase())) {
      setNewEntry({ ...newEntry, [field]: '' });
      toast.warn(`Please select a valid ${field} from the list.`);
    }
  };

  const handleNominationChange = (e) => {
    setNewEntry({ ...newEntry, isNominated: e.target.checked });
  };

  return (
    <div className="container-fluid py-4">
      <style>{`
        .form-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          border: 1px solid #e9ecef;
        }
        .form-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          border: 1px solid #e9ecef;
        }
        .section-title {
          color: #495057;
          font-weight: 700;
          font-size: 18px;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e9ecef;
        }
        .form-label {
          font-weight: 600;
          color: #495057;
          font-size: 13px;
          margin-bottom: 6px;
        }
        .form-control {
          border-radius: 8px;
          border: 1px solid #ced4da;
          min-height: 42px;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .form-control:focus {
          border-color: #0d6efd;
          box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
        }
        .equipment-section {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e9ecef;
        }
        .equipment-row {
          transition: all 0.2s ease;
        }
        .equipment-row:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .btn {
          border-radius: 8px;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .btn:hover {
          transform: translateY(-1px);
        }
        .main-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 32px;
          box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
        }
        .submit-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          border: 1px solid #e9ecef;
        }
        .required-indicator {
          color: #dc3545;
          font-weight: bold;
        }
        .optional-indicator {
          color: #6c757d;
          font-size: 11px;
          font-style: italic;
        }
      `}</style>

      {/* Header Section */}
      <div className="main-header">
        <div className="row align-items-center">
          <div className="col-md-8">
            <h1 className="mb-2" style={{ fontWeight: '700', fontSize: '28px' }}>
              📋 Add New Booking Entry
            </h1>
            <p className="mb-0 opacity-90" style={{ fontSize: '16px' }}>
              Create a new booking entry with all necessary details
            </p>
          </div>
          <div className="col-md-4 text-end">
            <div className="d-flex justify-content-end gap-2">
              <span className="badge bg-light text-dark px-3 py-2" style={{ fontSize: '12px' }}>
                📊 Form Status: {Object.values(newEntry).filter(v => v && v !== "").length + newEntry.equipmentDetails.length}/15 Fields
              </span>
            </div>
          </div>
        </div>
      </div>

      <form className="booking-form">
        {/* Basic Information Section */}
        <div className="form-section">
          <h3 className="section-title">🏢 Basic Information</h3>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">
                Location <span className="required-indicator">*</span>
              </label>
              <div className="d-flex align-items-center gap-2">
                {createSelect("location", masterData.locations)}
                <div className="form-check ms-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="nominationCheckbox"
                    checked={newEntry.isNominated}
                    onChange={handleNominationChange}
                  />
                  <label className="form-check-label" htmlFor="nominationCheckbox">
                    Nomination
                  </label>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Booking Date <span className="optional-indicator">(Optional)</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={newEntry.bookingDate}
                onChange={(e) => handleChange("bookingDate", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Customer <span className="required-indicator">*</span>
              </label>
              {createSelect("customer", masterData.customers)}
            </div>
          </div>
        </div>

        {/* Booking Details Section */}
        <div className="form-section">
          <h3 className="section-title">📋 Booking Details</h3>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">
                Booking Validity <span className="optional-indicator">(Optional)</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={newEntry.bookingValidity}
                onChange={(e) => handleChange("bookingValidity", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Shipping Line <span className="required-indicator">*</span>
              </label>
              {createSelect("line", masterData.lines)}
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Booking Number <span className="required-indicator">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={newEntry.bookingNo}
                onChange={(e) => handleChange("bookingNo", e.target.value)}
                placeholder="Enter booking number"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Reference NO <span className="optional-indicator">(Optional)</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={newEntry.referenceNo}
                onChange={(e) => handleChange("referenceNo", e.target.value)}
                placeholder="Enter reference number (optional)"
              />
            </div>
          </div>
        </div>

        {/* Port Information Section */}
        <div className="form-section">
          <h3 className="section-title">🚢 Port Information</h3>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">
                Port of Loading (POL) <span className="required-indicator">*</span>
              </label>
              {createSelect("pol", masterData.pols)}
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Port of Discharge (POD) <span className="required-indicator">*</span>
              </label>
              {createSelect("pod", masterData.pods)}
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Final Port of Discharge (FPOD) <span className="required-indicator">*</span>
              </label>
              {createSelect("fpod", masterData.fpods)}
            </div>
          </div>
        </div>

        {/* Equipment Details Section */}
        <div className="form-section">
          <h3 className="section-title">📦 Equipment Details</h3>
          {createSelect("equipmentType", masterData.equipmentTypes)}
        </div>

        {/* Vessel Information Section */}
        <div className="form-section">
          <h3 className="section-title">🚢 Vessel Information</h3>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">
                Vessel Name <span className="required-indicator">*</span>
              </label>
              {createSelect("vessel", masterData.vessels)}
            </div>
            <div className="col-md-6">
              <label className="form-label">
                Voyage Number <span className="optional-indicator">(Optional)</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={newEntry.voyage}
                onChange={(e) => handleChange("voyage", e.target.value)}
                placeholder="Enter voyage number"
              />
            </div>
          </div>
        </div>

        {/* Cut-off Times Section */}
        <div className="form-section">
          <h3 className="section-title">⏰ Cut-off Information</h3>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">
                Port Cut-off <span className="optional-indicator">(DD/MM-HHMM HRS)</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., 06061800 → 06/06-1800 HRS"
                value={newEntry.portCutOff}
                onChange={(e) => handleCutOffChange("portCutOff", e.target.value)}
              />
              <small className="text-muted">Format: DDMMHHMM (e.g., 06061800)</small>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                SI Cut-off <span className="optional-indicator">(DD/MM-HHMM HRS)</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., 06061800 → 06/06-1800 HRS"
                value={newEntry.siCutOff}
                onChange={(e) => handleCutOffChange("siCutOff", e.target.value)}
              />
              <small className="text-muted">Format: DDMMHHMM (e.g., 06061800)</small>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                ETD / Sailing Date <span className="optional-indicator">(Optional)</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={newEntry.etd}
                onChange={(e) => handleChange("etd", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Submit Section */}
        <div className="submit-section">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h5 className="mb-2" style={{ color: '#495057', fontWeight: '600' }}>Ready to Submit?</h5>
              <p className="text-muted mb-0">
                Please ensure all required fields are filled before submitting the booking entry.
              </p>
            </div>
            <div className="col-md-4 text-end">
              <button
                className="btn btn-primary btn-lg px-5"
                type="button"
                onClick={handleAddEntry}
                disabled={isSubmitting}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '700',
                  fontSize: '16px',
                  padding: '12px 32px',
                  boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
                }}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Adding Entry...
                  </>
                ) : (
                  <>
                    ✅ Add Booking Entry
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default AddBooking;