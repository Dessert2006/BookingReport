import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { DataGrid } from "@mui/x-data-grid";
import { TextField, Checkbox } from "@mui/material";
import { toast } from "react-toastify";

function Entries() {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fpodMaster, setFpodMaster] = useState([]); // <-- New

  useEffect(() => {
    const fetchEntries = async () => {
      const querySnapshot = await getDocs(collection(db, "entries"));
      const entryList = [];
      querySnapshot.forEach((docSnap) => {
        const entryData = { ...docSnap.data(), id: docSnap.id };
        entryList.push({
          ...entryData,
          shipper: entryData.shipper?.name || entryData.shipper || "",
          line: entryData.line?.name || entryData.line || "",
          pol: entryData.pol?.name || entryData.pol || "",
          pod: entryData.pod?.name || entryData.pod || "",
          fpod: entryData.fpod?.name || entryData.fpod || "",
          vessel: entryData.vessel?.name || entryData.vessel || "",
          equipmentType: entryData.equipmentType?.type || entryData.equipmentType || "",
          isfSent: entryData.isfSent || false, // <-- Default false if not available
        });
      });

      setEntries(entryList);
      setFilteredEntries(entryList);
    };

    const fetchFpodMaster = async () => {
      const docRef = doc(db, "newMaster", "fpod");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFpodMaster(docSnap.data().list || []);
      }
    };

    fetchEntries();
    fetchFpodMaster(); // <-- Fetch master FPODs
  }, []);

  const handleCheckboxEdit = async (id, field, value) => {
    await handleUpdateFirestore(id, field, value);
  };

  const handleTextEditCommit = async (params) => {
    const { id, field, value } = params;
    await handleUpdateFirestore(id, field, value);
  };

  const handleUpdateFirestore = async (id, field, value) => {
    const updatedEntries = entries.map((entry) =>
      entry.id === id ? { ...entry, [field]: value } : entry
    );
    setEntries(updatedEntries);
    setFilteredEntries(updatedEntries);

    const docRef = doc(db, "entries", id);
    try {
      await updateDoc(docRef, { [field]: value });
      toast.success(`${field} updated successfully!`);
    } catch (error) {
      console.error("Error updating document: ", error);
      toast.error("Failed to update entry.");
    }
  };

  const handleSearch = (event) => {
    const value = event.target.value.toLowerCase();
    setSearchQuery(value);
    if (value === "") {
      setFilteredEntries(entries);
    } else {
      const filtered = entries.filter((entry) =>
        Object.values(entry).some(
          (val) => typeof val === "string" && val.toLowerCase().includes(value)
        )
      );
      setFilteredEntries(filtered);
    }
  };

  const booleanFields = [
    "vgmFiled", 
    "siFiled", 
    "firstPrinted", 
    "correctionsFinalised", 
    "blReleased",
    "isfSent" // <-- Add here so checkbox renders
  ];

  // Create columns dynamically
  const columns = Object.keys(entryFields).map((key) => ({
    field: key,
    headerName: entryFields[key],
    width: 150,
    editable: !booleanFields.includes(key),
    renderCell: (params) => {
      if (booleanFields.includes(key)) {
        return (
          <Checkbox
            checked={!!params.row[key]}
            onChange={(e) => handleCheckboxEdit(params.row.id, key, e.target.checked)}
            color="primary"
          />
        );
      }
      return params.value || "";
    }
  }));

  // Conditionally add ISF SENT checkbox column
  if (fpodMaster.length > 0) {
    columns.push({
      field: "isfSent",
      headerName: "ISF SENT",
      width: 150,
      editable: true,
      renderCell: (params) => {
        const entryFpod = params.row.fpod;
        const matchingFpod = fpodMaster.find((fpod) => fpod.name === entryFpod);

        // Show checkbox only if FPOD country is USA
        if (matchingFpod && matchingFpod.country === "USA") {
          return (
            <Checkbox
              checked={!!params.row.isfSent}
              onChange={(e) =>
                handleCheckboxEdit(params.row.id, "isfSent", e.target.checked)
              }
              color="primary"
            />
          );
        } else {
          return null; // Empty cell for non-USA
        }
      }
    });
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4 text-center">Booking Entries</h2>

      {/* Search Bar */}
      <div className="mb-3">
        <TextField
          label="Search..."
          variant="outlined"
          fullWidth
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      <div style={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={filteredEntries}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[5, 10, 20]}
          checkboxSelection
          disableSelectionOnClick
          onCellEditCommit={handleTextEditCommit}
        />
      </div>
    </div>
  );
}

const entryFields = {
  bookingDate: "Booking Date",
  shipper: "Shipper",
  bookingValidity: "Booking Validity",
  line: "Line",
  bookingNo: "Booking No",
  pol: "POL",
  pod: "POD",
  fpod: "FPOD",
  containerNo: "Container No",
  volume: "Volume",
  vessel: "Vessel",
  voyage: "Voyage",
  portCutOff: "Port CutOff",
  siCutOff: "SI CutOff",
  etd: "ETD",
  vgmFiled: "VGM Filed",
  siFiled: "SI Filed",
  firstPrinted: "First Printed",
  correctionsFinalised: "Corrections Finalised",
  blReleased: "B/L - Released",
  // "isfSent": "ISF SENT" // <-- DO NOT define here, handled dynamically
};

export default Entries;
