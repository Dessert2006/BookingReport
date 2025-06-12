import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, getDoc, addDoc, deleteDoc, query, where } from "firebase/firestore";
import { DataGrid } from "@mui/x-data-grid";
import { TextField, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Button, FormControlLabel, IconButton, Box } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import axios from 'axios';

// CSS for highlighting rows and buttons
const styles = `
  .highlight-row {
    background-color: #FFFF00;
  }
  .location-button {
    margin: 5px;
    padding: 8px 16px;
    border: 2px solid #1976d2;
    background-color: white;
    color: #1976d2;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
  }
  .location-button.active {
    background-color: #1976d2;
    color: white;
  }
  .location-button:hover {
    background-color: #1976d2;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }
  .sort-button {
    margin: 3px;
    padding: 8px 14px;
    border: 2px solid #2e7d32;
    background-color: white;
    color: #2e7d32;
    border-radius: 15px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .sort-button:hover {
    background-color: #2e7d32;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 3px 6px rgba(0,0,0,0.2);
  }
  
  /* Improved overlapped grid layout */
  .grid-container {
    position: relative;
    height: 600px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
  }
  
  .pinned-grid {
    position: relative;
    width: 530px;
    height: 100%;
    z-index: 10;
    overflow: hidden !important;
    border-right: 2px solid #1976d2;
  }
  
  .scrollable-grid {
    position: relative;
    flex: 1;
    height: 100%;
    z-index: 5;
    overflow: hidden !important;
    margin-left: -1px; /* Remove gap between grids */
  }
  
  .pinned-grid .MuiDataGrid-columnHeaders {
    background-color: #e3f2fd !important;
  }
  
  .pinned-grid .MuiDataGrid-cell {
    background-color: #f8f9fa !important;
    font-weight: 500;
  }
  
  .pinned-grid .MuiDataGrid-columnHeader {
    background-color: #e3f2fd !important;
    font-weight: 600;
  }
  
  /* Completely hide scrollbars for pinned grid */
  .pinned-grid .MuiDataGrid-virtualScroller {
    overflow: hidden !important;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  
  .pinned-grid .MuiDataGrid-virtualScroller::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  
  .pinned-grid .MuiDataGrid-main {
    overflow: hidden !important;
  }
  
  .pinned-grid .MuiDataGrid-scrollArea {
    display: none !important;
  }
  
  /* Scrollable grid settings */
  .scrollable-grid .MuiDataGrid-virtualScroller {
    overflow-x: auto !important;
    overflow-y: auto !important;
    min-width: 4000px !important;
  }
  
  .pinned-grid .MuiDataGrid-row,
  .scrollable-grid .MuiDataGrid-row {
    min-height: 52px !important;
    max-height: 52px !important;
  }
  
  /* Hide horizontal scrollbar for pinned grid completely */
  .pinned-grid .MuiDataGrid-scrollArea--left,
  .pinned-grid .MuiDataGrid-scrollArea--right {
    display: none !important;
  }
  
  /* Make sure no scrollbars appear in pinned grid */
  .pinned-grid * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  
  .pinned-grid *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
`;

const entryFields = {
  customer: "Customer",
  salesPersonName: "Sales",
  bookingDate: "Booking Date",
  bookingNo: "Booking No",
  bookingValidity: "Expiry",
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
  blReleased: "B/L Released",
};

function Entries() {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fpodMaster, setFpodMaster] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [activeLocationFilter, setActiveLocationFilter] = useState("SEE ALL");
  const [sortModel, setSortModel] = useState([]);
  const [filterModel, setFilterModel] = useState({ items: [] });
  const [masterData, setMasterData] = useState({
    location: [],
    customer: [],
    line: [],
    pol: [],
    pod: [],
    fpod: [],
    vessel: [],
    equipmentType: []
  });
  const [selectedRows, setSelectedRows] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [blNoInput, setBlNoInput] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rowToComplete, setRowToComplete] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [sobDialogOpen, setSobDialogOpen] = useState(false);
  const [sobDateInput, setSobDateInput] = useState("");
  const [rowForSob, setRowForSob] = useState(null);

  const pinnedGridRef = useRef(null);
  const scrollableGridRef = useRef(null);

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

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  };

  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.includes("-") ? dateStr.split("-") : [];
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (parseInt(a, 10) <= 31 && parseInt(b, 10) <= 12) {
        return `${c}-${b}-${a}`;
      }
      if (parseInt(a, 10) >= 1000) {
        return `${a}-${b}-${c}`;
      }
    }
    return null;
  };

  const fixConcatenatedData = (value) => {
    if (!value || typeof value !== 'string') return value;
    
    const volumePatterns = [
      /(\d+\s*x\s*\d+['\s]*(?:STD|HC|DV|RF|OT|FR|TK))(\d+\s*x\s*\d+['\s]*(?:STD|HC|DV|RF|OT|TK))/gi,
      /(CONTAINER|CONU|TEMU|MSKU|TCLU|GESU)(\d+)([A-Z]{4}\d+)/gi,
      /([A-Z]{4}\d{7})([A-Z]{4}\d{7})/gi
    ];
    
    let fixed = value;
    
    fixed = fixed.replace(/(\d+\s*x\s*\d+['\s]*(?:STD|HC|DV|RF|OT|TK|GP))(?=\d+\s*x\s*\d+)/gi, '$1, ');
    
    fixed = fixed.replace(/([A-Z]{4}\d{6,7})(?=[A-Z]{4}\d{6,7})/gi, '$1, ');
    
    fixed = fixed.replace(/((?:CONTAINER|CONU|TEMU|MSKU|TCLU|GESU)\d+)(?=(?:CONTAINER|CONU|TEMU|MSKU|TCLU|GESU))/gi, '$1, ');
    
    return fixed;
  };

  const parseAdvancedQuery = (query) => {
    if (!query) return [];
    const stopWords = ["details", "of", "on", "with", "for", "in", "at"];
    const tokens = query
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .split(/\s+/)
      .filter(token => token && !stopWords.includes(token));
    return tokens;
  };

  const applySorting = (data, currentSortModel) => {
    if (!currentSortModel || currentSortModel.length === 0) {
      return data;
    }

    return [...data].sort((a, b) => {
      for (const sortItem of currentSortModel) {
        const { field, sort } = sortItem;
        let aValue = a[field];
        let bValue = b[field];

        if (field === 'customer') {
          aValue = (typeof aValue === 'object' ? aValue?.name : aValue) || '';
          bValue = (typeof bValue === 'object' ? bValue?.name : bValue) || '';
        } else if (['bookingDate', 'bookingValidity', 'etd', 'sobDate'].includes(field)) {
          const aDate = aValue ? new Date(aValue) : new Date(0);
          const bDate = bValue ? new Date(bValue) : new Date(0);
          aValue = aDate.getTime();
          bValue = bDate.getTime();
        } else {
          aValue = (aValue || '').toString().toLowerCase();
          bValue = (bValue || '').toString().toLowerCase();
        }

        let comparison = 0;
        if (aValue < bValue) {
          comparison = -1;
        } else if (aValue > bValue) {
          comparison = 1;
        }

        if (comparison !== 0) {
          return sort === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  };

  const applyFilters = () => {
    let filtered = [...entries];

    if (searchQuery) {
      const tokens = parseAdvancedQuery(searchQuery);
      filtered = filtered.filter((entry) => {
        return tokens.every(token => {
          const textFields = [
            "location", "customer", "line", "pol", "pod", "fpod", "vessel",
            "bookingNo", "containerNo", "volume", "voyage", "blNo", "equipmentType",
            "portCutOff", "siCutOff", "salesPersonName"
          ];
          const textMatch = textFields.some(field => {
            const value = typeof entry[field] === 'object' ? entry[field]?.name : entry[field];
            return value && value.toString().toLowerCase().includes(token);
          });

          const dateFields = ["bookingDate", "bookingValidity", "etd", "sobDate"];
          const normalizedDate = normalizeDate(token);
          const dateMatch = normalizedDate && dateFields.some(field => {
            return entry[field] === normalizedDate;
          });

          const booleanFields = [
            "vgmFiled", "siFiled", "finalDG", "firstPrinted", "correctionsFinalised",
            "blReleased", "isfSent", "sob"
          ];
          const booleanMatch = booleanFields.some(field => {
            if (token === "yes" || token === "true" || token === "filed") {
              return entry[field] === true;
            }
            if (token === "no" || token === "false") {
              return entry[field] === false;
            }
            return false;
          });

          return textMatch || dateMatch || booleanMatch;
        });
      });
    }

    if (selectedLocations.length > 0) {
      filtered = filtered.filter((entry) => selectedLocations.includes(entry.location));
    }

    filtered = applySorting(filtered, sortModel);

    setFilteredEntries(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [entries, searchQuery, selectedLocations, sortModel]);

  // Improved scroll synchronization
  const handleScrollableScroll = (event) => {
    if (pinnedGridRef.current && scrollableGridRef.current) {
      const scrollableScroller = event.target.closest('.MuiDataGrid-virtualScroller');
      const pinnedScroller = pinnedGridRef.current.querySelector('.MuiDataGrid-virtualScroller');
      
      if (pinnedScroller && scrollableScroller) {
        // Synchronize vertical scroll only
        pinnedScroller.scrollTop = scrollableScroller.scrollTop;
      }
    }
  };

  // Add event listener for scroll synchronization
  useEffect(() => {
    const scrollableGrid = scrollableGridRef.current;
    if (scrollableGrid) {
      const virtualScroller = scrollableGrid.querySelector('.MuiDataGrid-virtualScroller');
      if (virtualScroller) {
        virtualScroller.addEventListener('scroll', handleScrollableScroll);
        return () => {
          virtualScroller.removeEventListener('scroll', handleScrollableScroll);
        };
      }
    }
  }, [filteredEntries]);

  const handlePinnedSelectionChange = (newSelection) => {
    setSelectedRows(newSelection);
  };

  const handleScrollableSelectionChange = (newSelection) => {
    setSelectedRows(newSelection);
  };

  const handlePinnedSortModelChange = (newSortModel) => {
    setSortModel(newSortModel);
  };

  const handleScrollableSortModelChange = (newSortModel) => {
    setSortModel(newSortModel);
  };

  const handlePinnedFilterModelChange = (newFilterModel) => {
    setFilterModel(newFilterModel);
  };

  const handleScrollableFilterModelChange = (newFilterModel) => {
    setFilterModel(newFilterModel);
  };

  useEffect(() => {
    const fetchEntries = async () => {
      const querySnapshot = await getDocs(collection(db, "entries"));
      const entryList = [];
      const locationSet = new Set();

      const customerDoc = await getDoc(doc(db, "newMaster", "customer"));
      const customerMasterList = customerDoc.exists() ? customerDoc.data().list || [] : [];

      querySnapshot.forEach((docSnap) => {
        const entryData = { ...docSnap.data(), id: docSnap.id };
        let customerObj = entryData.customer;
        if (typeof customerObj === 'string') {
          customerObj = customerMasterList.find(item => item.name === customerObj) || { 
            name: customerObj, 
            salesPerson: "", 
            customerEmail: "", 
            salesPersonEmail: ""
          };
        }

        entryList.push({
          id: docSnap.id,
          ...entryData,
          location: entryData.location?.name || entryData.location || "",
          customer: customerObj,
          salesPersonName: customerObj?.salesPerson || "",
          customerEmail: customerObj?.customerEmail || "",
          salesPersonEmail: customerObj?.salesPersonEmail || "",
          line: entryData.line?.name || entryData.line || "",
          pol: entryData.pol?.name || entryData.pol || "",
          pod: entryData.pod?.name || entryData.pod || "",
          fpod: entryData.fpod?.name || entryData.fpod || "",
          vessel: entryData.vessel?.name || entryData.vessel || "",
          equipmentType: entryData.equipmentType?.type || entryData.equipmentType || "",
          volume: Array.isArray(entryData.volume) ? entryData.volume.join(', ') : entryData.volume || "",
          containerNo: Array.isArray(entryData.containerNo) ? entryData.containerNo.join(', ') : entryData.containerNo || "",
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
      setLocations([...locationSet]);
    };

    const fetchMasterData = async () => {
      const masterFields = ["location", "customer", "line", "pol", "pod", "fpod", "vessel", "equipmentType"];
      let newMasterData = {
        location: [],
        customer: [],
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
            field === "customer" ? item.name : 
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

  const handleSortModelChange = (newSortModel) => {
    setSortModel(newSortModel);
  };

  const handleQuickSort = (field, direction) => {
    const newSortModel = [{ field, sort: direction }];
    setSortModel(newSortModel);
  };

  const handleClearSort = () => {
    setSortModel([]);
  };

  const handleLocationButtonFilter = (location) => {
    setActiveLocationFilter(location);
    if (location === "SEE ALL") {
      setSelectedLocations([]);
    } else {
      setSelectedLocations([location]);
    }
  };

  const handleSearch = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
  };

  const handleLocationFilter = (location, checked) => {
    const newSelectedLocations = checked
      ? [...selectedLocations, location]
      : selectedLocations.filter((loc) => loc !== location);
    setSelectedLocations(newSelectedLocations);
  };

  const handleProcessRowUpdate = async (newRow, oldRow) => {
    try {
      const formattedPortCutOff = newRow.portCutOff ? formatCutOffInput(newRow.portCutOff) : newRow.portCutOff;
      const formattedSiCutOff = newRow.siCutOff ? formatCutOffInput(newRow.siCutOff) : newRow.siCutOff;

      const cutOffRegex = /^\d{2}\/\d{2}-\d{4} HRS$/;
      if (formattedPortCutOff && !cutOffRegex.test(formattedPortCutOff)) {
        toast.error("Port CutOff must be in the format DD/MM-HHMM HRS (e.g., 06/06-1800 HRS)");
        throw new Error("Invalid Port CutOff format");
      }
      if (formattedSiCutOff && !cutOffRegex.test(formattedSiCutOff)) {
        toast.error("SI CutOff must be in the format DD/MM-HHMM HRS (e.g., 06/06-1800 HRS)");
        throw new Error("Invalid SI CutOff format");
      }

      let customerData = newRow.customer;
      if (typeof newRow.customer === 'string') {
        const customerDoc = await getDoc(doc(db, "newMaster", "customer"));
        customerData = customerDoc.data()?.list.find(item => item.name === newRow.customer) || { 
          name: newRow.customer,
          customerEmail: "",
          salesPersonEmail: ""
        };
      }

      const formattedRow = {
        ...newRow,
        portCutOff: formattedPortCutOff,
        siCutOff: formattedSiCutOff,
        customer: customerData,
        salesPersonName: customerData.salesPerson || "",
        customerEmail: customerData.customerEmail || "",
        salesPersonEmail: customerData.salesPersonEmail || "",
        volume: fixConcatenatedData(typeof newRow.volume === 'string' && newRow.volume.includes(',') ? 
                newRow.volume.split(',').map(v => v.trim()).join(', ') : newRow.volume),
        containerNo: fixConcatenatedData(typeof newRow.containerNo === 'string' && newRow.containerNo.includes(',') ? 
                     newRow.containerNo.split(',').map(c => c.trim()).join(', ') : newRow.containerNo)
      };

      const portCutOffChanged = oldRow.portCutOff !== formattedPortCutOff;
      const siCutOffChanged = oldRow.siCutOff !== formattedSiCutOff;

      if (portCutOffChanged || siCutOffChanged) {
        const q = query(
          collection(db, "entries"),
          where("vessel", "==", formattedRow.vessel || ""),
          where("voyage", "==", formattedRow.voyage || ""),
          where("pol", "==", formattedRow.pol || "")
        );
        const querySnapshot = await getDocs(q);

        const updatedEntries = [...entries];
        const batchUpdates = [];

        querySnapshot.forEach((docSnap) => {
          const entryId = docSnap.id;
          if (entryId !== formattedRow.id) {
            const updateData = {
              portCutOff: portCutOffChanged ? formattedPortCutOff : docSnap.data().portCutOff,
              siCutOff: siCutOffChanged ? formattedSiCutOff : docSnap.data().siCutOff
            };
            const docRef = doc(db, "entries", entryId);
            batchUpdates.push(updateDoc(docRef, updateData));

            const entryIndex = updatedEntries.findIndex(entry => entry.id === entryId);
            if (entryIndex !== -1) {
              updatedEntries[entryIndex] = {
                ...updatedEntries[entryIndex],
                ...updateData
              };
            }
          }
        });

        const currentRowIndex = updatedEntries.findIndex(entry => entry.id === formattedRow.id);
        if (currentRowIndex !== -1) {
          updatedEntries[currentRowIndex] = formattedRow;
        }

        const docRef = doc(db, "entries", formattedRow.id);
        const updateData = { ...formattedRow };
        delete updateData.id;
        delete updateData.salesPersonName;
        delete updateData.customerEmail;
        delete updateData.salesPersonEmail;
        batchUpdates.push(updateDoc(docRef, updateData));

        await Promise.all(batchUpdates);

        setEntries(updatedEntries);
        toast.success("Row(s) updated successfully!");
      } else {
        const updatedEntries = entries.map((entry) =>
          entry.id === formattedRow.id ? formattedRow : entry
        );
        setEntries(updatedEntries);

        const docRef = doc(db, "entries", formattedRow.id);
        const updateData = { ...formattedRow };
        delete updateData.id;
        delete updateData.salesPersonName;
        delete updateData.customerEmail;
        delete updateData.salesPersonEmail;
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

  const exportToExcel = () => {
    const rowsToExport = selectedRows.length > 0
      ? filteredEntries.filter(entry => selectedRows.includes(entry.id))
      : filteredEntries;

    const exportData = rowsToExport.map(entry => {
      const row = {};
      allColumns.forEach(column => {
        if (column.field !== 'actions') {
          let value = entry[column.field];
          if (column.field === 'customer') {
            value = entry.customer?.name || entry.customer;
          } else if (column.field === 'salesPersonName') {
            value = entry.customer?.salesPerson || "";
          } else if (['bookingDate', 'bookingValidity', 'etd', 'sobDate'].includes(column.field)) {
            value = formatDate(value);
          } else if (['vgmFiled', 'siFiled', 'finalDG', 'firstPrinted', 'isfSent', 'sob', 'correctionsFinalised', 'blReleased'].includes(column.field)) {
            value = value ? "Yes" : "No";
          }
          row[column.headerName] = value || "";
        }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Entries");
    XLSX.writeFile(workbook, "booking_entries.xlsx");
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
    "customer",
    "line",
    "pol",
    "pod",
    "fpod",
    "vessel",
    "equipmentType"
  ];

  const allColumns = [
    {
      field: "customer",
      headerName: "Customer",
      width: 200,
      minWidth: 200,
      flex: 0,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.customer,
      valueParser: (value) => value,
      renderCell: (params) => params.value?.name || params.value || ""
    },
    {
      field: "line",
      headerName: "Line",
      width: 150,
      minWidth: 150,
      flex: 0,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.line,
      renderCell: (params) => params.value || ""
    },
    {
      field: "bookingNo",
      headerName: "Booking No",
      width: 180,
      minWidth: 180,
      flex: 0,
      editable: true,
      renderCell: (params) => params.value || ""
    },
    ...(activeLocationFilter === "SEE ALL" ? [{
      field: "location",
      headerName: "Location",
      width: 150,
      minWidth: 150,
      flex: 0,
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.location,
      renderCell: (params) => params.value || ""
    }] : []),
    ...Object.keys(entryFields).filter(key => !['customer', 'line', 'bookingNo'].includes(key)).map((key) => {
      const isMasterField = masterFields.includes(key);
      const isBooleanField = booleanFields.includes(key);
      const isDateField = ["bookingDate", "bookingValidity", "etd"].includes(key);
      
      return {
        field: key,
        headerName: entryFields[key],
        width: 180,
        minWidth: 180,
        flex: 0,
        editable: key !== "salesPersonName",
        ...(isMasterField && {
          type: "singleSelect",
          valueOptions: masterData[key],
          valueParser: (value) => value,
          renderCell: (params) => params.value.name || params.value || ""
        }),
        ...(isDateField && {
          type: "date",
          valueGetter: (value, row) => {
            const dateValue = value || row[key];
            if (!dateValue) return null;
            
            if (dateValue instanceof Date) {
              return dateValue;
            }
            
            if (typeof dateValue === 'string') {
              if (/^\d{2}-\d{2}-\d{4}$/.test(dateValue)) {
                const [day, month, year] = dateValue.split('-');
                return new Date(`${year}-${month}-${day}`);
              }
              if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                return new Date(dateValue);
              }
              return new Date(dateValue);
            }
            
            return null;
          },
          valueSetter: (value, row) => {
            if (!value) {
              return { ...row, [key]: "" };
            }
            
            const date = value instanceof Date ? value : new Date(value);
            if (isNaN(date)) {
              return { ...row, [key]: "" };
            }
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            
            return { ...row, [key]: `${year}-${month}-${day}` };
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
            const value = params.value;
            if (!value) return "";
            
            try {
              let dateToFormat;
              
              if (value instanceof Date) {
                dateToFormat = value;
              } else if (typeof value === 'string') {
                if (value.includes('-')) {
                  const parts = value.split('-');
                  if (parts.length === 3) {
                    if (parts[0].length === 4) {
                      dateToFormat = new Date(value);
                    } else {
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
          if (key === "salesPersonName") {
            return params.row.customer?.salesPerson || "";
          }
          if (key === "volume" || key === "containerNo") {
            const value = params.value || "";
            if (typeof value === 'string' && value.includes(',')) {
              return value.split(',').map(v => v.trim()).join(', ');
            }
            return value;
          }
          return params.value || "";
        }
      };
    })
  ];

  const siFiledIndex = allColumns.findIndex((col) => col.field === "siFiled");
  if (siFiledIndex !== -1) {
    allColumns.splice(siFiledIndex + 1, 0, {
      field: "finalDG",
      headerName: "FINAL DG",
      width: 180,
      minWidth: 180,
      flex: 0,
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

  if (fpodMaster.length > 0) {
    const firstPrintedIndex = allColumns.findIndex((col) => col.field === "firstPrinted");
    allColumns.splice(firstPrintedIndex + 1, 0, {
      field: "isfSent",
      headerName: "ISF SENT",
      width: 180,
      minWidth: 180,
      flex: 0,
      editable: true,
      renderCell: (params) => {
        const entryFpod = params.row.fpod || "";
        const matchingFpod = fpodMaster.find(
          (fpod) => fpod.toUpperCase() === entryFpod.toUpperCase()
        );

        if (
          (matchingFpod && matchingFpod.toUpperCase().includes("USA")) ||
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

    allColumns.splice(firstPrintedIndex + 2, 0, {
      field: "sob",
      headerName: "SOB",
      width: 180,
      minWidth: 180,
      flex: 0,
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

  allColumns.push({
    field: "blNo",
    headerName: "BL No",
    width: 200,
    minWidth: 200,
    flex: 0,
    editable: true
  });

  allColumns.push({
    field: "actions",
    headerName: "Actions",
    width: 100,
    minWidth: 100,
    flex: 0,
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
      await deleteDoc(doc(db, "entries", rowToDelete.id));
      const updatedEntries = entries.filter((entry) => entry.id !== rowToDelete.id);
      setEntries(updatedEntries);
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

    try {
      // Update Firestore
      await handleProcessRowUpdate(newRow, rowForSob);

      // Send email via Python API
      if (newRow.customerEmail && newRow.salesPersonEmail) {
        // Ensure container_no is a string
        const containerNo = Array.isArray(newRow.containerNo) 
          ? newRow.containerNo.join(', ') 
          : newRow.containerNo || '';

        const emailData = {
          customer_email: newRow.customerEmail,
          sales_person_email: newRow.salesPersonEmail,
          customer_name: newRow.customer?.name || newRow.customer,
          booking_no: newRow.bookingNo,
          sob_date: formattedSobDate,
          vessel: newRow.vessel,
          voyage: newRow.voyage,
          pol: newRow.pol,
          pod: newRow.pod,
          fpod: newRow.fpod || '',
          container_no: containerNo,
          volume: newRow.volume,
          bl_no: newRow.blNo || ''
        };

        console.log("Sending emailData:", emailData); // Debug log
        await axios.post('http://localhost:5000/api/send-sob-email', emailData);
        toast.success("SOB email sent successfully!");
      } else {
        toast.warn("Email addresses missing for customer or salesperson.");
      }

      setSobDialogOpen(false);
      setRowForSob(null);
      setSobDateInput("");
    } catch (error) {
      console.error("Error processing SOB: ", error);
      toast.error("Failed to process SOB or send email.");
    }
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
        (fpod) => fpod.toUpperCase() === entryFpod.toUpperCase()
      );
      if (
        (matchingFpod && matchingFpod.toUpperCase().includes("USA")) ||
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

      const entryData = { ...updatedRow };
      delete entryData.id;
      delete entryData.salesPersonName;
      delete entryData.customerEmail;
      delete entryData.salesPersonEmail;
      await addDoc(collection(db, "completedFiles"), entryData);
      await deleteDoc(doc(db, "entries", updatedRow.id));

      const newEntries = entries.filter((entry) => entry.id !== updatedRow.id);
      setEntries(newEntries);

      toast.success("Entry marked as B/L Released and moved to Completed Files!");
    } catch (error) {
      console.error("Error completing entry: ", error);
      toast.error("Failed to mark as B/L Released.");
      const updatedEntries = entries.map((entry) =>
        entry.id === rowToComplete.id ? { ...entry, blReleased: false } : entry
      );
      setEntries(updatedEntries);
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

  const getRowClassName = (params) => {
    const row = params.row;
    return !row.portCutOff && !row.siCutOff ? "highlight-row" : "";
  };

  return (
    <div className="container mt-4">
      <style>{styles}</style>
      <h2 className="mb-4 text-center">Booking Entries</h2>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
        {["MUMBAI", "GUJARAT", "SEE ALL"].map((location) => (
          <button
            key={location}
            className={`location-button ${activeLocationFilter === location ? 'active' : ''}`}
            onClick={() => handleLocationButtonFilter(location)}
          >
            {location}
          </button>
        ))}
      </Box>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
        <button
          className="sort-button"
          onClick={() => handleQuickSort('etd', 'asc')}
          title="Sort by ETD (Earliest First)"
        >
          📅 ETD ↑ (Earliest)
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort('etd', 'desc')}
          title="Sort by ETD (Latest First)"
        >
          📅 ETD ↓ (Latest)
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort('line', 'asc')}
          title="Sort by Line (A-Z)"
        >
          🚢 Line A-Z
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort('line', 'desc')}
          title="Sort by Line (Z-A)"
        >
          🚢 Line Z-A
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort('customer', 'asc')}
          title="Sort by Customer (A-Z)"
        >
          👤 Customer A-Z
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort('customer', 'desc')}
          title="Sort by Customer (Z-A)"
        >
          👤 Customer Z-A
        </button>
        <button
          className="sort-button"
          onClick={() => handleClearSort()}
          title="Clear All Sorting"
        >
          🔄 Clear Sort
        </button>
      </Box>

      <div className="mb-3 d-flex align-items-center">
        <TextField
          label="Search (e.g., MAERSK 06-06-2025...)"
          variant="outlined"
          fullWidth
          value={searchQuery}
          onChange={handleSearch}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={exportToExcel}
          style={{ marginLeft: '10px' }}
        >
          Export to Excel
        </Button>
      </div>

      {activeLocationFilter === "SEE ALL" && (
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
      )}

      <div className="grid-container">
        <div className="pinned-grid">
          <DataGrid
            ref={pinnedGridRef}
            rows={filteredEntries}
            columns={allColumns.slice(0, activeLocationFilter === "SEE ALL" ? 4 : 3)}
            pageSize={10}
            rowsPerPageOptions={[5, 10, 20]}
            checkboxSelection
            disableSelectionOnClick
            hideFooter
            getRowClassName={getRowClassName}
            selectionModel={selectedRows}
            onSelectionModelChange={handlePinnedSelectionChange}
            processRowUpdate={handleProcessRowUpdate}
            sortModel={sortModel}
            onSortModelChange={handlePinnedSortModelChange}
            filterModel={filterModel}
            onFilterModelChange={handlePinnedFilterModelChange}
            disableColumnMenu={false}
            disableVirtualization={false}
            sx={{
              height: '100%',
              width: '100%',
              border: 'none',
              borderRight: '2px solid #1976d2',
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#e3f2fd',
                fontWeight: 'bold',
                fontSize: '14px',
                borderBottom: '2px solid #e0e0e0',
              },
              '& .MuiDataGrid-columnHeader': {
                padding: '8px 4px',
                '&:focus': {
                  outline: 'none',
                },
                '&:hover': {
                  backgroundColor: '#d1e7fd',
                },
              },
              '& .MuiDataGrid-cell': {
                borderRight: '1px solid #f0f0f0',
                fontSize: '13px',
                backgroundColor: '#f8f9fa',
                fontWeight: '500',
                '&:focus': {
                  outline: 'none',
                },
              },
              '& .MuiDataGrid-row:nth-of-type(even) .MuiDataGrid-cell': {
                backgroundColor: '#f0f0f0',
              },
              '& .MuiDataGrid-row:hover .MuiDataGrid-cell': {
                backgroundColor: '#e8f4fd !important',
              },
              '& .MuiDataGrid-row.Mui-selected .MuiDataGrid-cell': {
                backgroundColor: '#bbdefb !important',
              },
              '& .MuiDataGrid-virtualScroller': {
                overflow: 'hidden !important',
                scrollbarWidth: 'none !important',
                '-ms-overflow-style': 'none !important',
              },
              '& .MuiDataGrid-virtualScroller::-webkit-scrollbar': {
                display: 'none !important',
                width: '0 !important',
                height: '0 !important',
              },
              '& .MuiDataGrid-main': {
                overflow: 'hidden !important',
              },
              '& .MuiDataGrid-scrollArea': {
                display: 'none !important',
              },
              '& .MuiDataGrid-scrollArea--left': {
                display: 'none !important',
              },
              '& .MuiDataGrid-scrollArea--right': {
                display: 'none !important',
              },
              '& .MuiDataGrid-columnSeparator': {
                display: 'none',
              },
            }}
          />
        </div>

        <div className="scrollable-grid">
          <DataGrid
            ref={scrollableGridRef}
            rows={filteredEntries}
            columns={allColumns}
            pageSize={10}
            rowsPerPageOptions={[5, 10, 20]}
            disableSelectionOnClick
            hideFooter
            getRowClassName={getRowClassName}
            selectionModel={selectedRows}
            onSelectionModelChange={handleScrollableSelectionChange}
            processRowUpdate={handleProcessRowUpdate}
            sortModel={sortModel}
            onSortModelChange={handleScrollableSortModelChange}
            filterModel={filterModel}
            onFilterModelChange={handleScrollableFilterModelChange}
            disableColumnMenu={false}
            sx={{
              height: '100%',
              minWidth: '4000px',
              border: 'none',
              borderLeft: 'none',
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#f8f9fa',
                fontWeight: 'bold',
                fontSize: '14px',
                borderBottom: '2px solid #e0e0e0',
              },
              '& .MuiDataGrid-columnHeader': {
                padding: '8px 4px',
                '&:focus': {
                  outline: 'none',
                },
                '&:hover': {
                  backgroundColor: '#e3f2fd',
                },
              },
              '& .MuiDataGrid-cell': {
                borderRight: '1px solid #f0f0f0',
                fontSize: '13px',
                '&:focus': {
                  outline: 'none',
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
              '& .MuiDataGrid-virtualScroller': {
                overflowX: 'auto !important',
                overflowY: 'auto !important',
              },
              '& .MuiDataGrid-columnSeparator': {
                display: 'none',
              },
              // FIXED: Hide duplicate columns properly
              ...(activeLocationFilter === "SEE ALL" ? {
                '& .MuiDataGrid-columnHeader:nth-child(-n+4)': {
                  display: 'none',
                },
                '& .MuiDataGrid-cell:nth-child(-n+4)': {
                  display: 'none',
                },
              } : {
                '& .MuiDataGrid-columnHeader:nth-child(-n+3)': {
                  display: 'none',
                },
                '& .MuiDataGrid-cell:nth-child(-n+3)': {
                  display: 'none',
                },
              }),
            }}
          />
        </div>
      </div>

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

export default Entries;