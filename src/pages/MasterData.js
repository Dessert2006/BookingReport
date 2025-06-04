import React, { useState } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { toast } from 'react-toastify';

function MasterData() {
  const [newMaster, setNewMaster] = useState({
    shipper: { name: "", contactPerson: "", email: "", contactNumber: "", address: "",salesPerson: "" },
    line: { name: "", contactPerson: "", email: "", contactNumber: "" },
    pol: { name: "" },
    pod: { name: "" },
    fpod: { name: "", country: "" },
    vessel: { name: "", flag: "" },
    equipmentType: { type: "" }
  });

  const fieldDefinitions = {
    shipper: [
      { label: "Shipper Name", key: "name", required: true },
      { label: "Contact Person", key: "contactPerson" },
      { label: "Email", key: "email", type: "email" },
      { label: "Contact Number", key: "contactNumber", type: "tel" },
      { label: "Address", key: "address" },
      { label: "Sales Person Name", key: "salesPerson" }
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
    setNewMaster({
      ...newMaster,
      [field]: { ...newMaster[field], [subfield]: value }
    });
  };

  const handleAddSingle = async (field) => {
    const data = newMaster[field];
    const requiredFields = fieldDefinitions[field].filter(f => f.required).map(f => f.key);
    if (!requiredFields.every(key => data[key].trim())) {
      toast.error(`Please enter all required fields for ${field}.`);
      return;
    }

    const added = await addToMaster(field, data);
    if (added) {
      toast.success(`${capitalize(field)} added successfully!`);
      setNewMaster({
        ...newMaster,
        [field]: Object.fromEntries(
          Object.keys(data).map(key => [key, ""])
        )
      });
    }
  };

  const handleAddAll = async () => {
    const filledFields = Object.keys(newMaster).filter(field => 
      fieldDefinitions[field].some(f => newMaster[field][f.key].trim())
    );

    if (filledFields.length === 0) {
      toast.error("Please fill at least one field to add.");
      return;
    }

    let addedCount = 0;
    for (let field of filledFields) {
      const requiredFields = fieldDefinitions[field].filter(f => f.required).map(f => f.key);
      if (requiredFields.every(key => newMaster[field][key].trim())) {
        const added = await addToMaster(field, newMaster[field]);
        if (added) addedCount++;
      }
    }

    if (addedCount > 0) {
      toast.success(`Added ${addedCount} master entr${addedCount > 1 ? "ies" : "y"} successfully!`);
      setNewMaster({
        shipper: { name: "", contactPerson: "", email: "", contactNumber: "", address: "",salesPerson: "" },
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
    const docRef = doc(db, "newMaster", field); // Changed to 'newMaster' collection
    const docSnap = await getDoc(docRef);

    let currentList = [];
    if (docSnap.exists()) {
      currentList = docSnap.data().list || [];
    }

    // Enhanced uniqueness check considering all fields
    const isDuplicate = currentList.some(item => {
      if (field === "shipper" || field === "line") {
        return item.name === data.name &&
               item.contactPerson === data.contactPerson &&
               item.email === data.email &&
               item.contactNumber === data.contactNumber &&
               (field === "shipper" ? item.address === data.address : true);
      } else if (field === "fpod") {
        return item.name === data.name && item.country === data.country;
      } else if (field === "vessel") {
        return item.name === data.name && item.flag === data.flag;
      } else if (field === "equipmentType") {
        return item.type === data.type;
      } else {
        return item.name === data.name; // For pol, pod
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
    Object.values(data).some(value => value.trim())
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
                            placeholder={`Enter ${label}`}
                            value={newMaster[field][key]}
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