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
    isNominated: false
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

  const normalizeBookingNo = (str) => {
    if (!str) return '';
    return str.toString().toLowerCase().replace(/[^a-z0-9]/gi, '');
  };

  const checkBookingNoExists = async (bookingNo) => {
    if (!bookingNo) return false;
    // Fetch all entries with the same normalized bookingNo
    const q = query(collection(db, "entries"));
    const querySnapshot = await getDocs(q);
    const normalizedInput = normalizeBookingNo(bookingNo);
    return querySnapshot.docs.some(docSnap => normalizeBookingNo(docSnap.data().bookingNo) === normalizedInput);
  };

  const handleBookingNoBlur = async (e) => {
    const bookingNo = e.target.value;
    if (!bookingNo) return;
    const exists = await checkBookingNoExists(bookingNo);
    if (exists) {
      toast.error("Booking No already exists. Please enter a unique Booking No.");
    }
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
          isNominated: false
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
        borderRadius: '6px',
        minHeight: '36px',
        fontSize: '13px',
        padding: '0 5px',
        '&:hover': {
          borderColor: '#0d6efd'
        }
      }),
      option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#f8f9fa' : 'white',
        color: state.isSelected ? 'white' : '#212529',
        fontSize: '13px',
        padding: '8px 10px'
      }),
      placeholder: (provided) => ({
        ...provided,
        color: '#6c757d',
        fontSize: '13px'
      }),
      singleValue: (provided) => ({
        ...provided,
        fontSize: '13px'
      })
    };

    if (isEquipmentType) {
      return (
        <div className="equipment-section">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0" style={{ color: '#495057', fontWeight: '600', fontSize: '14px' }}>Equipment</h6>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={addEquipmentDetail}
              style={{ borderRadius: '6px', fontSize: '12px', padding: '4px 12px' }}
            >
              ➕ Add
            </button>
          </div>
          
          {newEntry.equipmentDetails.length === 0 && (
            <div className="text-center py-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px dashed #dee2e6' }}>
              <p className="text-muted mb-1" style={{ fontSize: '12px' }}>No equipment added</p>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={addEquipmentDetail}
                style={{ borderRadius: '6px', fontSize: '12px' }}
              >
                ➕ Add Equipment
              </button>
            </div>
          )}

          {newEntry.equipmentDetails.map((detail, index) => (
            <div key={index} className="equipment-row mb-2 p-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <div className="row g-2 align-items-center">
                <div className="col-md-5">
                  <label className="form-label text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>Type</label>
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
                    placeholder="Select equipment..."
                    styles={customSelectStyles}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>Qty</label>
                  <input
                    type="number"
                    className="form-control"
                    style={{ borderRadius: '6px', minHeight: '36px', fontSize: '13px' }}
                    value={detail.qty}
                    onChange={(e) => handleEquipmentDetailChange(index, "qty", e.target.value)}
                    min="1"
                    step="1"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted" style={{ fontSize: '11px', fontWeight: '600' }}>Container No</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ borderRadius: '6px', minHeight: '36px', fontSize: '13px' }}
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
                    style={{ borderRadius: '6px', minHeight: '36px', padding: '0' }}
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
              <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 5px 20px rgba(0,0,0,0.1)' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid #e9ecef', borderRadius: '12px 12px 0 0', padding: '12px 16px' }}>
                  <h5 className="modal-title" id={`${field}ModalLabel`} style={{ fontWeight: '600', color: '#495057', fontSize: '16px' }}>
                    ➕ Add New {field.charAt(0).toUpperCase() + field.slice(1)}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => handleModalClose(field)} aria-label="Close"></button>
                </div>
                <div className="modal-body" style={{ padding: '16px' }}>
                  {fieldDefinitions[field].map(({ label, key, type = "text", required }) => (
                    <div className="mb-2" key={key}>
                      <label className="form-label" style={{ fontWeight: '600', color: '#495057', fontSize: '13px' }}>
                        {label} {required && <span className="text-danger">*</span>}
                      </label>
                      <input
                        type={type}
                        className="form-control"
                        style={{ borderRadius: '6px', minHeight: '36px', fontSize: '13px' }}
                        placeholder={`Enter ${label}${key.includes("Email") ? " (comma-separated)" : ""}`}
                        value={Array.isArray(modalData[field][key]) ? modalData[field][key].join(", ") : modalData[field][key]}
                        onChange={(e) => handleModalInputChange(field, key, e.target.value)}
                        required={required}
                      />
                    </div>
                  ))}
                </div>
                <div className="modal-footer" style={{ borderTop: '1px solid #e9ecef', padding: '12px 16px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleModalClose(field)} style={{ borderRadius: '6px' }}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddToMaster(field)} style={{ borderRadius: '6px' }}>
                    Save
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
        <div className="d-flex align-items-center gap-2">
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
              placeholder={`Select ${field}...`}
              styles={customSelectStyles}
            />
          </div>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => openModal(field)}
            style={{ borderRadius: '6px', minHeight: '36px', padding: '0 12px', fontSize: '14px' }}
          >
            ➕
          </button>
        </div>

        {/* Modal */}
        <div className="modal fade" id={`${field}Modal`} tabIndex="-1" aria-labelledby={`${field}ModalLabel`} aria-hidden="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 5px 20px rgba(0,0,0,0.1)' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid #e9ecef', borderRadius: '12px 12px 0 0', padding: '12px 16px' }}>
                <h5 className="modal-title" id={`${field}ModalLabel`} style={{ fontWeight: '600', color: '#495057', fontSize: '16px' }}>
                  ➕ Add New {field.charAt(0).toUpperCase() + field.slice(1)}
                </h5>
                <button type="button" className="btn-close" onClick={() => handleModalClose(field)} aria-label="Close"></button>
              </div>
              <div className="modal-body" style={{ padding: '16px' }}>
                {fieldDefinitions[field].map(({ label, key, type = "text", required }) => (
                  <div className="mb-2" key={key}>
                    <label className="form-label" style={{ fontWeight: '600', color: '#495057', fontSize: '13px' }}>
                      {label} {required && <span className="text-danger">*</span>}
                    </label>
                    <input
                      type={type}
                      className="form-control"
                      style={{ borderRadius: '6px', minHeight: '36px', fontSize: '13px' }}
                      placeholder={`Enter ${label}${key.includes("Email") ? " (comma-separated)" : ""}`}
                      value={Array.isArray(modalData[field][key]) ? modalData[field][key].join(", ") : modalData[field][key]}
                      onChange={(e) => handleModalInputChange(field, key, e.target.value)}
                      required={required}
                    />
                  </div>
                ))}
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e9ecef', padding: '12px 16px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleModalClose(field)} style={{ borderRadius: '6px' }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddToMaster(field)} style={{ borderRadius: '6px' }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSelectBlur = (field, optionsList) => {
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
    <div className="container-fluid py-2">
      <style>{`
        .section-title-compact {
          color: #495057;
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 8px;
          margin-top: 12px;
          padding-bottom: 2px;
          border-bottom: 1px solid #e9ecef;
        }
        .booking-form-compact {
          background: white;
          border-radius: 8px;
          padding: 12px 16px 8px 16px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          border: 1px solid #e9ecef;
          margin-bottom: 0;
        }
        .form-grid-compact {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .form-label-compact {
          font-weight: 500;
          color: #495057;
          font-size: 14px;
          margin-bottom: 3px;
        }
        .form-control-compact, .react-select__control {
          border-radius: 5px;
          border: 1px solid #ced4da;
          min-height: 36px;
          font-size: 15px;
          padding: 5px 10px;
        }
        .equipment-section-compact {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 8px 10px 4px 10px;
          border: 1px solid #e9ecef;
          margin-bottom: 0;
        }
        .submit-btn-compact {
          font-weight: 600;
          padding: 8px 0;
          border-radius: 6px;
          font-size: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          width: 100%;
        }
        .required-indicator {
          color: #dc3545;
          font-weight: bold;
          font-size: 13px;
        }
        @media (max-width: 1200px) {
          .form-grid-compact { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .form-grid-compact { grid-template-columns: 1fr; }
        }
      `}</style>
      <form className="booking-form-compact">
        {/* 🏢 Basic Information */}
        <div className="section-title-compact">🏢 Basic Information</div>
        <div className="form-grid-compact mb-2" style={{gridTemplateColumns: 'repeat(4, 1fr)'}}>
          <div>
            <label className="form-label-compact">Location <span className="required-indicator">*</span></label>
            <div className="d-flex align-items-center gap-2">
              {createSelect("location", masterData.locations)}
              <div className="d-flex align-items-center ms-2">
                <input className="form-check-input me-1" type="checkbox" id="nominationCheckbox" checked={newEntry.isNominated} onChange={handleNominationChange} style={{width:14, height:14}} />
                <label className="form-label-compact mb-0" htmlFor="nominationCheckbox">Nominated</label>
              </div>
            </div>
          </div>
          <div>
            <label className="form-label-compact">Line <span className="required-indicator">*</span></label>
            {createSelect("line", masterData.lines)}
          </div>
          <div>
            <label className="form-label-compact">Customer <span className="required-indicator">*</span></label>
            {createSelect("customer", masterData.customers)}
          </div>
          <div>
            <label className="form-label-compact">Reference</label>
            <input type="text" className="form-control-compact form-control" value={newEntry.referenceNo} onChange={e => handleChange("referenceNo", e.target.value)} placeholder="Reference" />
          </div>
        </div>
        {/* 📋 Booking Details */}
        <div className="section-title-compact">📋 Booking Details</div>
        <div className="form-grid-compact mb-2">
          <div>
            <label className="form-label-compact">Booking No <span className="required-indicator">*</span></label>
            <input type="text" className="form-control-compact form-control" value={newEntry.bookingNo} onChange={e => handleChange("bookingNo", e.target.value)} onBlur={handleBookingNoBlur} placeholder="Booking no" />
          </div>
          <div>
            <label className="form-label-compact">Booking Date</label>
            <input type="date" className="form-control-compact form-control" value={newEntry.bookingDate} onChange={e => handleChange("bookingDate", e.target.value)} />
          </div>
          <div>
            <label className="form-label-compact">Booking Validity</label>
            <input type="date" className="form-control-compact form-control" value={newEntry.bookingValidity} onChange={e => handleChange("bookingValidity", e.target.value)} />
          </div>
          <div></div>
        </div>
        {/* 🚢 Port Information */}
        <div className="section-title-compact">🚢 Port Information</div>
        <div className="form-grid-compact mb-2">
          <div>
            <label className="form-label-compact">POL <span className="required-indicator">*</span></label>
            {createSelect("pol", masterData.pols)}
          </div>
          <div>
            <label className="form-label-compact">POD <span className="required-indicator">*</span></label>
            {createSelect("pod", masterData.pods)}
          </div>
          <div>
            <label className="form-label-compact">FPOD <span className="required-indicator">*</span></label>
            {createSelect("fpod", masterData.fpods)}
          </div>
          <div></div>
        </div>
        {/* 📦 Equipment Details */}
        <div className="section-title-compact">📦 Equipment Details</div>
        <div className="equipment-section-compact mb-2">
          {createSelect("equipmentType", masterData.equipmentTypes)}
        </div>
        {/* 🚢 Vessel & ⏰ Cut-off Information */}
        <div className="section-title-compact">🚢 Vessel & ⏰ Cut-off Information</div>
        <div className="form-grid-compact mb-2" style={{gridTemplateColumns: 'repeat(5, 1fr)'}}>
          <div>
            <label className="form-label-compact">Vessel <span className="required-indicator">*</span></label>
            {createSelect("vessel", masterData.vessels)}
          </div>
          <div style={{maxWidth: '120px'}}>
            <label className="form-label-compact">Voyage</label>
            <input type="text" className="form-control-compact form-control" value={newEntry.voyage} onChange={e => handleChange("voyage", e.target.value)} placeholder="Voyage" style={{width: '100%'}} />
          </div>
          <div>
            <label className="form-label-compact">Port Cut-off</label>
            <input type="text" className="form-control-compact form-control" placeholder="DDMMHHMM → 06/06-1800 HRS" value={newEntry.portCutOff} onChange={e => handleCutOffChange("portCutOff", e.target.value)} />
          </div>
          <div>
            <label className="form-label-compact">SI Cut-off</label>
            <input type="text" className="form-control-compact form-control" placeholder="DDMMHHMM → 06/06-1800 HRS" value={newEntry.siCutOff} onChange={e => handleCutOffChange("siCutOff", e.target.value)} />
          </div>
          <div>
            <label className="form-label-compact">ETD</label>
            <input type="date" className="form-control-compact form-control" value={newEntry.etd} onChange={e => handleChange("etd", e.target.value)} />
          </div>
        </div>
        {/* Submit Button */}
        <div className="row mt-2">
          <div className="col-12">
            <button className="btn btn-primary submit-btn-compact" type="button" onClick={handleAddEntry} disabled={isSubmitting}>
              {isSubmitting ? (<><span className="spinner-border spinner-border-sm me-2" role="status"></span>Adding...</>) : '✅ Add Booking'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default AddBooking;