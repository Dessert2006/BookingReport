import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { toast } from "react-toastify";
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import * as XLSX from 'xlsx';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    pendingSI: 0,
    pendingFirstPrint: 0,
    pendingCorrection: 0,
    pendingBL: 0,
    pendingInvoice: 0,
    pendingDG: 0,
    pendingEmptyPickup: 0
  });
  const [shipmentsByDate, setShipmentsByDate] = useState([]);
  const [shipmentsByShipper, setShipmentsByShipper] = useState([]);
  const [detailedEntries, setDetailedEntries] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);
  const [showFilteredView, setShowFilteredView] = useState(false);
  const [filteredViewData, setFilteredViewData] = useState([]);
  const [originalFilteredData, setOriginalFilteredData] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [chartSize, setChartSize] = useState('medium');
  const [searchQuery, setSearchQuery] = useState('');
  const [blTypeDialogOpen, setBlTypeDialogOpen] = useState(false);
  const [selectedBlType, setSelectedBlType] = useState("");
  const [rowForBlType, setRowForBlType] = useState(null);
  const [fpodMaster, setFpodMaster] = useState([]);
  const [blNoDialogOpen, setBlNoDialogOpen] = useState(false);
  const [blNoInput, setBlNoInput] = useState("");
  const [rowForBlNo, setRowForBlNo] = useState(null);
  const [blReleaseConfirmOpen, setBlReleaseConfirmOpen] = useState(false);
  const [rowForBlRelease, setRowForBlRelease] = useState(null);

  useEffect(() => {
    const fetchFpodMaster = async () => {
      const docRef = doc(db, "newMaster", "fpod");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFpodMaster((docSnap.data().list || []).map(item => `${item.name}, ${item.country}`));
      }
    };
    fetchFpodMaster();
  }, []);

  useEffect(() => {
    const today = new Date();
    const weekBack = new Date();
    weekBack.setDate(today.getDate() - 7);
    setDateRange({
      startDate: weekBack.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    });
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
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

  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.includes("-") ? dateStr.split("-") : [];
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (parseInt(a, 10) <= 31 && parseInt(b, 10) <= 12) return `${c}-${b}-${a}`;
      if (parseInt(a, 10) >= 1000) return `${a}-${b}-${c}`;
    }
    return null;
  };

  const handleSearchInFilteredView = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredViewData(originalFilteredData);
      return;
    }
    const tokens = parseAdvancedQuery(query);
    const filtered = originalFilteredData.filter((entry) => {
      return tokens.every(token => {
        const textFields = [
          "location","customer","line","pol","pod","fpod","vessel",
          "bookingNo","containerNo","volume","voyage","blNo","blType"
        ];
        const textMatch = textFields.some(field => {
          let value = entry[field];
          if (typeof value === 'object' && value?.name) value = value.name;
          return value && value.toString().toLowerCase().includes(token);
        });
        const dateFields = ["bookingDate","bookingValidity","etd","sobDate"];
        const normalizedDate = normalizeDate(token);
        const dateMatch = normalizedDate && dateFields.some(field => entry[field] === normalizedDate);
        const booleanFields = [
          "vgmFiled","siFiled","finalDG","firstPrinted","correctionsFinalised",
          "blReleased","isfSent","sob"
        ];
        const booleanMatch = booleanFields.some(field => {
          if (token === "yes" || token === "true" || token === "filed") return entry[field] === true;
          if (token === "no" || token === "false") return entry[field] === false;
          return false;
        });
        return textMatch || dateMatch || booleanMatch;
      });
    });
    setFilteredViewData(filtered);
  };

  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) fetchDashboardData();
  }, [selectedLocation, dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const entriesSnapshot = await getDocs(collection(db, "entries"));
      const completedSnapshot = await getDocs(collection(db, "completedFiles"));

      const allEntries = [];
      const completedEntries = [];

      entriesSnapshot.forEach((docSnap) => {
        const data = { ...docSnap.data(), id: docSnap.id, status: 'active' };
        allEntries.push({
          ...data,
          location: data.location?.name || data.location || "",
          customer: data.customer?.name || data.customer || "",
          line: data.line?.name || data.line || "",
          vessel: data.vessel?.name || data.vessel || "",
          fpod: data.fpod?.name || data.fpod || "",
          blType: data.blType || "",
          // If containerNo is stored inside equipmentDetails array, prefer that
          containerNo: (Array.isArray(data.equipmentDetails) && data.equipmentDetails[0] && data.equipmentDetails[0].containerNo) || data.containerNo || ""
        });
      });

      completedSnapshot.forEach((docSnap) => {
        const data = { ...docSnap.data(), id: docSnap.id, status: 'completed' };
        completedEntries.push({
          ...data,
          location: data.location?.name || data.location || "",
          customer: data.customer?.name || data.customer || "",
          line: data.line?.name || data.line || "",
          vessel: data.vessel?.name || data.vessel || "",
          fpod: data.fpod?.name || data.fpod || "",
          blType: data.blType || "",
          containerNo: (Array.isArray(data.equipmentDetails) && data.equipmentDetails[0] && data.equipmentDetails[0].containerNo) || data.containerNo || ""
        });
      });

      const allData = [...allEntries, ...completedEntries];

      // Location filter for charts/tables
      const filteredData = selectedLocation === 'All'
        ? allData
        : allData.filter(entry => entry.location === selectedLocation);

      // PENDING metrics only consider ACTIVE entries
      const activeEntries = allEntries.filter(entry => {
        if (selectedLocation !== 'All' && entry.location !== selectedLocation) return false;
        return entry.status === 'active';
      });

      const pendingSI = activeEntries.filter(entry => !entry.siFiled).length;
      const pendingFirstPrint = activeEntries.filter(entry => entry.siFiled && !entry.firstPrinted).length;
      const pendingCorrection = activeEntries.filter(entry => entry.firstPrinted && !entry.correctionsFinalised).length;
      const pendingBL = activeEntries.filter(entry => entry.correctionsFinalised && !entry.blReleased).length;
      const today = new Date();
      const pendingInvoice = activeEntries.filter(entry => {
        const dateStr = entry.invoiceDueDate || entry.etd;
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return entry.firstPrinted && !entry.linerInvoice && date < today;
      }).length;
      const pendingDG = activeEntries.filter(entry => {
        const volume = entry.volume || "";
        return volume.toUpperCase().includes("HAZ") && !entry.finalDG;
      }).length;

      const pendingEmptyPickup = activeEntries.filter(entry => {
        const c = entry.containerNo || "";
        return c.toString().trim() === "";
      }).length;

      setDashboardData({
        pendingSI,
        pendingFirstPrint,
        pendingCorrection,
        pendingBL,
        pendingInvoice,
        pendingDG,
        pendingEmptyPickup
      });

      // Build chart data from BOTH active + completed (so counts match)
      const dateMap = new Map();
      filteredData.forEach(entry => {
        if (entry.etd) {
          const etdDate = new Date(entry.etd);
          if (etdDate >= new Date(dateRange.startDate) && etdDate <= new Date(dateRange.endDate)) {
            const dateStr = etdDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
          }
        }
      });

      const sailingData = Array.from(dateMap.entries())
        .map(([date, count]) => ({ date, shipments: count }))
        .sort((a, b) => {
          const dateA = new Date(a.date + ' 2024');
          const dateB = new Date(b.date + ' 2024');
          return dateA - dateB;
        });

      setShipmentsByDate(sailingData);

      const shipperMap = new Map();
      filteredData.forEach(entry => {
        if (entry.customer) {
          const customer = entry.customer;
          shipperMap.set(customer, (shipperMap.get(customer) || 0) + 1);
        }
      });

      const shipmentsByShipperData = Array.from(shipperMap.entries())
        .map(([shipper, count]) => ({ shipper, shipments: count }))
        .sort((a, b) => b.shipments - a.shipments)
        .slice(0, 8);

      setShipmentsByShipper(shipmentsByShipperData);

      const detailedData = filteredData
        .filter(entry => {
          if (!entry.etd) return false;
          const date = new Date(entry.etd);
          return date >= new Date(dateRange.startDate) && date <= new Date(dateRange.endDate);
        })
        .sort((a, b) => new Date(a.etd) - new Date(b.etd))
        .slice(0, 10);

      setDetailedEntries(detailedData);

      // Expose all buckets so we can filter for bar clicks across both
      window.dashboardData = { allEntries, completedEntries, allData };
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const clearDateRange = () => {
    const today = new Date();
    const weekBack = new Date();
    weekBack.setDate(today.getDate() - 7);
    setDateRange({
      startDate: weekBack.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    });
  };

  const handleDashboardClick = (filterType, allEntries /* active only */) => {
    let filteredData = [];
    let title = '';

    switch(filterType) {
      case 'pendingSI':
        filteredData = allEntries.filter(entry => {
          if (selectedLocation !== 'All' && entry.location !== selectedLocation) return false;
          return !entry.siFiled;
        });
        title = 'Pending SI';
        break;
      case 'pendingFirstPrint':
        filteredData = allEntries.filter(entry => {
          if (selectedLocation !== 'All' && entry.location !== selectedLocation) return false;
          return entry.siFiled && !entry.firstPrinted;
        });
        title = 'Pending First Print';
        break;
      case 'pendingCorrection':
        filteredData = allEntries.filter(entry => {
          if (selectedLocation !== 'All' && entry.location !== selectedLocation) return false;
          return entry.firstPrinted && !entry.correctionsFinalised;
        });
        title = 'Pending Correction';
        break;
      case 'pendingBL':
        filteredData = allEntries.filter(entry => {
          if (selectedLocation !== 'All' && entry.location !== selectedLocation) return false;
          return entry.correctionsFinalised && !entry.blReleased;
        });
        title = 'Pending BL';
        break;
      case 'pendingInvoice':
        filteredData = allEntries.filter(entry => {
          if (selectedLocation !== 'All' && entry.location !== selectedLocation) return false;
          const dateStr = entry.invoiceDueDate || entry.etd;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          if (!entry.firstPrinted) return false;
          if (entry.linerInvoice) return false;
          return date < new Date();
        });
        title = 'Pending Invoice';
        break;
      case 'pendingDG':
        filteredData = allEntries.filter(entry => {
          if (selectedLocation !== 'All' && entry.location !== selectedLocation) return false;
          const volume = entry.volume || "";
          return volume.toUpperCase().includes("HAZ") && !entry.finalDG;
        });
        title = 'Pending DG';
        break;
      case 'emptyPickup':
        filteredData = allEntries.filter(entry => {
          if (selectedLocation !== 'All' && entry.location !== selectedLocation) return false;
          const c = entry.containerNo || "";
          return c.toString().trim() === "";
        });
        title = 'Empty Pickup';
        break;
      default:
        return;
    }

    filteredData = filteredData.sort((a, b) => {
      if (!a.etd && !b.etd) return 0;
      if (!a.etd) return 1;
      if (!b.etd) return -1;
      return new Date(a.etd) - new Date(b.etd);
    });

    setOriginalFilteredData(filteredData);
    setFilteredViewData(filteredData);
    setFilterType(title);
    setSearchQuery('');
    setShowFilteredView(true);
  };

  const handleEditEntry = (entry) => {
    if (entry.status === 'completed') {
      toast.info('Completed files are read-only.');
      return;
    }
    setEditingEntry({ ...entry });
  };

  const handleSaveEntry = async (updatedRow = editingEntry) => {
    if (!updatedRow) return;
    if (updatedRow.status === 'completed') {
      toast.info('Completed files are read-only.');
      setEditingEntry(null);
      return;
    }
    if (blReleaseConfirmOpen) return;

    try {
      const docRef = doc(db, "entries", updatedRow.id);
      const originalEntry = filteredViewData.find(e => e.id === updatedRow.id) || null;
      const updateData = {
        bookingNo: updatedRow.bookingNo || "",
        volume: updatedRow.volume || "",
        siFiled: Boolean(updatedRow.siFiled),
        firstPrinted: Boolean(updatedRow.firstPrinted),
        correctionsFinalised: Boolean(updatedRow.correctionsFinalised),
        blReleased: Boolean(updatedRow.blReleased),
        finalDG: Boolean(updatedRow.finalDG),
        blType: updatedRow.blType || "",
        blNo: updatedRow.blNo || "",
        linerInvoice: Boolean(updatedRow.linerInvoice)
      };

      // Customer handling (preserve object shape if original had object)
      if (typeof updatedRow.customer === 'string') {
        if (originalEntry && typeof originalEntry.customer === 'object') {
          updateData.customer = { ...originalEntry.customer, name: updatedRow.customer };
        } else {
          updateData.customer = { name: updatedRow.customer };
        }
      } else {
        updateData.customer = updatedRow.customer;
      }

      // Handle containerNo stored inside equipmentDetails array in the document
      if (updatedRow.containerNo !== undefined) {
        const origEquip = Array.isArray(originalEntry?.equipmentDetails) ? originalEntry.equipmentDetails : [];
        if (origEquip.length > 0) {
          const newEquip = origEquip.map((ed, idx) => idx === 0 ? { ...ed, containerNo: updatedRow.containerNo } : ed);
          updateData.equipmentDetails = newEquip;
        } else {
          // create a minimal equipmentDetails array with containerNo
          updateData.equipmentDetails = [{ containerNo: updatedRow.containerNo }];
        }
      }

      if (updateData.blReleased) {
        const entrySnap = await getDoc(docRef);
        if (entrySnap.exists()) {
          const entryData = entrySnap.data();
          const completedData = { ...entryData, ...updateData, status: 'completed' };
          try {
            await updateDoc(doc(db, "completedFiles", updatedRow.id), completedData);
          } catch {
            const { setDoc } = await import("firebase/firestore");
            await setDoc(doc(db, "completedFiles", updatedRow.id), completedData);
          }
          await deleteDoc(docRef);
        }
      } else {
        await updateDoc(docRef, updateData);
      }

      const updatedData = filteredViewData.map(entry =>
        entry.id === updatedRow.id
          ? { ...entry, ...updateData }
          : entry
      );
      setFilteredViewData(updatedData);

      const updatedOriginalData = originalFilteredData.map(entry =>
        entry.id === updatedRow.id
          ? { ...entry, ...updateData }
          : entry
      );
      setOriginalFilteredData(updatedOriginalData);

      setEditingEntry(null);
      toast.success('Entry updated successfully! 🎉');
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating entry:', error);
      toast.error(`Failed to update entry: ${error.message}`);
    }
  };

  const handleDeleteEntry = async (entry) => {
    if (entry.status === 'completed') {
      toast.info('Completed files cannot be deleted here.');
      return;
    }
    const entryId = entry.id;

    const confirmDelete = window.confirm(
      '⚠️ DELETE CONFIRMATION ⚠️\n\n' +
      'Are you sure you want to delete this entry?\n\n' +
      '🔴 This action CANNOT be undone!\n' +
      '🔴 The entry will be permanently removed from the database.\n\n' +
      'Click OK to proceed with deletion or Cancel to abort.'
    );
    if (!confirmDelete) {
      toast.info('Delete operation cancelled.');
      return;
    }

    try {
      await deleteDoc(doc(db, "entries", entryId));
      const updatedData = filteredViewData.filter(e => e.id !== entryId);
      setFilteredViewData(updatedData);
      const updatedOriginalData = originalFilteredData.filter(e => e.id !== entryId);
      setOriginalFilteredData(updatedOriginalData);
      toast.success('Entry deleted successfully! ✅');
      fetchDashboardData();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry. Please try again.');
    }
  };

  const handleCheckboxEdit = (row, field, value) => {
    if (row.status === 'completed') {
      toast.info('Completed files are read-only.');
      return;
    }
    if (field === "siFiled" && value) {
      setRowForBlType(row);
      setSelectedBlType("");
      setBlTypeDialogOpen(true);
      return;
    }
    if (field === "firstPrinted" && value && !row.siFiled) {
      toast.error("Please tick SI Filed before First Print.");
      return;
    }
    if (field === "firstPrinted" && value) {
      setRowForBlNo(row);
      setBlNoInput(row.blNo || "");
      setBlNoDialogOpen(true);
      return;
    }
    if (field === "correctionsFinalised" && value && !row.firstPrinted) {
      toast.error("Please tick First Print before Corrections Finalised.");
      return;
    }
    if (field === "blReleased" && value) {
      const fieldsToCheck = ["vgmFiled", "siFiled", "firstPrinted", "correctionsFinalised"];
      const entryFpod = row.fpod || "";
      const matchingFpod = fpodMaster.find((fpod) => fpod.toUpperCase() === entryFpod.toUpperCase());
      if ((matchingFpod && matchingFpod.toUpperCase().includes("USA")) || entryFpod.toUpperCase().includes("USA")) {
        fieldsToCheck.push("isfSent");
      }
      const allPrerequisitesMet = fieldsToCheck.every((prereqField) => row[prereqField] === true);
      if (!allPrerequisitesMet) {
        toast.error("All previous steps must be completed before releasing B/L.");
        return;
      }
      setRowForBlRelease(row);
      setBlReleaseConfirmOpen(true);
      return;
    }
    setEditingEntry(prev => ({ ...prev, [field]: value }));
  };

  const handleBlTypeDialogSubmit = async () => {
    if (!selectedBlType) {
      toast.error("Please select BL Type");
      return;
    }
    const updatedRow = { ...rowForBlType, siFiled: true, blType: selectedBlType };
    try {
      await handleSaveEntry(updatedRow);
      toast.success("SI Filed and BL Type updated successfully!");
    } catch {
      toast.error("Failed to update SI Filed and BL Type.");
    }
    setSelectedBlType("");
    setRowForBlType(null);
    setBlTypeDialogOpen(false);
  };

  const handleBlTypeDialogClose = () => {
    setSelectedBlType("");
    setRowForBlType(null);
    setBlTypeDialogOpen(false);
  };

  const handleBlNoDialogSubmit = async () => {
    if (!blNoInput.trim()) {
      toast.error("Please enter BL No");
      return;
    }
    const updatedRow = { ...rowForBlNo, firstPrinted: true, blNo: blNoInput.trim() };
    try {
      await handleSaveEntry(updatedRow);
      toast.success("First Print ticked and BL No updated successfully!");
    } catch {
      toast.error("Failed to update First Print and BL No.");
    }
    setBlNoInput("");
    setRowForBlNo(null);
    setBlNoDialogOpen(false);
  };

  const handleBlNoDialogClose = () => {
    setBlNoInput("");
    setRowForBlNo(null);
    setBlNoDialogOpen(false);
  };

  const getChartDimensions = () => {
    switch(chartSize) {
      case 'small':
        return { maxWidth: '600px', height: 220, fontSize: 10, barSize: 30,
          margin: { top: 15, right: 20, left: 15, bottom: 50 } };
      case 'large':
        return { maxWidth: '1200px', height: 400, fontSize: 12, barSize: 60,
          margin: { top: 30, right: 40, left: 30, bottom: 80 } };
      default:
        return { maxWidth: '800px', height: 280, fontSize: 11, barSize: 40,
          margin: { top: 20, right: 30, left: 20, bottom: 60 } };
    }
  };

  const chartDimensions = getChartDimensions();

  // Include BOTH active + completed when clicking the bar,
  // so table count matches the bar count.
  const handleBarClick = (barData) => {
    const clickedLabel = barData?.payload?.date; // e.g., "12 Aug"
    if (!clickedLabel) return;

    const allData = window.dashboardData?.allData
      || [ ...(window.dashboardData?.allEntries || []), ...(window.dashboardData?.completedEntries || []) ];

    let filtered = allData.filter(entry => {
      if (selectedLocation !== 'All' && entry.location !== selectedLocation) return false;
      if (!entry.etd) return false;
      const label = new Date(entry.etd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      return label === clickedLabel;
    });

    filtered = filtered.sort((a, b) => {
      if (!a.etd && !b.etd) return 0;
      if (!a.etd) return 1;
      if (!b.etd) return -1;
      return new Date(a.etd) - new Date(b.etd);
    });

    setOriginalFilteredData(filtered);
    setFilteredViewData(filtered);
    setFilterType(`Sailings on ${clickedLabel}`);
    setSearchQuery('');
    setEditingEntry(null);
    setShowFilteredView(true);
  };

  const exportToExcel = (data, fileName) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <style>{`
        .dashboard-card { border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,.1); transition: transform .3s ease; }
        .dashboard-card:hover { transform: translateY(-5px); }
        .metric-number { font-size: 3rem; font-weight: bold; color: white; }
        .metric-label { font-size: .9rem; color: white; opacity: .9; }
        .chart-container { background: white; border-radius: 15px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,.1); margin-bottom: 20px; }
        .location-btn { margin: 5px; padding: 8px 16px; border: 2px solid #6c757d; background: white; color: #6c757d; border-radius: 20px; cursor: pointer; font-weight: 600; transition: all .3s ease; }
        .location-btn.active, .location-btn:hover { background: #6c757d; color: white; }
        .table-container { max-height: 400px; overflow-y: auto; }
        .clickable-card { cursor: pointer; transition: all .3s ease; }
        .clickable-card:hover { transform: translateY(-8px); box-shadow: 0 8px 25px rgba(0,0,0,.15); }
        .filtered-view { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,.8); z-index:1050; display:flex; justify-content:center; align-items:center; }
        .filtered-content { background:white; border-radius:15px; padding:20px; width:95%; height:90%; overflow-y:auto; }
        .edit-input { border:1px solid #ddd; padding:5px; border-radius:4px; width:100%; }
        .chart-size-controls { display:flex; gap:10px; justify-content:center; align-items:center; margin-bottom:15px; }
        .size-btn { padding:6px 12px; border:2px solid #dee2e6; background:white; color:#6c757d; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition: all .2s ease; }
        .size-btn.active { background:#2563eb; color:white; border-color:#2563eb; }
        .size-btn:hover { border-color:#2563eb; color:#2563eb; }
        .size-btn.active:hover { background:#1d4ed8; border-color:#1d4ed8; color:white; }
        .search-container { margin-bottom:20px; }
        .search-input { width:100%; padding:12px 16px; border:2px solid #e3f2fd; border-radius:25px; font-size:16px; outline:none; transition: all .3s ease; }
        .search-input:focus { border-color:#2196f3; box-shadow:0 0 0 3px rgba(33,150,243,.1); }
        .search-results-info { margin-top:10px; font-size:14px; color:#666; text-align:center; }
        .recharts-bar-rectangle { cursor: pointer; } /* bars look clickable */
      `}</style>

      <div className="row mb-4">
        <div className="col-12">
          <h1 className="text-center mb-4" style={{ color: '#2c3e50', fontWeight: 'bold' }}>
            📊 DAILY BOOKING REPORT
          </h1>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12 text-center">
          {['All', 'MUMBAI', 'GUJARAT'].map((location) => (
            <button
              key={location}
              className={`location-btn ${selectedLocation === location ? 'active' : ''}`}
              onClick={() => setSelectedLocation(location)}
            >
              {location}
            </button>
          ))}
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12 text-center">
          <div className="d-inline-flex align-items-center gap-3 p-3 bg-light rounded">
            <label className="fw-bold">SELECT A SAILING DATE</label>
            <input
              type="date"
              className="form-control"
              style={{ width: '150px' }}
              value={dateRange.startDate}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
            />
            <span>to</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '150px' }}
              value={dateRange.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
            />
            <button className="btn btn-outline-secondary" onClick={clearDateRange}>
              Reset to 1 week
            </button>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-2 mb-3">
          <div
            className="dashboard-card clickable-card p-4 text-center"
            style={{ backgroundColor: '#ffc107' }}
            onClick={() => handleDashboardClick('pendingSI', window.dashboardData?.allEntries || [])}
          >
            <div className="metric-number" style={{ color: '#212529' }}>{dashboardData.pendingSI}</div>
            <div className="metric-label" style={{ color: '#212529' }}>PENDING SI</div>
          </div>
        </div>
        <div className="col-md-2 mb-3">
          <div
            className="dashboard-card clickable-card p-4 text-center"
            style={{ backgroundColor: '#17a2b8' }}
            onClick={() => handleDashboardClick('pendingFirstPrint', window.dashboardData?.allEntries || [])}
          >
            <div className="metric-number">{dashboardData.pendingFirstPrint}</div>
            <div className="metric-label">PENDING FIRST PRINT</div>
          </div>
        </div>
        <div className="col-md-2 mb-3">
          <div
            className="dashboard-card clickable-card p-4 text-center"
            style={{ backgroundColor: '#fd7e14' }}
            onClick={() => handleDashboardClick('pendingCorrection', window.dashboardData?.allEntries || [])}
          >
            <div className="metric-number">{dashboardData.pendingCorrection}</div>
            <div className="metric-label">PENDING CORRECTION</div>
          </div>
        </div>
        <div className="col-md-2 mb-3">
          <div
            className="dashboard-card clickable-card p-4 text-center"
            style={{ backgroundColor: '#e83e8c' }}
            onClick={() => handleDashboardClick('pendingBL', window.dashboardData?.allEntries || [])}
          >
            <div className="metric-number">{dashboardData.pendingBL}</div>
            <div className="metric-label">PENDING BL</div>
          </div>
        </div>
        <div className="col-md-2 mb-3">
          <div
            className="dashboard-card clickable-card p-4 text-center"
            style={{ backgroundColor: '#dc3545' }}
            onClick={() => handleDashboardClick('pendingInvoice', window.dashboardData?.allEntries || [])}
          >
            <div className="metric-number">{dashboardData.pendingInvoice}</div>
            <div className="metric-label">PENDING INVOICE</div>
          </div>
        </div>
        <div className="col-md-2 mb-3">
          <div
            className="dashboard-card clickable-card p-4 text-center"
            style={{ backgroundColor: '#6c757d' }}
            onClick={() => handleDashboardClick('pendingDG', window.dashboardData?.allEntries || [])}
          >
            <div className="metric-number">{dashboardData.pendingDG}</div>
            <div className="metric-label">PENDING DG</div>
          </div>
        </div>
        <div className="col-md-2 mb-3">
          <div
            className="dashboard-card clickable-card p-4 text-center"
            style={{ backgroundColor: '#20c997' }}
            onClick={() => handleDashboardClick('emptyPickup', window.dashboardData?.allEntries || [])}
          >
            <div className="metric-number">{dashboardData.pendingEmptyPickup}</div>
            <div className="metric-label">EMPTY PICKUP</div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12 d-flex flex-column align-items-center">
          <div className="chart-container" style={{ maxWidth: chartDimensions.maxWidth, width: '100%' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="text-center mb-0 flex-grow-1">Shipments by Sailing Date (ETD)</h5>
              <div className="chart-size-controls">
                <span style={{ fontSize: '12px', color: '#6c757d', marginRight: '10px' }}>Size:</span>
                <button className={`size-btn ${chartSize === 'small' ? 'active' : ''}`} onClick={() => setChartSize('small')}>S</button>
                <button className={`size-btn ${chartSize === 'medium' ? 'active' : ''}`} onClick={() => setChartSize('medium')}>M</button>
                <button className={`size-btn ${chartSize === 'large' ? 'active' : ''}`} onClick={() => setChartSize('large')}>L</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={chartDimensions.height}>
              <BarChart data={shipmentsByDate} margin={chartDimensions.margin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: chartDimensions.fontSize }}
                  angle={-35}
                  textAnchor="end"
                  height={chartDimensions.margin.bottom}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: chartDimensions.fontSize }}
                  label={{
                    value: 'Shipments',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: `${chartDimensions.fontSize + 1}px` }
                  }}
                />
                <Tooltip
                  labelFormatter={(value) => `Date: ${value}`}
                  formatter={(value) => [`${value} shipments`, 'Total']}
                  contentStyle={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: `${chartDimensions.fontSize}px`
                  }}
                />
                <Bar
                  dataKey="shipments"
                  fill="#2563eb"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={chartDimensions.barSize}
                  onClick={handleBarClick}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {showFilteredView && (
        <div className="filtered-view">
          <div className="filtered-content">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3>{filterType} ({filteredViewData.length} entries)</h3>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowFilteredView(false);
                  setSearchQuery('');
                  setEditingEntry(null);
                }}
              >
                ✕ Close
              </button>
            </div>

            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Search entries... (e.g., MAERSK, customer name, booking number, location, yes/no for checkboxes)"
                value={searchQuery}
                onChange={(e) => handleSearchInFilteredView(e.target.value)}
              />
              {searchQuery && (
                <div className="search-results-info">
                  {filteredViewData.length === originalFilteredData.length
                    ? `Showing all ${filteredViewData.length} entries`
                    : `Found ${filteredViewData.length} of ${originalFilteredData.length} entries matching "${searchQuery}"`}
                </div>
              )}
            </div>

            <button
              className="btn btn-success mb-3"
              onClick={() => exportToExcel(filteredViewData, 'FilteredData')}
            >
              Export to Excel
            </button>

            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>Booking No</th>
                    <th>Container No</th>
                    <th>Customer</th>
                    <th>Line</th>
                    <th>POL</th>
                    <th>FPOD</th>
                    <th>Vessel</th>
                    <th>Volume</th>
                    <th>SI Cut Off</th>
                    <th>ETD</th>
                    <th>SI Filed</th>
                    <th>First Printed</th>
                    <th>Corrections Finalised</th>
                    <th>BL Released</th>
                    <th>Final DG</th>
                    <th>BL Type</th>
                    <th>Liner Invoice</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredViewData.length === 0 ? (
                    <tr>
                      <td colSpan="19" className="text-center py-4">
                        {searchQuery ? (
                          <div>
                            <p>🔍 No entries found matching your search criteria.</p>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => {
                                setSearchQuery('');
                                handleSearchInFilteredView('');
                              }}
                            >
                              Clear Search
                            </button>
                          </div>
                        ) : (
                          <p>No entries found.</p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredViewData.map((entry, index) => (
                      <tr key={entry.id || index}>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              className="edit-input"
                              value={editingEntry.bookingNo || ''}
                              onChange={(e) => setEditingEntry({ ...editingEntry, bookingNo: e.target.value })}
                            />
                          ) : (
                            entry.bookingNo || 'N/A'
                          )}
                        </td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              className="edit-input"
                              value={editingEntry.containerNo || ''}
                              onChange={(e) => setEditingEntry({ ...editingEntry, containerNo: e.target.value })}
                            />
                          ) : (
                            entry.containerNo || 'N/A'
                          )}
                        </td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              className="edit-input"
                              value={typeof editingEntry.customer === 'object' ? editingEntry.customer?.name || '' : editingEntry.customer || ''}
                              onChange={(e) => setEditingEntry({ ...editingEntry, customer: e.target.value })}
                            />
                          ) : (
                            typeof entry.customer === 'object' ? entry.customer?.name || 'N/A' : entry.customer || 'N/A'
                          )}
                        </td>
                        <td>{entry.line || 'N/A'}</td>
                        <td>{entry.pol || 'N/A'}</td>
                        <td>{entry.fpod || 'N/A'}</td>
                        <td>{entry.vessel || 'N/A'}</td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              className="edit-input"
                              value={editingEntry.volume || ''}
                              onChange={(e) => setEditingEntry({ ...editingEntry, volume: e.target.value })}
                            />
                          ) : (
                            entry.volume || 'N/A'
                          )}
                        </td>
                        <td>{entry.siCutOff || 'N/A'}</td>
                        <td>{formatDate(entry.etd) || 'N/A'}</td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              type="checkbox"
                              checked={editingEntry.siFiled || false}
                              onChange={(e) => handleCheckboxEdit(entry, 'siFiled', e.target.checked)}
                              className="form-check-input"
                            />
                          ) : (
                            <span className={`badge ${entry.siFiled ? 'bg-success' : 'bg-danger'}`}>{entry.siFiled ? 'Yes' : 'No'}</span>
                          )}
                        </td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              type="checkbox"
                              checked={editingEntry.firstPrinted || false}
                              onChange={(e) => handleCheckboxEdit(entry, 'firstPrinted', e.target.checked)}
                              className="form-check-input"
                            />
                          ) : (
                            <span className={`badge ${entry.firstPrinted ? 'bg-success' : 'bg-danger'}`}>{entry.firstPrinted ? 'Yes' : 'No'}</span>
                          )}
                        </td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              type="checkbox"
                              checked={editingEntry.correctionsFinalised || false}
                              onChange={(e) => handleCheckboxEdit(entry, 'correctionsFinalised', e.target.checked)}
                              className="form-check-input"
                            />
                          ) : (
                            <span className={`badge ${entry.correctionsFinalised ? 'bg-success' : 'bg-danger'}`}>{entry.correctionsFinalised ? 'Yes' : 'No'}</span>
                          )}
                        </td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              type="checkbox"
                              checked={editingEntry.blReleased || false}
                              onChange={(e) => handleCheckboxEdit(entry, 'blReleased', e.target.checked)}
                              className="form-check-input"
                            />
                          ) : (
                            <span className={`badge ${entry.blReleased ? 'bg-success' : 'bg-danger'}`}>{entry.blReleased ? 'Yes' : 'No'}</span>
                          )}
                        </td>
                        <td>
                          {entry.volume?.toUpperCase().includes('HAZ') ? (
                            editingEntry?.id === entry.id ? (
                              <input
                                type="checkbox"
                                checked={editingEntry.finalDG || false}
                                onChange={(e) => handleCheckboxEdit(entry, 'finalDG', e.target.checked)}
                                className="form-check-input"
                              />
                            ) : (
                              <span className={`badge ${entry.finalDG ? 'bg-success' : 'bg-danger'}`}>{entry.finalDG ? 'Yes' : 'No'}</span>
                            )
                          ) : (
                            <span className="badge bg-secondary">N/A</span>
                          )}
                        </td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              className="edit-input"
                              value={editingEntry.blType || ''}
                              onChange={(e) => setEditingEntry({ ...editingEntry, blType: e.target.value })}
                            />
                          ) : (
                            entry.blType || 'N/A'
                          )}
                        </td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <input
                              type="checkbox"
                              checked={editingEntry.linerInvoice || false}
                              onChange={(e) => setEditingEntry({ ...editingEntry, linerInvoice: e.target.checked })}
                              className="form-check-input"
                            />
                          ) : (
                            <span className={`badge ${entry.linerInvoice ? 'bg-success' : 'bg-danger'}`}>{entry.linerInvoice ? 'Yes' : 'No'}</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${entry.status === 'completed' ? 'bg-secondary' : 'bg-primary'}`}>
                            {entry.status === 'completed' ? 'Completed' : 'Active'}
                          </span>
                        </td>
                        <td>
                          {editingEntry?.id === entry.id ? (
                            <div className="d-flex gap-1">
                              <button className="btn btn-success btn-sm" onClick={() => handleSaveEntry()}>Save</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditingEntry(null)}>Cancel</button>
                            </div>
                          ) : entry.status === 'completed' ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <div className="d-flex gap-1">
                              <button className="btn btn-primary btn-sm" onClick={() => handleEditEntry(entry)}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteEntry(entry)}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Dialog open={blTypeDialogOpen} onClose={handleBlTypeDialogClose}>
        <DialogTitle>Select BL Type</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Button variant={selectedBlType === 'OBL' ? 'contained' : 'outlined'} onClick={() => setSelectedBlType('OBL')}>OBL</Button>
            <Button variant={selectedBlType === 'SEAWAY' ? 'contained' : 'outlined'} onClick={() => setSelectedBlType('SEAWAY')}>SEAWAY</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBlTypeDialogClose}>Cancel</Button>
          <Button onClick={handleBlTypeDialogSubmit} disabled={!selectedBlType}>Submit</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={blNoDialogOpen} onClose={handleBlNoDialogClose}>
        <DialogTitle>Enter BL No</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Enter BL No"
              value={blNoInput}
              onChange={e => setBlNoInput(e.target.value)}
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBlNoDialogClose}>Cancel</Button>
          <Button onClick={handleBlNoDialogSubmit} disabled={!blNoInput.trim()}>Submit</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={blReleaseConfirmOpen} onClose={() => setBlReleaseConfirmOpen(false)}>
        <DialogTitle>Confirm B/L Release</DialogTitle>
        <DialogContent>
          <p>Are you sure you want to mark this entry as B/L Released? This will move the entry to Completed Files.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBlReleaseConfirmOpen(false); setRowForBlRelease(null); }}>Cancel</Button>
          <Button
            color="primary"
            onClick={async () => {
              setBlReleaseConfirmOpen(false);
              if (rowForBlRelease) {
                setEditingEntry({ ...rowForBlRelease, blReleased: true });
                await handleSaveEntry({ ...rowForBlRelease, blReleased: true });
                setRowForBlRelease(null);
              }
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Dashboard;