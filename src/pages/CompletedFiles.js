import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { DataGrid } from "@mui/x-data-grid";
import { TextField, FormControlLabel, Checkbox } from "@mui/material";
import { toast } from "react-toastify";

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

  // Parse equipmentDetails to volume and containerNo strings with proper formatting
  const parseEquipmentDetails = (equipmentDetails) => {
    if (!Array.isArray(equipmentDetails) || equipmentDetails.length === 0) {
      return { volume: "", containerNo: "" };
    }
    
    // Join with commas and spaces like in Entries component
    const volume = equipmentDetails
      .map((detail) => `${detail.qty} x ${detail.equipmentType}`)
      .join(', ');
    
    const containerNo = equipmentDetails
      .map((detail) => detail.containerNo)
      .filter(Boolean)
      .join(', ');
      
    return { volume, containerNo };
  };

  // Function to format volume and containerNo for display (like in Entries)
  const formatMultipleValues = (value) => {
    if (!value) return "";
    
    // If it's a string with multiple values separated by newlines, convert to comma separation
    if (typeof value === 'string') {
      if (value.includes('\n')) {
        return value.split('\n').map(v => v.trim()).filter(v => v).join(', ');
      }
      if (value.includes(',')) {
        return value.split(',').map(v => v.trim()).filter(v => v).join(', ');
      }
    }
    return value;
  };

  useEffect(() => {
    const fetchCompletedEntries = async () => {
      const querySnapshot = await getDocs(collection(db, "completedFiles"));
      const entryList = [];
      const locationSet = new Set();

      querySnapshot.forEach((docSnap) => {
        const entryData = { ...docSnap.data(), id: docSnap.id };
        const { volume, containerNo } = parseEquipmentDetails(entryData.equipmentDetails || []);

        entryList.push({
          ...entryData,
          id: docSnap.id,
          location: entryData.location?.name || entryData.location || "",
          customer: entryData.customer?.name || entryData.customer || "",
          salesPersonName: entryData.customer?.salesPerson || "",
          line: entryData.line?.name || entryData.line || "",
          pol: entryData.pol?.name || entryData.pol || "",
          pod: entryData.pod?.name || entryData.pod || "",
          fpod: entryData.fpod?.name || entryData.fpod || "",
          vessel: entryData.vessel?.name || entryData.vessel || "",
          // Use the formatted volume and containerNo, or fall back to existing data
          volume: formatMultipleValues(volume || entryData.volume || ""),
          containerNo: formatMultipleValues(containerNo || entryData.containerNo || ""),
          equipmentDetails: entryData.equipmentDetails || [],
          isfSent: entryData.isfSent || false,
          sob: entryData.sob || false,
          sobDate: entryData.sobDate || "",
          finalDG: entryData.finalDG || false,
          blNo: entryData.blNo || "",
          invoiceNo: entryData.invoiceNo || "",
          referenceNo: entryData.referenceNo || "",
          remarks: entryData.remarks || "",
          etaDestination: entryData.etaDestination || "",
          courierDetails: entryData.courierDetails || ""
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
    "sob",
    "finalDG"
  ];

  const columns = [
    {
      field: "location",
      headerName: "Location",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    {
      field: "bookingNo",
      headerName: "Booking No",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    {
      field: "customer",
      headerName: "Customer",
      width: 200,
      renderCell: (params) => params.value || ""
    },
    {
      field: "referenceNo",
      headerName: "Reference NO",
      width: 150,
      editable: true,
      renderCell: (params) => params.value || ""
    },
    {
      field: "salesPersonName",
      headerName: "Sales",
      width: 150,
      editable: false,
      renderCell: (params) => params.value || ""
    },
    {
      field: "bookingDate",
      headerName: "Booking Date",
      width: 150,
      renderCell: (params) => formatDate(params.value) || ""
    },
    {
      field: "bookingValidity",
      headerName: "Booking Validity",
      width: 150,
      renderCell: (params) => formatDate(params.value) || ""
    },
    {
      field: "line",
      headerName: "Line",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    {
      field: "pol",
      headerName: "POL",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    {
      field: "pod",
      headerName: "POD",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    {
      field: "fpod",
      headerName: "FPOD",
      width: 200,
      renderCell: (params) => params.value || ""
    },
    {
      field: "volume",
      headerName: "Volume",
      width: 200,
      renderCell: (params) => {
        const value = params.value || "";
        // Display multiple values with proper formatting
        return (
          <div style={{ 
            whiteSpace: "normal", 
            wordWrap: "break-word", 
            lineHeight: "1.4",
            padding: "4px 0"
          }}>
            {value}
          </div>
        );
      }
    },
    {
      field: "containerNo",
      headerName: "Container No",
      width: 200,
      renderCell: (params) => {
        const value = params.value || "";
        // Display multiple values with proper formatting
        return (
          <div style={{ 
            whiteSpace: "normal", 
            wordWrap: "break-word", 
            lineHeight: "1.4",
            padding: "4px 0"
          }}>
            {value}
          </div>
        );
      }
    },
    {
      field: "vessel",
      headerName: "Vessel",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    {
      field: "voyage",
      headerName: "Voyage",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    {
      field: "portCutOff",
      headerName: "Port CutOff",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    {
      field: "siCutOff",
      headerName: "SI CutOff",
      width: 150,
      renderCell: (params) => params.value || ""
    },
    {
      field: "etd",
      headerName: "ETD",
      width: 150,
      renderCell: (params) => formatDate(params.value) || ""
    },
    {
      field: "vgmFiled",
      headerName: "VGM Filed",
      width: 150,
      renderCell: (params) => (
        <Checkbox checked={!!params.row.vgmFiled} disabled={true} color="primary" />
      )
    },
    {
      field: "siFiled",
      headerName: "SI Filed",
      width: 150,
      renderCell: (params) => (
        <Checkbox checked={!!params.row.siFiled} disabled={true} color="primary" />
      )
    },
    {
      field: "finalDG",
      headerName: "FINAL DG",
      width: 150,
      renderCell: (params) => {
        const volume = params.row.volume || "";
        if (volume.toUpperCase().includes("HAZ")) {
          return <Checkbox checked={!!params.row.finalDG} disabled={true} color="primary" />;
        }
        return null;
      }
    },
    {
      field: "firstPrinted",
      headerName: "First Printed",
      width: 150,
      renderCell: (params) => (
        <Checkbox checked={!!params.row.firstPrinted} disabled={true} color="primary" />
      )
    },
    {
      field: "isfSent",
      headerName: "ISF SENT",
      width: 150,
      renderCell: (params) => {
        const entryFpod = params.row.fpod || "";
        const isUSA = entryFpod.toUpperCase().includes("USA");
        if (isUSA) {
          return <Checkbox checked={!!params.row.isfSent} disabled={true} color="primary" />;
        }
        return null;
      }
    },
    {
      field: "sob",
      headerName: "SOB",
      width: 150,
      renderCell: (params) => (
        <Checkbox checked={!!params.row.sob} disabled={true} color="primary" />
      )
    },
    {
      field: "sobDate",
      headerName: "SOB Date",
      width: 150,
      renderCell: (params) => formatDate(params.value) || ""
    },
    {
      field: "correctionsFinalised",
      headerName: "Corrections Finalised",
      width: 150,
      renderCell: (params) => (
        <Checkbox checked={!!params.row.correctionsFinalised} disabled={true} color="primary" />
      )
    },
    {
      field: "blReleased",
      headerName: "B/L - Released",
      width: 150,
      renderCell: (params) => (
        <Checkbox checked={!!params.row.blReleased} disabled={true} color="primary" />
      )
    },
    {
      field: "blNo",
      headerName: "BL No",
      width: 200,
      renderCell: (params) => params.value || ""
    },
    {
      field: "invoiceNo",
      headerName: "Invoice No",
      width: 220,
      editable: true,
      renderCell: (params) => params.value || ""
    },
    {
      field: "remarks",
      headerName: "Remarks",
      width: 200,
      editable: true,
      renderCell: (params) => params.value || ""
    },
    {
      field: "etaDestination",
      headerName: "ETA Destination",
      width: 150,
      editable: true,
      type: "date",
      valueGetter: (value, row) => {
        const dateValue = value || row.etaDestination;
        if (!dateValue) return null;
        
        // If it's already a Date object, return it
        if (dateValue instanceof Date) {
          return dateValue;
        }
        
        // If it's a string, convert to Date
        if (typeof dateValue === 'string') {
          // Handle DD-MM-YYYY format
          if (dateValue.includes('-') && dateValue.length === 10) {
            const parts = dateValue.split('-');
            if (parts.length === 3) {
              // Check if it's DD-MM-YYYY or YYYY-MM-DD
              if (parts[0].length === 4) {
                // YYYY-MM-DD format
                return new Date(dateValue);
              } else {
                // DD-MM-YYYY format, convert to YYYY-MM-DD
                const [day, month, year] = parts;
                return new Date(`${year}-${month}-${day}`);
              }
            }
          }
          return new Date(dateValue);
        }
        
        return null;
      },
      valueSetter: (value, row) => {
        if (!value) {
          return { ...row, etaDestination: "" };
        }
        
        const date = value instanceof Date ? value : new Date(value);
        if (isNaN(date)) {
          return { ...row, etaDestination: "" };
        }
        
        // Store as YYYY-MM-DD format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        
        return { ...row, etaDestination: `${year}-${month}-${day}` };
      },
      renderCell: (params) => {
        const value = params.value;
        if (!value) return "";
        
        try {
          let dateToFormat;
          
          if (value instanceof Date) {
            dateToFormat = value;
          } else if (typeof value === 'string') {
            // Handle both DD-MM-YYYY and YYYY-MM-DD formats
            if (value.includes('-')) {
              const parts = value.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  // YYYY-MM-DD format
                  dateToFormat = new Date(value);
                } else {
                  // DD-MM-YYYY format
                  const [day, month, year] = parts;
                  dateToFormat = new Date(`${year}-${month}-${day}`);
                }
              }
            } else {
              dateToFormat = new Date(value);
            }
          }
          
          if (dateToFormat && !isNaN(dateToFormat)) {
            const year = dateToFormat.getFullYear();
            const month = String(dateToFormat.getMonth() + 1).padStart(2, "0");
            const day = String(dateToFormat.getDate()).padStart(2, "0");
            return formatDate(`${year}-${month}-${day}`);
          }
          
          return "";
        } catch (error) {
          console.error("Date rendering error:", error);
          return "";
        }
      }
    },
    {
      field: "courierDetails",
      headerName: "Courier Details",
      width: 200,
      editable: true,
      renderCell: (params) => params.value || ""
    }
  ];

  const handleProcessRowUpdate = async (newRow, oldRow) => {
    try {
      const docRef = doc(db, "completedFiles", newRow.id);
      const updateData = { ...newRow };

      if (newRow.invoiceNo !== oldRow.invoiceNo) {
        const userInput = newRow.invoiceNo.trim();
        if (userInput) {
          updateData.invoiceNo = `DMS/${userInput}/25-26`;
        } else {
          updateData.invoiceNo = "";
        }
      }

      updateData.referenceNo = newRow.referenceNo || "";
      updateData.remarks = newRow.remarks || "";
      updateData.etaDestination = newRow.etaDestination || "";
      updateData.courierDetails = newRow.courierDetails || "";

      delete updateData.id;
      delete updateData.salesPersonName;

      await updateDoc(docRef, updateData);

      const updatedEntries = completedEntries.map((entry) =>
        entry.id === newRow.id ? { ...newRow, invoiceNo: updateData.invoiceNo } : entry
      );
      setCompletedEntries(updatedEntries);
      applyFilters(updatedEntries, searchQuery, selectedLocations);

      return { ...newRow, invoiceNo: updateData.invoiceNo };
    } catch (error) {
      console.error("Error updating document: ", error);
      toast.error("Failed to update entry.");
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
          processRowUpdate={handleProcessRowUpdate}
          onProcessRowUpdateError={(error) => console.error(error)}
          sx={{
            height: '100%',
            width: '100%',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            '& .MuiDataGrid-main': {
              borderRadius: '8px',
            },
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid #f0f0f0',
              borderRight: '1px solid #f0f0f0',
            },
            '& .MuiDataGrid-row': {
              minHeight: '60px !important',
              '&:last-child .MuiDataGrid-cell': {
                borderBottom: '1px solid #e0e0e0',
              },
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#f8f9fa',
              fontWeight: 'bold',
              fontSize: '14px',
              borderBottom: '2px solid #e0e0e0',
            },
            '& .MuiDataGrid-columnHeader': {
              '&:focus': {
                outline: 'none',
              },
              '&:hover': {
                backgroundColor: '#e3f2fd',
              },
            },
            '& .MuiDataGrid-row:nth-of-type(even)': {
              backgroundColor: '#fafafa',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: '#f0f8ff !important',
            },
            '& .MuiDataGrid-row.Mui-selected': {
              backgroundColor: '#e3f2fd !important',
            },
            '& .MuiDataGrid-row.Mui-selected:hover': {
              backgroundColor: '#bbdefb !important',
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: '2px solid #e0e0e0',
              backgroundColor: '#f8f9fa',
            },
            '& .MuiDataGrid-virtualScroller': {
              overflowX: 'auto',
              overflowY: 'auto',
            },
          }}
        />
      </div>
    </div>
  );
}

const entryFields = {
  bookingNo: "Booking No",
  customer: "Customer",
  referenceNo: "Reference NO",
  bookingDate: "Booking Date",
  bookingValidity: "Booking Validity",
  line: "Line",
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