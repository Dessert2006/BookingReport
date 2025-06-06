import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, getDoc, addDoc, deleteDoc, query, where } from "firebase/firestore";
import { DataGrid } from "@mui/x-data-grid";
import { TextField, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Button, FormControlLabel, IconButton } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import { toast } from "react-toastify";

// CSS for highlighting rows
const styles = `
  .highlight-row {
    background-color: #FFFF00; /* Light yellow background */
  }
`;

function Entries() {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fpodMaster, setFpodMaster] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [masterData, setMasterData] = useState({
    location: [],
    shipper: [],
    line: [],
    pol: [],
    pod: [],
    fpod: [],
    vessel: [],
    equipmentType: []
  });

  const [openDialog, setOpenDialog] = useState(false); // For BL No dialog
  const [currentRow, setCurrentRow] = useState(null);
  const [blNoInput, setBlNoInput] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rowToComplete, setRowToComplete] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);

  // State for SOB date dialog
  const [sobDialogOpen, setSobDialogOpen] = useState(false);
  const [sobDateInput, setSobDateInput] = useState("");
  const [rowForSob, setRowForSob] = useState(null);

  const formatCutOffInput = (value) => {
    if (!value) return ""; // Return empty string if value is empty

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
        return value; // Return original value if invalid
      }
    }
    return numericValue; // Return partial input if not yet 8 digits
  };

  // Function to format dates from YYYY-MM-DD to DD-MM-YYYY
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  };

  useEffect(() => {
    const fetchEntries = async () => {
      const querySnapshot = await getDocs(collection(db, "entries"));
      const entryList = [];
      const locationSet = new Set();

      // Fetch the shipper master data
      const shipperDoc = await getDoc(doc(db, "newMaster", "shipper"));
      const shipperMasterList = shipperDoc.exists() ? shipperDoc.data().list || [] : [];

      querySnapshot.forEach((docSnap) => {
        const entryData = { ...docSnap.data(), id: docSnap.id };

        // If shipper is a string, look up the full object in shipperMasterList
        let shipperObj = entryData.shipper;
        if (typeof shipperObj === 'string') {
          shipperObj = shipperMasterList.find(item => item.name === shipperObj) || { name: shipperObj, salesPerson: "" };
        }

        entryList.push({
          ...entryData,
          location: entryData.location?.name || entryData.location || "",
          shipper: shipperObj, // Store the full shipper object
          salesPersonName: shipperObj?.salesPerson || "", // Extract salesPerson for column
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
          invoiceNo: ""
        });

        if (entryData.location) {
          locationSet.add(entryData.location);
        }
      });

      setEntries(entryList);
      setFilteredEntries(entryList);
      setLocations([...locationSet]);
    };

    const fetchMasterData = async () => {
      const masterFields = ["location", "shipper", "line", "pol", "pod", "fpod", "vessel", "equipmentType"];
      let newMasterData = {
        location: [],
        shipper: [],
        line: [],
        pol: [],
        pod: [],
        fpod: [],
        vessel: [],
        equipmentType: []
      };
      for (let field of masterFields) {
        const docRef = doc(db, "newMaster", field);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          newMasterData[field] = (docSnap.data().list || []).map(item => 
            field === "fpod" ? `${item.name}, ${item.country}` : 
            field === "shipper" ? item.name : 
            (item.name || item.type || item || "")
          );
        }
      }
      setMasterData(newMasterData);
      setFpodMaster(newMasterData.fpod);
    };

    fetchEntries();
    fetchMasterData();
  }, []);

  const handleProcessRowUpdate = async (newRow, oldRow) => {
    try {
      // Format portCutOff and siCutOff
      const formattedPortCutOff = newRow.portCutOff ? formatCutOffInput(newRow.portCutOff) : newRow.portCutOff;
      const formattedSiCutOff = newRow.siCutOff ? formatCutOffInput(newRow.siCutOff) : newRow.siCutOff;

      // Validate the formatted values
      const cutOffRegex = /^\d{2}\/\d{2}-\d{4} HRS$/;
      if (formattedPortCutOff && !cutOffRegex.test(formattedPortCutOff)) {
        toast.error("Port CutOff must be in the format DD/MM-HHMM HRS (e.g., 06/06-1800 HRS)");
        throw new Error("Invalid Port CutOff format");
      }
      if (formattedSiCutOff && !cutOffRegex.test(formattedSiCutOff)) {
        toast.error("SI CutOff must be in the format DD/MM-HHMM HRS (e.g., 06/06-1800 HRS)");
        throw new Error("Invalid SI CutOff format");
      }

      // Ensure shipper is stored as an object
      let shipperData = newRow.shipper;
      if (typeof newRow.shipper === 'string') {
        const shipperDoc = await getDoc(doc(db, "newMaster", "shipper"));
        shipperData = shipperDoc.data()?.list.find(item => item.name === newRow.shipper) || { name: newRow.shipper };
      }

      const formattedRow = {
        ...newRow,
        portCutOff: formattedPortCutOff,
        siCutOff: formattedSiCutOff,
        shipper: shipperData,
        salesPersonName: shipperData.salesPerson || "" // Update salesPersonName
      };

      // Check if portCutOff or siCutOff has changed
      const portCutOffChanged = oldRow.portCutOff !== formattedPortCutOff;
      const siCutOffChanged = oldRow.siCutOff !== formattedSiCutOff;

      if (portCutOffChanged || siCutOffChanged) {
        // Find other entries with the same vessel, voyage, and pol
        const q = query(
          collection(db, "entries"),
          where("vessel", "==", formattedRow.vessel || ""),
          where("voyage", "==", formattedRow.voyage || ""),
          where("pol", "==", formattedRow.pol || "")
        );
        const querySnapshot = await getDocs(q);

        // Update all matching entries
        const updatedEntries = [...entries];
        const batchUpdates = [];

        querySnapshot.forEach((docSnap) => {
          const entryId = docSnap.id;
          if (entryId !== formattedRow.id) { // Skip the current row
            const updateData = {
              portCutOff: portCutOffChanged ? formattedPortCutOff : docSnap.data().portCutOff,
              siCutOff: siCutOffChanged ? formattedSiCutOff : docSnap.data().siCutOff
            };
            const docRef = doc(db, "entries", entryId);
            batchUpdates.push(updateDoc(docRef, updateData));

            // Update local state
            const entryIndex = updatedEntries.findIndex(entry => entry.id === entryId);
            if (entryIndex !== -1) {
              updatedEntries[entryIndex] = {
                ...updatedEntries[entryIndex],
                ...updateData
              };
            }
          }
        });

        // Update the current row in local state
        const currentRowIndex = updatedEntries.findIndex(entry => entry.id === formattedRow.id);
        if (currentRowIndex !== -1) {
          updatedEntries[currentRowIndex] = formattedRow;
        }

        // Update the current row in Firestore
        const docRef = doc(db, "entries", formattedRow.id);
        const updateData = { ...formattedRow };
        delete updateData.id;
        delete updateData.salesPersonName; // Exclude salesPersonName from Firestore
        batchUpdates.push(updateDoc(docRef, updateData));

        // Execute all updates
        await Promise.all(batchUpdates);

        setEntries(updatedEntries);
        applyFilters(updatedEntries, searchQuery, selectedLocations);
        toast.success("Row(s) updated successfully!");
      } else {
        // If no cut-off changes, update only the current row
        const updatedEntries = entries.map((entry) =>
          entry.id === formattedRow.id ? formattedRow : entry
        );
        setEntries(updatedEntries);
        applyFilters(updatedEntries, searchQuery, selectedLocations);

        const docRef = doc(db, "entries", formattedRow.id);
        const updateData = { ...formattedRow };
        delete updateData.id;
        delete updateData.salesPersonName; // Exclude salesPersonName from Firestore
        await updateDoc(docRef, updateData);
        toast.success("Row updated successfully!");
      }

      return formattedRow;
    } catch (error) {
      console.error("Error updating document: ", error);
      toast.error("Failed to update entry.");
      throw error;
    }
  };

  const handleSearch = (event) => {
    const value = event.target.value.toLowerCase();
    setSearchQuery(value);
    applyFilters(entries, value, selectedLocations);
  };

  const handleLocationFilter = (location, checked) => {
    const newSelectedLocations = checked
      ? [...selectedLocations, location]
      : selectedLocations.filter((loc) => loc !== location);
    setSelectedLocations(newSelectedLocations);
    applyFilters(entries, searchQuery, newSelectedLocations);
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
    "finalDG",
    "firstPrinted",
    "correctionsFinalised",
    "blReleased",
    "isfSent",
    "sob"
  ];

  const prerequisiteFields = [
    "vgmFiled",
    "siFiled",
    "firstPrinted",
    "correctionsFinalised"
  ];

  const masterFields = [
    "location",
    "shipper",
    "line",
    "pol",
    "pod",
    "fpod",
    "vessel",
    "equipmentType"
  ];

  const columns = [
    {
      field: "location",
      headerName: "Location",
      width: 150,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.location,
      renderCell: (params) => params.value || ""
    },
    ...Object.keys(entryFields).map((key) => {
      const isMasterField = masterFields.includes(key);
      const isBooleanField = booleanFields.includes(key);
      const isDateField = ["bookingDate", "bookingValidity", "etd"].includes(key);
      return {
        field: key,
        headerName: entryFields[key],
        width: 150,
        editable: key !== "salesPersonName", // Make salesPersonName read-only
        ...(isMasterField && {
          type: "singleSelect",
          valueOptions: masterData[key],
          valueParser: (value) => {
            if (key === "shipper") {
              return value; // Store name for display, full object handled in handleProcessRowUpdate
            }
            return value;
          },
          renderCell: (params) => params.value.name || params.value || ""
        }),
        ...(isDateField && {
          valueFormatter: ({ value }) => formatDate(value),
          type: "date",
          valueParser: (value) => {
            if (!value) return "";
            const [day, month, year] = value.split("-");
            return `${year}-${month}-${day}`;
          },
        }),
        renderCell: (params) => {
          if (key === "firstPrinted") {
            return (
              <Checkbox
                checked={!!params.row[key]}
                disabled={params.row[key]}
                onChange={(e) => handleCheckboxEdit(params.row, key, e.target.checked)}
                color="primary"
              />
            );
          }
          if (isBooleanField) {
            return (
              <Checkbox
                checked={!!params.row[key]}
                onChange={(e) => handleCheckboxEdit(params.row, key, e.target.checked)}
                color="primary"
              />
            );
          }
          if (isDateField) {
            return formatDate(params.value) || "";
          }
          if (key === "shipper") {
            return params.value.name || params.value || "";
          }
          if (key === "salesPersonName") {
            return params.row.shipper?.salesPerson || "";
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
      editable: true,
      renderCell: (params) => {
        const volume = params.row.volume || "";
        if (volume.toUpperCase().includes("HAZ")) {
          return (
            <Checkbox
              checked={!!params.row.finalDG}
              onChange={(e) =>
                handleCheckboxEdit(params.row, "finalDG", e.target.checked)
              }
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
  if (fpodMaster.length > 0) {
    const firstPrintedIndex = columns.findIndex((col) => col.field === "firstPrinted");
    columns.splice(firstPrintedIndex + 1, 0, {
      field: "isfSent",
      headerName: "ISF SENT",
      width: 150,
      editable: true,
      renderCell: (params) => {
        const entryFpod = params.row.fpod || "";
        const matchingFpod = fpodMaster.find(
          (fpod) => fpod.name?.toUpperCase() === entryFpod.toUpperCase()
        );

        if (
          (matchingFpod && matchingFpod.country?.toUpperCase() === "USA") ||
          entryFpod.toUpperCase().includes("USA")
        ) {
          return (
            <Checkbox
              checked={!!params.row.isfSent}
              onChange={(e) =>
                handleCheckboxEdit(params.row, "isfSent", e.target.checked)
              }
              color="primary"
            />
          );
        } else {
          return null;
        }
      }
    });

    columns.splice(firstPrintedIndex + 2, 0, {
      field: "sob",
      headerName: "SOB",
      width: 150,
      editable: true,
      renderCell: (params) => (
        <Checkbox
          checked={!!params.row.sob}
          onChange={(e) => handleSobCheckbox(params.row, e.target.checked)}
          color="primary"
          disabled={params.row.sob}
        />
      )
    });
  }

  columns.push({
    field: "blNo",
    headerName: "BL No",
    width: 200,
    editable: true
  });

  // Add Delete Action column
  columns.push({
    field: "actions",
    headerName: "Actions",
    width: 100,
    renderCell: (params) => (
      <IconButton
        color="error"
        onClick={() => handleDeleteClick(params.row)}
      >
        <DeleteIcon />
      </IconButton>
    ),
  });

  const handleDeleteClick = (row) => {
    setRowToDelete(row);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!rowToDelete) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "entries", rowToDelete.id));

      // Update local state
      const updatedEntries = entries.filter((entry) => entry.id !== rowToDelete.id);
      setEntries(updatedEntries);
      applyFilters(updatedEntries, searchQuery, selectedLocations);

      toast.success("Entry deleted successfully!");
    } catch (error) {
      console.error("Error deleting entry: ", error);
      toast.error("Failed to delete entry.");
    } finally {
      setRowToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteCancel = () => {
    setRowToDelete(null);
    setDeleteDialogOpen(false);
  };

  const handleSobCheckbox = (row, checked) => {
    if (checked) {
      setRowForSob(row);
      setSobDateInput("");
      setSobDialogOpen(true);
    }
  };

  const handleSobSubmit = async () => {
    if (!sobDateInput) {
      toast.error("Please select a date for SOB.");
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(sobDateInput)) {
      toast.error("Invalid date format. Please use YYYY-MM-DD format.");
      return;
    }

    const formattedSobDate = formatDate(sobDateInput);
    const newRow = { ...rowForSob, sob: true, sobDate: formattedSobDate };
    await handleProcessRowUpdate(newRow, rowForSob);
    setSobDialogOpen(false);
    setRowForSob(null);
    setSobDateInput("");
  };

  const handleSobCancel = () => {
    setSobDialogOpen(false);
    setRowForSob(null);
    setSobDateInput("");
  };

  const handleCheckboxEdit = async (row, field, value) => {
    if (field === "firstPrinted" && value) {
      setCurrentRow(row);
      setOpenDialog(true);
    } else if (field === "blReleased" && value) {
      const fieldsToCheck = [...prerequisiteFields];
      const entryFpod = row.fpod || "";
      const matchingFpod = fpodMaster.find(
        (fpod) => fpod.name?.toUpperCase() === entryFpod.toUpperCase()
      );
      if (
        (matchingFpod && matchingFpod.country?.toUpperCase() === "USA") ||
        entryFpod.toUpperCase().includes("USA")
      ) {
        fieldsToCheck.push("isfSent");
      }

      const allPrerequisitesMet = fieldsToCheck.every(
        (prereqField) => row[prereqField] === true
      );

      if (!allPrerequisitesMet) {
        toast.error("All previous steps must be completed before releasing B/L.");
        return;
      }

      setRowToComplete({ ...row, blReleased: true });
      setConfirmDialogOpen(true);
    } else {
      const newRow = { ...row, [field]: value };
      await handleProcessRowUpdate(newRow, row);
    }
  };

  const handleConfirmComplete = async () => {
    if (!rowToComplete) return;

    try {
      const updatedRow = { ...rowToComplete, blReleased: true };
      const updatedEntries = entries.map((entry) =>
        entry.id === updatedRow.id ? updatedRow : entry
      );
      setEntries(updatedEntries);
      applyFilters(updatedEntries, searchQuery, selectedLocations);

      const entryData = { ...updatedRow };
      delete entryData.id;
      delete entryData.salesPersonName; // Exclude salesPersonName from Firestore
      await addDoc(collection(db, "completedFiles"), entryData);
      await deleteDoc(doc(db, "entries", updatedRow.id));

      const newEntries = entries.filter((entry) => entry.id !== updatedRow.id);
      setEntries(newEntries);
      applyFilters(newEntries, searchQuery, selectedLocations);

      toast.success("Entry marked as B/L Released and moved to Completed Files!");
    } catch (error) {
      console.error("Error completing entry: ", error);
      toast.error("Failed to mark as B/L Released.");
      const revertedEntries = entries.map((entry) =>
        entry.id === rowToComplete.id ? { ...entry, blReleased: false } : entry
      );
      setEntries(revertedEntries);
      applyFilters(revertedEntries, searchQuery, selectedLocations);
    } finally {
      setConfirmDialogOpen(false);
      setRowToComplete(null);
    }
  };

  const handleCancelComplete = () => {
    if (rowToComplete) {
      const updatedEntries = entries.map((entry) =>
        entry.id === rowToComplete.id ? { ...entry, blReleased: false } : entry
      );
      setEntries(updatedEntries);
      applyFilters(updatedEntries, searchQuery, selectedLocations);
    }
    setConfirmDialogOpen(false);
    setRowToComplete(null);
  };

  const handleDialogSubmit = async () => {
    if (blNoInput.trim() === "") {
      toast.error("BL No cannot be empty!");
      return;
    }
    const newRow = { ...currentRow, firstPrinted: true, blNo: blNoInput.trim() };
    await handleProcessRowUpdate(newRow, currentRow);
    setBlNoInput("");
    setCurrentRow(null);
    setOpenDialog(false);
  };

  const handleDialogClose = () => {
    setBlNoInput("");
    setCurrentRow(null);
    setOpenDialog(false);
  };

  // Function to determine row class for highlighting
  const getRowClassName = (params) => {
    const row = params.row;
    return !row.portCutOff && !row.siCutOff ? "highlight-row" : "";
  };

  return (
    <div className="container mt-4">
      <style>{styles}</style>
      <h2 className="mb-4 text-center">Booking Entries</h2>

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
          processRowUpdate={handleProcessRowUpdate}
          onProcessRowUpdateError={(error) => console.error(error)}
          getRowClassName={getRowClassName}
        />
      </div>

      {/* Dialog for BL No */}
      <Dialog open={openDialog} onClose={handleDialogClose}>
        <DialogTitle>Enter BL No</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="BL No"
            type="text"
            fullWidth
            value={blNoInput}
            onChange={(e) => setBlNoInput(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleDialogSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for SOB Date */}
      <Dialog open={sobDialogOpen} onClose={handleSobCancel}>
        <DialogTitle>Enter SOB Date</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="SOB Date"
            type="date"
            fullWidth
            value={sobDateInput}
            onChange={(e) => setSobDateInput(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSobCancel}>Cancel</Button>
          <Button onClick={handleSobSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Confirming B/L Release */}
      <Dialog open={confirmDialogOpen} onClose={handleCancelComplete}>
        <DialogTitle>Confirm B/L Release</DialogTitle>
        <DialogContent>
          <p>Are you sure you want to mark this as B/L Released? This will move the entry to Completed Files.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelComplete}>Cancel</Button>
          <Button onClick={handleConfirmComplete} color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Confirming Deletion */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <p>Are you sure you want to delete this entry? This action cannot be undone.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

const entryFields = {
  bookingDate: "Booking Date",
  shipper: "Shipper",
  salesPersonName: "Salesperson Name",
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

export default Entries;