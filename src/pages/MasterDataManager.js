import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { getDoc, doc, updateDoc, collection, getDocs } from "firebase/firestore"; // Added getDocs
import Select from "react-select";
import { toast } from "react-toastify";

function MasterDataManager() {
  const [selectedMaster, setSelectedMaster] = useState("");
  const [masterList, setMasterList] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editData, setEditData] = useState({});
  const [newEntry, setNewEntry] = useState({});
  const [oldName, setOldName] = useState(""); // Added: Track Old Name

  const masterOptions = [
    { value: "shipper", label: "Shipper" },
    { value: "line", label: "Line" },
    { value: "pol", label: "POL" },
    { value: "pod", label: "POD" },
    { value: "fpod", label: "FPOD" },
    { value: "vessel", label: "Vessel" },
    { value: "equipmentType", label: "Equipment Type" },
  ];

  const fieldDefinitions = {
    shipper: ["name", "contactPerson", "email", "contactNumber", "address", "salesPerson"],
    line: ["name", "contactPerson", "email", "contactNumber"],
    pol: ["name"],
    pod: ["name"],
    fpod: ["name", "country"],
    vessel: ["name", "flag"],
    equipmentType: ["type"]
  };

  useEffect(() => {
    if (selectedMaster) {
      fetchMasterList(selectedMaster);
    }
  }, [selectedMaster]);

  const fetchMasterList = async (field) => {
    const docRef = doc(db, "newMaster", field);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setMasterList(docSnap.data().list || []);
      setNewEntry({});
    } else {
      setMasterList([]);
      setNewEntry({});
    }
  };

  const handleEdit = (index) => {
    setEditIndex(index);
    setEditData(masterList[index]);
    setOldName(masterList[index].name); // Save old name
  };

  const handleSave = async (index) => {
    const updatedList = [...masterList];
    updatedList[index] = editData;

    const docRef = doc(db, "newMaster", selectedMaster);
    try {
      await updateDoc(docRef, { list: updatedList });
      toast.success("Master data updated successfully!");
      setEditIndex(null);
      setMasterList(updatedList);

      // Trigger sync if name has changed
      if (selectedMaster === "shipper" || selectedMaster === "line") {
        if (oldName && oldName !== editData.name) {
          await syncEntriesWithMaster(oldName, editData.name, selectedMaster);
        }
      }

    } catch (error) {
      console.error("Error updating document: ", error);
      toast.error("Failed to update master data.");
    }
  };

  const handleDelete = async (index) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    const updatedList = [...masterList];
    updatedList.splice(index, 1);

    const docRef = doc(db, "newMaster", selectedMaster);
    try {
      await updateDoc(docRef, { list: updatedList });
      toast.success("Master data deleted successfully!");
      setMasterList(updatedList);
    } catch (error) {
      console.error("Error deleting document: ", error);
      toast.error("Failed to delete master data.");
    }
  };

  const handleChange = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleNewEntryChange = (field, value) => {
    setNewEntry({ ...newEntry, [field]: value });
  };

  const handleAddNewEntry = async () => {
    if (Object.keys(newEntry).length === 0) {
      toast.error("Please enter data before adding.");
      return;
    }

    const updatedList = [...masterList, newEntry];

    const docRef = doc(db, "newMaster", selectedMaster);
    try {
      await updateDoc(docRef, { list: updatedList });
      toast.success("New master data added successfully!");
      setMasterList(updatedList);
      setNewEntry({});
    } catch (error) {
      console.error("Error adding new entry: ", error);
      toast.error("Failed to add new master data.");
    }
  };

  const syncEntriesWithMaster = async (oldName, newName, fieldType) => {
    const entriesSnapshot = await getDocs(collection(db, "entries"));
    const updates = [];

    for (const entryDoc of entriesSnapshot.docs) {
      const entryData = entryDoc.data();
      const entryId = entryDoc.id;

      if (entryData[fieldType] === oldName) {
        const docRef = doc(db, "entries", entryId);
        updates.push(updateDoc(docRef, { [fieldType]: newName }));
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      toast.success(`Entries synced: ${oldName} ➔ ${newName}`);
    } else {
      toast.info("No matching entries found to update.");
    }
  };

  const getFieldOrder = () => {
    return fieldDefinitions[selectedMaster] || [];
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Master Data Manager</h2>
      <div className="mb-3">
        <Select
          options={masterOptions}
          onChange={(selected) => setSelectedMaster(selected.value)}
          placeholder="Select Master Data to Manage"
        />
      </div>

      {selectedMaster && masterList.length > 0 && (
        <>
          <h5>Add New {selectedMaster.toUpperCase()} Entry:</h5>
          <div className="row mb-3">
            {getFieldOrder().map((key) => (
              <div className="col-md-3 mb-2" key={key}>
                <input
                  type="text"
                  className="form-control"
                  placeholder={`Enter ${key}`}
                  value={newEntry[key] || ""}
                  onChange={(e) => handleNewEntryChange(key, e.target.value)}
                />
              </div>
            ))}
            <div className="col-md-2 mb-2">
              <button className="btn btn-success" onClick={handleAddNewEntry}>
                ➕ Add Entry
              </button>
            </div>
          </div>

          <table className="table table-bordered">
            <thead>
              <tr>
                {getFieldOrder().map((key) => (
                  <th key={key}>{key.toUpperCase()}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {masterList.map((item, index) => (
                <tr key={index}>
                  {getFieldOrder().map((key) => (
                    <td key={key}>
                      {editIndex === index ? (
                        <input
                          type="text"
                          className="form-control"
                          value={editData[key] || ""}
                          onChange={(e) => handleChange(key, e.target.value)}
                        />
                      ) : (
                        item[key] || ""
                      )}
                    </td>
                  ))}
                  <td>
                    {editIndex === index ? (
                      <button
                        className="btn btn-success btn-sm me-2"
                        onClick={() => handleSave(index)}
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm me-2"
                        onClick={() => handleEdit(index)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(index)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {selectedMaster && masterList.length === 0 && (
        <p>No master data found for {selectedMaster.toUpperCase()}.</p>
      )}
    </div>
  );
}

export default MasterDataManager;
