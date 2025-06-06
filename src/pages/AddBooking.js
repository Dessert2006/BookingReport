import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDoc, doc, updateDoc, setDoc, arrayUnion, getDocs, query, where } from "firebase/firestore";
import Select from "react-select";
import { toast } from "react-toastify";

function AddBooking() {
  const [newEntry, setNewEntry] = useState({
    location: "",
    bookingDate: "",
    customer: "",
    bookingValidity: "",
    line: "",
    bookingNo: "",
    pol: "",
    pod: "",
    fpod: "",
    containerNo: "",
    qty: "1",
    equipmentType: "",
    vessel: "",
    voyage: "",
    portCutOff: "",
    siCutOff: "",
    etd: ""
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

  const formatCutOffInput = (value) => {
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
      setNewEntry({ ...newEntry, [field]: (data.name || data.type).toUpperCase() });
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
      newEntry.equipmentType &&
      newEntry.bookingNo
    ) {
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

      const numericQty = parseInt(newEntry.qty, 10);
      if (isNaN(numericQty) || numericQty <= 0) {
        toast.error("Quantity must be a positive number greater than 0.");
        setNewEntry({ ...newEntry, qty: "1" });
        return;
      }

      const finalVolume = `${newEntry.qty} x ${newEntry.equipmentType}`;
      const entryData = { ...newEntry, volume: finalVolume };

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
      await confirmAndAddToMaster("equipmentType", { type: newEntry.equipmentType });

      toast.success("Booking Entry Added Successfully!");

      setNewEntry({
        location: "",
        bookingDate: "",
        customer: "",
        bookingValidity: "",
        line: "",
        bookingNo: "",
        pol: "",
        pod: "",
        fpod: "",
        containerNo: "",
        qty: "1",
        equipmentType: "",
        vessel: "",
        voyage: "",
        portCutOff: "",
        siCutOff: "",
        etd: ""
      });
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
    if (field === "qty") {
      setNewEntry({ ...newEntry, qty: value });
    } else if (field === "bookingDate" || field === "bookingValidity" || field === "etd") {
      setNewEntry({ ...newEntry, [field]: value });
    } else {
      setNewEntry({ ...newEntry, [field]: value.toUpperCase() });
    }
  };

  const handleQtyBlur = () => {
    const numericValue = parseInt(newEntry.qty, 10);
    if (isNaN(numericValue) || numericValue <= 0) {
      setNewEntry({ ...newEntry, qty: "1" });
      if (newEntry.qty !== "") {
        toast.error("Quantity must be a positive number greater than 0.");
      }
    } else {
      setNewEntry({ ...newEntry, qty: numericValue.toString() });
    }
  };

  const createSelect = (field, optionsList) => {
    const options = [
      { label: `Add a ${field}`, value: "add_new" },
      ...optionsList.map(s => ({ label: s, value: s }))
    ];

    const selectedOption = options.find(
      (option) => option.value === newEntry[field]
    );

    return (
      <div className="d-flex align-items-center">
        <div className="flex-grow-1">
          <Select
            options={options}
            value={
              selectedOption ||
              (newEntry[field] ? { label: newEntry[field], value: newEntry[field] } : null)
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
                {fieldDefinitions[field].map(({ label, key, type = "text", required }) => (
                  <div className="mb-3" key={key}>
                    <label className="form-label">
                      {label} {required && <span className="text-danger">*</span>}
                    </label>
                    <input
                      type={type}
                      className="form-control"
                      placeholder={`Enter ${label}${key.includes("Email") ? " (comma-separated)" : ""}`}
                      value={Array.isArray(modalData[field][key]) ? modalData[field][key].join(", ") : modalData[field][key]}
                      onChange={(e) => handleModalInputChange(field, key, e.target.value)}
                      required={required}
                    />
                  </div>
                ))}
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
    <div>
      <h2 className="mb-4">Add New Booking Entry</h2>
      <form className="row g-3">
        <div className="col-md-4">
          <label>Location <span className="text-danger">*</span></label>
          {createSelect("location", masterData.locations)}
        </div>
        <div className="col-md-4">
          <label>Booking Date</label>
          <input
            type="date"
            className="form-control"
            value={newEntry.bookingDate}
            onChange={(e) => handleChange("bookingDate", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>Customer</label>
          {createSelect("customer", masterData.customers)}
        </div>
        <div className="col-md-4">
          <label>Booking Validity</label>
          <input
            type="date"
            className="form-control"
            value={newEntry.bookingValidity}
            onChange={(e) => handleChange("bookingValidity", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>Line</label>
          {createSelect("line", masterData.lines)}
        </div>
        <div className="col-md-4">
          <label>Booking No</label>
          <input
            type="text"
            className="form-control"
            value={newEntry.bookingNo}
            onChange={(e) => handleChange("bookingNo", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>POL</label>
          {createSelect("pol", masterData.pols)}
        </div>
        <div className="col-md-4">
          <label>POD</label>
          {createSelect("pod", masterData.pods)}
        </div>
        <div className="col-md-4">
          <label>FPOD</label>
          {createSelect("fpod", masterData.fpods)}
        </div>
        <div className="col-md-4">
          <label>Container No</label>
          <input
            type="text"
            className="form-control"
            value={newEntry.containerNo}
            onChange={(e) => handleChange("containerNo", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>Qty</label>
          <input
            type="number"
            className="form-control"
            value={newEntry.qty}
            onChange={(e) => handleChange("qty", e.target.value)}
            onBlur={handleQtyBlur}
            min="1"
            step="1"
          />
        </div>
        <div className="col-md-4">
          <label>Equipment Type</label>
          {createSelect("equipmentType", masterData.equipmentTypes)}
        </div>
        <div className="col-md-4">
          <label>Vessel</label>
          {createSelect("vessel", masterData.vessels)}
        </div>
        <div className="col-md-4">
          <label>Voyage</label>
          <input
            type="text"
            className="form-control"
            value={newEntry.voyage}
            onChange={(e) => handleChange("voyage", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>Port CutOff (DD/MM-HHMM HRS)</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. 06061800"
            value={newEntry.portCutOff}
            onChange={(e) => handleCutOffChange("portCutOff", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>SI CutOff (DD/MM-HHMM HRS)</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. 06061800"
            value={newEntry.siCutOff}
            onChange={(e) => handleCutOffChange("siCutOff", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <label>ETD / Sailing</label>
          <input
            type="date"
            className="form-control"
            value={newEntry.etd}
            onChange={(e) => handleChange("etd", e.target.value)}
          />
        </div>
        <div className="col-12 mt-3">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleAddEntry}
          >
            ➕ Add Entry
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddBooking;