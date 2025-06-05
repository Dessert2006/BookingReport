import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore"; // ✅ updateDoc added
import { DataGrid } from "@mui/x-data-grid";
import { TextField, FormControlLabel, Checkbox } from "@mui/material";

function CompletedFiles() {
  const [completedEntries, setCompletedEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [locations, setLocations] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);

  // Function to format dates from YYYY-MM-DD to DD-MM-YYYY
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  };

  useEffect(() => {
    const fetchCompletedEntries = async () => {
      const querySnapshot = await getDocs(collection(db, "completedFiles"));
      const entryList = [];
      const locationSet = new Set();
      querySnapshot.forEach((docSnap) => {
        const entryData = { ...docSnap.data(), id: docSnap.id };
        entryList.push({
          ...entryData,
          location: entryData.location?.name || entryData.location || "",
          shipper: entryData.shipper?.name || entryData.shipper || "",
          line: entryData.line?.name || entryData.line || "",
          pol: entryData.pol?.name || entryData.pol || "",
          pod: entryData.pod?.name || entryData.pod || "",
          fpod: entryData.fpod?.name || entryData.fpod || "",
          vessel: entryData.vessel?.name || entryData.vessel || "",
          equipmentType: entryData.equipmentType?.type || entryData.equipmentType || "",
          isfSent: entryData.isfSent || false,
          sob: entryData.sob || false,
          sobDate: entryData.sobDate || "",
          finalDG: entryData.finalDG || false,
          blNo: entryData.blNo || "",
          invoiceNo: entryData.invoiceNo || "" // 👈 include invoiceNo
        });
        if (entryData.location) {
          locationSet.add(entryData.location);
        }
      });

      setCompletedEntries(entryList);
      setFilteredEntries(entryList);
      setLocations([...locationSet]);
    };

    fetchCompletedEntries();
  }, []);

  const handleSearch = (event) => {
    const value = event.target.value.toLowerCase();
    setSearchQuery(value);
    applyFilters(completedEntries, value, selectedLocations);
  };

  const handleLocationFilter = (location, checked) => {
    const newSelectedLocations = checked
      ? [...selectedLocations, location]
      : selectedLocations.filter((loc) => loc !== location);
    setSelectedLocations(newSelectedLocations);
    applyFilters(completedEntries, searchQuery, newSelectedLocations);
  };

  const applyFilters = (data, search, locations) => {
    let filtered = data;

    if (search) {
      filtered = filtered.filter((entry) =>
        Object.values(entry).some(
          (val) => typeof val === "string" && val.toLowerCase().includes(search)
        )
      );
    }

    if (locations.length > 0) {
      filtered = filtered.filter((entry) => locations.includes(entry.location));
    }

    setFilteredEntries(filtered);
  };

  const booleanFields = [
    "vgmFiled",
    "siFiled",
    "firstPrinted",
    "correctionsFinalised",
    "blReleased",
    "isfSent",
    "sob", // Added SOB
    "finalDG" // Added FINAL DG
  ];

  const columns = [
    {
      field: "location",
      headerName: "Location",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    ...Object.keys(entryFields).map((key) => {
      const isBooleanField = booleanFields.includes(key);
      const isDateField = ["bookingDate", "bookingValidity", "etd"].includes(key);
      return {
        field: key,
        headerName: entryFields[key],
        width: 150,
        renderCell: (params) => {
          if (isBooleanField) {
            return (
              <Checkbox
                checked={!!params.row[key]}
                disabled={true}
                color="primary"
              />
            );
          }
          if (isDateField) {
            return formatDate(params.value) || "";
          }
          return params.value || "";
        }
      };
    })
  ];

  // Insert "FINAL DG" column after "SI FILED"
  const siFiledIndex = columns.findIndex((col) => col.field === "siFiled");
  if (siFiledIndex !== -1) {
    columns.splice(siFiledIndex + 1, 0, {
      field: "finalDG",
      headerName: "FINAL DG",
      width: 150,
      renderCell: (params) => {
        const volume = params.row.volume || "";
        if (volume.toUpperCase().includes("HAZ")) {
          return (
            <Checkbox
              checked={!!params.row.finalDG}
              disabled={true}
              color="primary"
            />
          );
        } else {
          return null;
        }
      }
    });
  }

  // Insert "ISF SENT" and "SOB" columns after "FIRST PRINTED"
  const firstPrintedIndex = columns.findIndex((col) => col.field === "firstPrinted");
  if (firstPrintedIndex !== -1) {
    columns.splice(firstPrintedIndex + 1, 0, {
      field: "isfSent",
      headerName: "ISF SENT",
      width: 150,
      renderCell: (params) => {
        const entryFpod = params.row.fpod || "";
        const isUSA = entryFpod.toUpperCase().includes("USA");
        if (isUSA) {
          return (
            <Checkbox
              checked={!!params.row.isfSent}
              disabled={true}
              color="primary"
            />
          );
        } else {
          return null;
        }
      }
    });

    // Insert "SOB" column after "ISF SENT"
    columns.splice(firstPrintedIndex + 2, 0, {
      field: "sob",
      headerName: "SOB",
      width: 150,
      renderCell: (params) => (
        <Checkbox
          checked={!!params.row.sob}
          disabled={true}
          color="primary"
        />
      )
    });

    // Insert "SOB Date" column after "SOB"
    columns.splice(firstPrintedIndex + 3, 0, {
      field: "sobDate",
      headerName: "SOB Date",
      width: 150,
      renderCell: (params) => formatDate(params.value) || ""
    });
  }

  columns.push({
    field: "blNo",
    headerName: "BL No",
    width: 200
  });

  // ✅ Make Invoice No editable
  columns.push({
    field: "invoiceNo",
    headerName: "Invoice No",
    width: 220,
    editable: true,
    renderCell: (params) => params.value || ""
  });

  // ✅ Handle processRowUpdate (Invoice No formatting)
  const handleProcessRowUpdate = async (newRow, oldRow) => {
    try {
      const docRef = doc(db, "completedFiles", newRow.id);
      const updateData = { ...newRow };

      if (newRow.invoiceNo !== oldRow.invoiceNo) {
        const userInput = newRow.invoiceNo.trim();
        if (userInput) {
          updateData.invoiceNo = `DMS/${userInput}/25-26`;
        }
      }

      delete updateData.id; // Firestore doesn't want 'id' in the doc

      await updateDoc(docRef, updateData);

      // Update local state
      const updatedEntries = completedEntries.map((entry) =>
        entry.id === newRow.id ? { ...newRow, invoiceNo: updateData.invoiceNo } : entry
      );
      setCompletedEntries(updatedEntries);
      applyFilters(updatedEntries, searchQuery, selectedLocations);

      return { ...newRow, invoiceNo: updateData.invoiceNo };
    } catch (error) {
      console.error("Error updating document: ", error);
      throw error;
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4 text-center">Completed Files</h2>

      <div className="mb-3">
        <TextField
          label="Search..."
          variant="outlined"
          fullWidth
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Filter by Location:</label>
        <div>
          {locations.map((location) => (
            <FormControlLabel
              key={location}
              control={
                <Checkbox
                  checked={selectedLocations.includes(location)}
                  onChange={(e) => handleLocationFilter(location, e.target.checked)}
                  color="primary"
                />
              }
              label={location}
            />
          ))}
        </div>
      </div>

      <div style={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={filteredEntries}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[5, 10, 20]}
          checkboxSelection
          disableSelectionOnClick
          processRowUpdate={handleProcessRowUpdate} // ✅ attach handler
          onProcessRowUpdateError={(error) => console.error(error)} // handle errors
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
};

export default CompletedFiles;
