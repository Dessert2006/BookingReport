import React, { useState } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { toast } from 'react-toastify';

function MasterData() {
  const [newMaster, setNewMaster] = useState({
    customer: { name: "", contactPerson: "", customerEmail: [], contactNumber: "", address: "", salesPerson: "", salesPersonEmail: [] },
    line: { name: "", contactPerson: "", email: "", contactNumber: "" },
    pol: { name: "" },
    pod: { name: "" },
    fpod: { name: "", country: "" },
    vessel: { name: "", flag: "" },
    equipmentType: { type: "" }
  });

  const fieldDefinitions = {
    customer: [
      { label: "customer Name", key: "name", required: true },
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

  const handleInputChange = (field, subfield, value) => {
    if (subfield === "customerEmail" || subfield === "salesPersonEmail") {
      // Split comma-separated emails into an array
      const emailArray = value.split(",").map(email => email.trim()).filter(email => email);
      setNewMaster({
        ...newMaster,
        [field]: { ...newMaster[field], [subfield]: emailArray }
      });
    } else {
      setNewMaster({
        ...newMaster,
        [field]: { ...newMaster[field], [subfield]: value }
      });
    }
  };

  const handleAddSingle = async (field) => {
    const data = newMaster[field];
    const requiredFields = fieldDefinitions[field].filter(f => f.required).map(f => f.key);
    if (!requiredFields.every(key => data[key].trim())) {
      toast.error(`Please enter all required fields for ${field}.`);
      return;
    }

    // Validate email formats for customer
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

    const added = await addToMaster(field, data);
    if (added) {
      toast.success(`${capitalize(field)} added successfully!`);
      setNewMaster({
        ...newMaster,
        [field]: Object.fromEntries(
          Object.keys(data).map(key => [key, key.includes("Email") ? [] : ""])
        )
      });
    }
  };

  const handleAddAll = async () => {
    const filledFields = Object.keys(newMaster).filter(field => 
      fieldDefinitions[field].some(f => 
        f.key.includes("Email") ? newMaster[field][f.key].length > 0 : newMaster[field][f.key].trim()
      )
    );

    if (filledFields.length === 0) {
      toast.error("Please fill at least one field to add.");
      return;
    }

    let addedCount = 0;
    for (let field of filledFields) {
      const requiredFields = fieldDefinitions[field].filter(f => f.required).map(f => f.key);
      if (requiredFields.every(key => newMaster[field][key].trim())) {
        const data = newMaster[field];
        if (field === "customer") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (data.customerEmail.some(email => email && !emailRegex.test(email))) {
            toast.error(`Invalid customer email in ${field}.`);
            continue;
          }
          if (data.salesPersonEmail.some(email => email && !emailRegex.test(email))) {
            toast.error(`Invalid sales person email in ${field}.`);
            continue;
          }
        }
        const added = await addToMaster(field, data);
        if (added) addedCount++;
      }
    }

    if (addedCount > 0) {
      toast.success(`Added ${addedCount} master entr${addedCount > 1 ? "ies" : "y"} successfully!`);
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
      toast.warn("No new entries were added due to duplicates or errors.");
    }
  };

  const addToMaster = async (field, data) => {
    const docRef = doc(db, "newMaster", field);
    const docSnap = await getDoc(docRef);

    let currentList = [];
    if (docSnap.exists()) {
      currentList = docSnap.data().list || [];
    }

    // Enhanced uniqueness check considering all fields
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
        return item.name === data.name; // For line, pol, pod
      }
    });

    if (isDuplicate) {
      toast.warn(`${capitalize(field)} with these details already exists.`);
      return false;
    }

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        list: arrayUnion(data)
      });
    } else {
      await setDoc(docRef, {
        list: [data]
      });
    }
    return true;
  };

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  const isAnyFieldFilled = Object.values(newMaster).some(data => 
    Object.values(data).some(value => 
      Array.isArray(value) ? value.length > 0 : value.trim()
    )
  );

  return (
    <div>
      <h2 className="mb-4">Add New Master Data</h2>
      <div className="row g-4">
        {Object.keys(fieldDefinitions).map((field) => (
          <div className="col-md-4 d-flex align-items-end" key={field}>
            <div className="w-100">
              <button
                type="button"
                className="btn btn-success w-100"
                data-bs-toggle="modal"
                data-bs-target={`#${field}Modal`}
              >
                Add {capitalize(field)}
              </button>

              {/* Modal for each field */}
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
                        Add {capitalize(field)}
                      </h5>
                      <button
                        type="button"
                        className="btn-close"
                        data-bs-dismiss="modal"
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
                            value={Array.isArray(newMaster[field][key]) ? newMaster[field][key].join(", ") : newMaster[field][key]}
                            onChange={(e) => handleInputChange(field, key, e.target.value)}
                            required={required}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        data-bs-dismiss="modal"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleAddSingle(field)}
                        data-bs-dismiss="modal"
                      >
                        Save {capitalize(field)}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MasterData;