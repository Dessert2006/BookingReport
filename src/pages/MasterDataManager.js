import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import {
  getDoc,
  doc,
  updateDoc,
  collection,
  getDocs,
  runTransaction,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { toast } from "react-toastify";
import * as XLSX from 'xlsx';

function MasterDataManager() {
  const [selectedMaster, setSelectedMaster] = useState("");
  const [masterList, setMasterList] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editData, setEditData] = useState({});
  const [newEntry, setNewEntry] = useState({});
  const [oldData, setOldData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [customers, setCustomers] = useState([]);

  // NEW: search + sorting state
  const [searchText, setSearchText] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });

  // NEW: sales persons [{name, emails: []}]
  const [salesPersons, setSalesPersons] = useState([]);

  // NEW: Add/Edit Sales Person Modal state
  const [showSPModal, setShowSPModal] = useState({ open: false, target: null }); // 'add' | 'edit' | null
  const [spForm, setSpForm] = useState({ name: "", emails: "" });

  const masterOptions = [
    { value: "customer", label: "Customer", icon: "👥", color: "#0d6efd" },
    { value: "line", label: "Line", icon: "🚢", color: "#6610f2" },
    { value: "pol", label: "POL", icon: "🏭", color: "#20c997" },
    { value: "pod", label: "POD", icon: "🏢", color: "#fd7e14" },
    { value: "fpod", label: "FPOD", icon: "🌍", color: "#198754" },
    { value: "vessel", label: "Vessel", icon: "⛵", color: "#dc3545" },
    { value: "equipmentType", label: "Equipment Type", icon: "📦", color: "#6f42c1" },
  ];

  const fieldDefinitions = {
    customer: [
      { key: "name", label: "Name", required: true },
      { key: "contactPerson", label: "Contact Person" },
      { key: "customerEmail", label: "Customer Email" },
      { key: "contactNumber", label: "Contact Number" },
      { key: "address", label: "Address" },
      { key: "salesPerson", label: "Sales Person" },
      { key: "salesPersonEmail", label: "Sales Person Email" },
    ],
    line: [
      { key: "name", label: "Name", required: true },
      { key: "contactPerson", label: "Contact Person" },
      { key: "email", label: "Email" },
      { key: "contactNumber", label: "Contact Number" },
    ],
    pol: [{ key: "name", label: "Name", required: true }],
    pod: [{ key: "name", label: "Name", required: true }],
    fpod: [
      { key: "name", label: "FPOD", required: true },
      { key: "country", label: "Country" },
    ],
    vessel: [
      { key: "name", label: "Name", required: true },
      { key: "flag", label: "Flag" },
    ],
    equipmentType: [{ key: "type", label: "Type", required: true }],
  };

  // Which fields should be searchable for each master
  const searchableFieldsMap = {
    customer: ["name", "contactPerson", "customerEmail", "contactNumber", "address", "salesPerson", "salesPersonEmail"],
    line: ["name", "contactPerson", "email", "contactNumber"],
    pol: ["name"],
    pod: ["name"],
    fpod: ["name", "country"],
    vessel: ["name", "flag"], // handle string legacy too
    equipmentType: ["type"],
  };

  useEffect(() => {
    if (selectedMaster) {
      fetchMasterList(selectedMaster);
      setShowAddForm(false);

      // reset search + set default sort
      const defaultKey = selectedMaster === "equipmentType" ? "type" : "name";
      setSortConfig({ key: defaultKey, direction: "asc" });
      setSearchText("");
    }
  }, [selectedMaster]);

  useEffect(() => {
    const fetchCustomers = async () => {
      const customerSnapshot = await getDocs(collection(db, "customers"));
      setCustomers(customerSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchCustomers();
  }, []);

  // NEW: Fetch all sales persons from newMaster/customer list
  useEffect(() => {
    const fetchSalesPersons = async () => {
      try {
        const docSnap = await getDoc(doc(db, "newMaster", "customer"));
        if (docSnap.exists()) {
          const list = Array.isArray(docSnap.data().list) ? docSnap.data().list : [];
          const mp = new Map();
          for (const it of list) {
            const name = (it?.salesPerson || "").trim();
            if (!name) continue;
            const k = name.toUpperCase();
            const emails = Array.isArray(it?.salesPersonEmail) ? it.salesPersonEmail : [];
            if (!mp.has(k)) mp.set(k, { name, emails: [...emails] });
            else {
              const prev = mp.get(k);
              mp.set(k, { name: prev.name, emails: [...new Set([...prev.emails, ...emails])] });
            }
          }
          setSalesPersons(Array.from(mp.values()).sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setSalesPersons([]);
        }
      } catch (e) {
        console.error("Failed to fetch sales persons", e);
        setSalesPersons([]);
      }
    };
    fetchSalesPersons();
  }, []);

  const fetchMasterList = async (field) => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "newMaster", field);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data().list || [];
        setMasterList(Array.isArray(data) ? data : []);
        setNewEntry({});
      } else {
        setMasterList([]);
        setNewEntry({});
      }
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast.error(`Error loading ${field} data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Helpers: normalize values for search & sort ---
  const normalize = (val) => {
    if (val == null) return "";
    if (Array.isArray(val)) return val.join(", ");
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  const getCellValue = (item, key) => {
    // Vessel legacy: row might be a string (treat as name)
    if (selectedMaster === "vessel" && typeof item === "string") {
      return key === "name" ? item : "";
    }
    return item?.[key];
  };

  const defaultKey = useMemo(
    () => (selectedMaster === "equipmentType" ? "type" : "name"),
    [selectedMaster]
  );

  // --- Compute visible list (filter -> sort) ---
  const visibleList = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    const searchable = searchableFieldsMap[selectedMaster] || [];

    // 1) Filter
    let filtered = masterList.filter((item) => {
      if (!search) return true;
      return searchable.some((key) =>
        normalize(getCellValue(item, key)).toLowerCase().includes(search)
      );
    });

    // 2) Sort
    const key = sortConfig.key || defaultKey;
    const dir = sortConfig.direction === "desc" ? -1 : 1;

    filtered.sort((a, b) => {
      const aVal = normalize(getCellValue(a, key)).toLowerCase();
      const bVal = normalize(getCellValue(b, key)).toLowerCase();

      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;

      // tie-breaker: name/type
      const aT = normalize(getCellValue(a, defaultKey)).toLowerCase();
      const bT = normalize(getCellValue(b, defaultKey)).toLowerCase();
      if (aT < bT) return -1;
      if (aT > bT) return 1;
      return 0;
    });

    return filtered;
  }, [masterList, searchText, sortConfig, selectedMaster, defaultKey]);

  // Header click → toggle sort
  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortIndicator = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };

  const handleEdit = (visibleIndex) => {
    const item = visibleList[visibleIndex];
    const key = selectedMaster === "equipmentType" ? "type" : "name";

    // find actual index in masterList
    const actualIndex = masterList.findIndex((masterItem) => {
      if (selectedMaster === "vessel" && typeof item === "string") {
        return typeof masterItem === "string" && masterItem === item;
      }
      return normalize(masterItem?.[key]) === normalize(getCellValue(item, key));
    });

    setEditIndex(actualIndex);
    setEditData({
      ...(typeof item === "string" ? { name: item } : item),
      customerEmail: Array.isArray(item?.customerEmail) ? item.customerEmail.join(", ") : normalize(item?.customerEmail || ""),
      salesPersonEmail: Array.isArray(item?.salesPersonEmail) ? item.salesPersonEmail.join(", ") : normalize(item?.salesPersonEmail || ""),
    });
    setOldData(typeof item === "string" ? { name: item } : item);
  };

  const handleSave = async (actualIndex) => {
    setIsLoading(true);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const updatedData = {
      ...editData,
      customerEmail: editData.customerEmail
        ? editData.customerEmail.split(",").map((e) => e.trim()).filter(Boolean)
        : [],
      salesPersonEmail: editData.salesPersonEmail
        ? editData.salesPersonEmail.split(",").map((e) => e.trim()).filter(Boolean)
        : [],
    };

    if (selectedMaster === "customer") {
      if (updatedData.customerEmail.some((e) => e && !emailRegex.test(e))) {
        toast.error("Please enter valid customer email addresses.");
        setIsLoading(false);
        return;
      }
      if (updatedData.salesPersonEmail.some((e) => e && !emailRegex.test(e))) {
        toast.error("Please enter valid sales person email addresses.");
        setIsLoading(false);
        return;
      }
    }

    const updatedList = [...masterList];
    updatedList[actualIndex] = updatedData;

    const docRef = doc(db, "newMaster", selectedMaster);
    try {
      await updateDoc(docRef, { list: updatedList });
      toast.success("Master data updated successfully!");
      setMasterList(updatedList);
      setEditIndex(null);

      if (selectedMaster === "customer") {
        const hasChanges = Object.keys(updatedData).some(
          (k) => JSON.stringify(updatedData[k]) !== JSON.stringify(oldData[k])
        );
        if (hasChanges) {
          await syncEntriesWithMaster(oldData.name, updatedData, selectedMaster);
        }
      }
    } catch (error) {
      console.error("Error updating document:", error);
      toast.error(`Failed to update ${selectedMaster} data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (visibleIndex) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;

    setIsLoading(true);
    const itemToDelete = visibleList[visibleIndex];
    const key = selectedMaster === "equipmentType" ? "type" : "name";
    const valueToDelete =
      selectedMaster === "vessel" && typeof itemToDelete === "string"
        ? itemToDelete
        : itemToDelete?.[key];

    const docRef = doc(db, "newMaster", selectedMaster);
    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        let currentList = [];
        if (docSnap.exists()) {
          currentList = Array.isArray(docSnap.data().list) ? docSnap.data().list : [];
        }

        const firestoreIndex = currentList.findIndex((it) => {
          if (selectedMaster === "vessel" && typeof valueToDelete === "string") {
            return (typeof it === "string" ? it : it?.name) === valueToDelete;
          }
          return normalize(it?.[key]) === normalize(valueToDelete);
        });

        if (firestoreIndex === -1) {
          throw new Error(`Item ${valueToDelete} not found in Firestore`);
        }

        const updatedList = [...currentList];
        updatedList.splice(firestoreIndex, 1);
        transaction.set(docRef, { list: updatedList }, { merge: true });
      });

      await fetchMasterList(selectedMaster);
      toast.success("Master data deleted successfully!");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(`Failed to delete ${selectedMaster} data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // EDIT form changes (auto-fill on Sales Person change)
  const handleChange = (field, value) => {
    if (selectedMaster === "customer" && field === "salesPerson") {
      const val = (value || "").toUpperCase();
      const found = salesPersons.find(sp => sp.name.toUpperCase() === val);
      setEditData(prev => ({
        ...prev,
        salesPerson: val,
        salesPersonEmail: found?.emails?.length ? found.emails.join(", ") : (prev.salesPersonEmail || "")
      }));
      return;
    }
    setEditData({ ...editData, [field]: value });
  };

  // ADD form changes (auto-fill on Sales Person change)
  const handleNewEntryChange = (field, value) => {
    if (selectedMaster === "customer" && field === "salesPerson") {
      const val = (value || "").toUpperCase();
      const found = salesPersons.find(sp => sp.name.toUpperCase() === val);
      setNewEntry(prev => ({
        ...prev,
        salesPerson: val,
        salesPersonEmail: found?.emails?.length ? found.emails.join(", ") : (prev.salesPersonEmail || "")
      }));
      return;
    }
    setNewEntry({
      ...newEntry,
      [field]: field.includes("Email") ? value : (value || "").toUpperCase(),
    });
  };

  const handleAddNewEntry = async () => {
    const requiredFields = fieldDefinitions[selectedMaster].filter((f) => f.required);
    const hasRequiredFields = requiredFields.every((f) => newEntry[f.key] && newEntry[f.key].trim());
    if (!hasRequiredFields) {
      toast.error("Please fill all required fields before adding.");
      return;
    }

    setIsLoading(true);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const updatedEntry = {
      ...newEntry,
      customerEmail: newEntry.customerEmail
        ? newEntry.customerEmail.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
        : [],
      salesPersonEmail: newEntry.salesPersonEmail
        ? newEntry.salesPersonEmail.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
        : [],
    };

    if (selectedMaster === "customer") {
      if (updatedEntry.customerEmail.some((e) => e && !emailRegex.test(e))) {
        toast.error("Please enter valid customer email addresses.");
        setIsLoading(false);
        return;
      }
      if (updatedEntry.salesPersonEmail.some((e) => e && !emailRegex.test(e))) {
        toast.error("Please enter valid sales person email addresses.");
        setIsLoading(false);
        return;
      }
    }

    const docRef = doc(db, "newMaster", selectedMaster);
    try {
      const docSnap = await getDoc(docRef);
      let updatedList = [];

      if (docSnap.exists()) {
        const existingData = docSnap.data().list || [];
        const isDuplicate = existingData.some(
          (item) =>
            (item.name || item.type)?.toUpperCase() ===
            (updatedEntry.name || updatedEntry.type)?.toUpperCase()
        );
        if (isDuplicate) {
          toast.error(
            `${selectedMaster} '${updatedEntry.name || updatedEntry.type}' already exists.`
          );
          setIsLoading(false);
          return;
        }
        updatedList = [...existingData, updatedEntry];
      } else {
        updatedList = [updatedEntry];
      }

      await updateDoc(docRef, { list: updatedList });

      // add customerId to newly added customer (kept from your original)
      if (selectedMaster === "customer") {
        const updatedDocSnap = await getDoc(docRef);
        if (updatedDocSnap.exists()) {
          let listWithId = updatedDocSnap.data().list || [];
          const lastIndex = listWithId.length - 1;
          if (lastIndex >= 0 && !listWithId[lastIndex].customerId) {
            listWithId[lastIndex].customerId = docRef.id;
            await updateDoc(docRef, { list: listWithId });
          }
        }
      }

      toast.success("New master data added successfully!");
      setMasterList(updatedList);
      setNewEntry({});
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding new entry:", error);
      toast.error(`Failed to add ${selectedMaster} data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const syncEntriesWithMaster = async (oldName, newData, fieldType) => {
    try {
      const entriesQuery = query(
        collection(db, "entries"),
        where(`${fieldType}.name`, "==", oldName)
      );
      const entriesSnapshot = await getDocs(entriesQuery);
      const updates = [];

      for (const entryDoc of entriesSnapshot.docs) {
        const entryId = entryDoc.id;
        const docRef = doc(db, "entries", entryId);
        updates.push(
          updateDoc(docRef, {
            [fieldType]: {
              ...newData,
              customerEmail: newData.customerEmail || [],
              salesPersonEmail: newData.salesPersonEmail || [],
            },
          })
        );
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        toast.success(`Entries synced for ${fieldType}: ${oldName} ➔ ${newData.name}`);
      } else {
        toast.info("No matching entries found to update.");
      }
    } catch (error) {
      console.error("Error syncing entries:", error);
      toast.error(`Failed to sync entries for ${fieldType}: ${error.message}`);
    }
  };

  const exportToExcel = () => {
    if (!masterList.length) {
      toast.error("No data available to export.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(masterList);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, selectedMaster || "Data");

    const fileName = `${selectedMaster || "data"}_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Data exported successfully!");
  };

  const getCurrentMasterOption = () =>
    masterOptions.find((option) => option.value === selectedMaster) || {};
  const getFieldsForMaster = () => fieldDefinitions[selectedMaster] || [];

  // --- Sales Person Modal helpers ---
  const openSPModal = (target) => {
    // Prefill from current form
    if (target === "edit") {
      setSpForm({
        name: (editData?.salesPerson || "").toUpperCase(),
        emails: (editData?.salesPersonEmail || "").toString(),
      });
    } else {
      setSpForm({
        name: (newEntry?.salesPerson || "").toUpperCase(),
        emails: (newEntry?.salesPersonEmail || "").toString(),
      });
    }
    setShowSPModal({ open: true, target });
  };

  const saveSPModal = () => {
    const name = (spForm.name || "").trim().toUpperCase();
    const emails = (spForm.emails || "")
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (!name) {
      toast.error("Sales Person name is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emails.some(e => e && !emailRegex.test(e))) {
      toast.error("Please enter valid email address(es).");
      return;
    }

    // Update respective form (add/edit)
    if (showSPModal.target === "edit") {
      setEditData(prev => ({
        ...prev,
        salesPerson: name,
        salesPersonEmail: emails.join(", ")
      }));
    } else {
      setNewEntry(prev => ({
        ...prev,
        salesPerson: name,
        salesPersonEmail: emails.join(", ")
      }));
    }

    // Update in-memory dropdown list so it's selectable immediately
    setSalesPersons(prev => {
      const idx = prev.findIndex(sp => sp.name.toUpperCase() === name);
      if (idx >= 0) {
        const merged = Array.from(new Set([...prev[idx].emails, ...emails]));
        const updated = [...prev];
        updated[idx] = { name, emails: merged };
        return updated.sort((a, b) => a.name.localeCompare(b.name));
      }
      return [...prev, { name, emails }].sort((a, b) => a.name.localeCompare(b.name));
    });

    setShowSPModal({ open: false, target: null });
    setSpForm({ name: "", emails: "" });
    toast.success("Sales Person added to the list.");
  };

  const closeSPModal = () => {
    setShowSPModal({ open: false, target: null });
    setSpForm({ name: "", emails: "" });
  };

  return (
    <div
      className="container-fluid py-4"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
      }}
    >
      <style>{`
        .master-selector-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          padding: 2rem;
          border: 1px solid #e9ecef;
          margin-bottom: 2rem;
        }
        .master-option { display:flex; align-items:center; padding:1rem; border:2px solid #e9ecef; border-radius:8px; margin-bottom:0.5rem; cursor:pointer; transition:all 0.2s ease; background:white;}
        .master-option:hover { border-color:#0d6efd; transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.1);}
        .master-option.selected { border-color:var(--color); background:rgba(13,110,253,0.05); }
        .master-icon { font-size:2rem; margin-right:1rem; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(13,110,253,0.1); }
        .data-container { background:white; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.08); border:1px solid #e9ecef; overflow:hidden; }
        .data-header { padding:1.5rem 2rem; border-bottom:2px solid #e9ecef; background:#f8f9fa; position:sticky; top:0; z-index:10; box-shadow:0 2px 4px rgba(0,0,0,0.1); }
        .form-control { border:2px solid #e9ecef; border-radius:8px; padding:0.75rem 1rem; font-size:0.95rem; transition:all 0.2s ease;}
        .form-control:focus { border-color:#0d6efd; box-shadow:0 0 0 0.2rem rgba(13,110,253,0.15); outline:none; }
        .btn { font-weight:600; border-radius:8px; padding:0.75rem 1.5rem; transition:all 0.2s ease;}
        .btn:hover:not(:disabled){ transform:translateY(-1px); }
        .table-container { max-height: 600px; overflow-y:auto; position:relative; }
        .grid-table { margin-bottom:0; border-collapse:separate; border-spacing:0; }
        .grid-table th { background-color:#f8f9fa; border:1px solid #dee2e6; border-bottom:2px solid #adb5bd; color:#495057; font-weight:600; text-transform:uppercase; font-size:0.8rem; letter-spacing:0.5px; padding:1rem 0.75rem; position:sticky; top:0; z-index:5; vertical-align:middle; user-select:none; cursor:pointer; }
        .grid-table td { vertical-align:middle; border:1px solid #dee2e6; padding:0.75rem; background-color:white; }
        .grid-table tbody tr:hover td { background-color:#f8f9fa; }
        .stats-card { background:white; border-radius:8px; padding:1rem; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.05); border:1px solid #e9ecef; }
        .stats-number { font-size:2rem; font-weight:bold; margin-bottom:0.5rem; }
        .action-btn { width:32px; height:32px; border-radius:6px; border:none; display:flex; align-items:center; justify-content:center; font-size:0.875rem; transition:all 0.2s ease; cursor:pointer; }
        .edit-btn { background-color:#f8f9fa; color:#6c757d; border:1px solid #dee2e6;}
        .delete-btn { background-color:#f8f9fa; color:#dc3545; border:1px solid #dee2e6;}
        .save-btn { background-color:#d1edff; color:#0c63e4; border:1px solid #b8daff;}
        .cancel-btn { background-color:#f8f9fa; color:#6c757d; border:1px solid #dee2e6;}
        .add-form-container { background:#f8f9fa; border:1px solid #e9ecef; border-top:2px solid #dee2e6; padding:1.5rem; position:sticky; top:120px; z-index:8; box-shadow:0 2px 4px rgba(0,0,0,0.05); }
        .search-wrap { position:relative; }
        .clear-btn { position:absolute; right:10px; top:50%; transform:translateY(-50%); border:none; background:transparent; font-size:1rem; opacity:0.6; }
        .clear-btn:hover { opacity:1; }

        /* NEW: inline select + plus button row */
        .sp-inline { display:flex; gap:8px; align-items:center; }
        .sp-add-btn { width:40px; height:40px; border-radius:8px; border:1px solid #dee2e6; background:#f8f9fa; color:#495057; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .sp-add-btn:hover { background:#eef2f7; }

        /* NEW: simple modal for adding sales person */
        .sp-modal {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0,0,0,0.55);
          z-index: 1050;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .sp-modal-dialog {
          width: 100%;
          max-width: 480px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          overflow: hidden;
        }
        .sp-modal-header {
          background:#495057;
          color:#fff;
          padding: 1rem 1.25rem;
          display:flex; align-items:center; justify-content:space-between;
        }
        .sp-modal-body { padding: 1rem 1.25rem; }
        .sp-modal-footer { padding: 0.75rem 1.25rem; background:#f8f9fa; display:flex; justify-content:flex-end; gap:8px; }
      `}</style>

      <div className="container">
        <div className="row mb-4">
          <div className="col-12">
            <h1 className="display-6 mb-2" style={{ color: "#2c3e50", fontWeight: "700" }}>
              Master Data Manager
            </h1>
            <p className="text-muted">Manage and edit your master data efficiently</p>
          </div>
        </div>

        <div className="master-selector-card">
          <h5 className="mb-4">Select Master Data Type</h5>
          <div className="row">
            {masterOptions.map((option) => (
              <div className="col-lg-3 col-md-4 col-sm-6" key={option.value}>
                <div
                  className={`master-option ${selectedMaster === option.value ? "selected" : ""}`}
                  style={{ "--color": option.color }}
                  onClick={() => setSelectedMaster(option.value)}
                >
                  <div
                    className="master-icon"
                    style={{ backgroundColor: `${option.color}15`, color: option.color }}
                  >
                    {option.icon}
                  </div>
                  <div>
                    <div className="fw-semibold">{option.label}</div>
                    <small className="text-muted">
                      {fieldDefinitions[option.value]?.length || 0} fields
                    </small>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedMaster ? (
          <div className="data-container">
            <div className="data-header d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div className="d-flex align-items-center">
                <span
                  className="me-3"
                  style={{ fontSize: "1.5rem", color: getCurrentMasterOption()?.color }}
                >
                  {getCurrentMasterOption()?.icon}
                </span>
                <div>
                  <h5 className="mb-0">{getCurrentMasterOption()?.label} Management</h5>
                  <small className="text-muted">
                    {visibleList.length} of {masterList.length} record
                    {masterList.length !== 1 ? "s" : ""} shown
                  </small>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div className="search-wrap" style={{ minWidth: 260 }}>
                  <input
                    className="form-control"
                    placeholder={`Search ${getCurrentMasterOption()?.label?.toLowerCase()}...`}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                  {searchText && (
                    <button className="clear-btn" onClick={() => setSearchText("")} title="Clear">
                      ×
                    </button>
                  )}
                </div>

                <div className="stats-card">
                  <div
                    className="stats-number"
                    style={{ color: getCurrentMasterOption()?.color }}
                  >
                    {masterList.length}
                  </div>
                  <small>Total Records</small>
                </div>

                <button
                  className="btn text-white"
                  style={{
                    backgroundColor: getCurrentMasterOption()?.color,
                    borderColor: getCurrentMasterOption()?.color,
                  }}
                  onClick={() => setShowAddForm(!showAddForm)}
                  disabled={isLoading}
                >
                  {showAddForm ? "Cancel" : "Add New"}
                </button>

                <button
                  className="btn btn-outline-primary"
                  onClick={exportToExcel}
                  disabled={isLoading}
                >
                  Export to Excel
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="add-form-container">
                <h6 className="mb-3">Add New {getCurrentMasterOption()?.label}</h6>
                <div className="row g-3">
                  {getFieldsForMaster().map((field) => (
                    <div className="col-md-4" key={field.key}>
                      <label className="form-label">
                        {field.label}
                        {field.required && <span className="text-danger ms-1">*</span>}
                      </label>

                      {/* Customer: Sales Person dropdown + + button */}
                      {selectedMaster === "customer" && field.key === "salesPerson" ? (
                        <div className="sp-inline">
                          <select
                            className="form-control"
                            value={newEntry.salesPerson || ""}
                            onChange={(e) => handleNewEntryChange("salesPerson", e.target.value)}
                            style={{ textTransform: "uppercase" }}
                          >
                            <option value="">Select Sales Person</option>
                            {salesPersons.map(sp => (
                              <option key={sp.name} value={sp.name}>{sp.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="sp-add-btn"
                            title="Add Sales Person"
                            onClick={() => openSPModal("add")}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          className="form-control"
                          placeholder={`Enter ${field.label.toLowerCase()}${
                            field.key.includes("Email") ? " (comma-separated)" : ""
                          }`}
                          value={newEntry[field.key] || ""}
                          onChange={(e) => handleNewEntryChange(field.key, e.target.value)}
                          style={field.key.includes("Email") ? { textTransform: "none" } : undefined}
                        />
                      )}
                    </div>
                  ))}
                  <div className="col-12">
                    <button className="btn btn-success me-2" onClick={handleAddNewEntry} disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Adding...
                        </>
                      ) : (
                        "Add Entry"
                      )}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="table-container">
              {isLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-3"></div>
                  <p className="text-muted">Loading data...</p>
                </div>
              ) : masterList.length > 0 ? (
                <table className="grid-table table">
                  <thead>
                    <tr>
                      {getFieldsForMaster().map((field) => (
                        <th key={field.key} onClick={() => toggleSort(field.key)} title="Click to sort">
                          {field.label} &nbsp;
                          <span style={{ opacity: 0.7 }}>{sortIndicator(field.key)}</span>
                        </th>
                      ))}
                      <th style={{ width: "150px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleList.map((item, visibleIndex) => {
                      // find actual index for edit/save mapping
                      const key = selectedMaster === "equipmentType" ? "type" : "name";
                      const actualIndex = masterList.findIndex((masterItem) => {
                        if (selectedMaster === "vessel" && typeof item === "string") {
                          return typeof masterItem === "string" && masterItem === item;
                        }
                        return normalize(masterItem?.[key]) === normalize(getCellValue(item, key));
                      });

                      const isEditing = editIndex === actualIndex;

                      return (
                        <tr key={visibleIndex}>
                          {getFieldsForMaster().map((field) => (
                            <td key={field.key}>
                              {isEditing ? (
                                // EDITING MODE
                                selectedMaster === "customer" && field.key === "salesPerson" ? (
                                  <div className="sp-inline">
                                    <select
                                      className="form-control form-control-sm"
                                      value={editData.salesPerson || ""}
                                      onChange={(e) => handleChange("salesPerson", e.target.value)}
                                      style={{ textTransform: "uppercase" }}
                                    >
                                      <option value="">Select Sales Person</option>
                                      {salesPersons.map(sp => (
                                        <option key={sp.name} value={sp.name}>{sp.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="sp-add-btn"
                                      title="Add Sales Person"
                                      onClick={() => openSPModal("edit")}
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editData[field.key] || ""}
                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                    style={field.key.includes("Email") ? { textTransform: "none" } : undefined}
                                  />
                                )
                              ) : selectedMaster === "vessel" && typeof item === "string" ? (
                                field.key === "name" ? <span>{item}</span> : <span />
                              ) : selectedMaster === "vessel" && !getCellValue(item, field.key) ? (
                                <span style={{ color: "red", fontSize: "0.8em" }}>
                                  {JSON.stringify(item)}
                                </span>
                              ) : (
                                <span>
                                  {field.key.includes("Email")
                                    ? (getCellValue(item, field.key) || []).join(", ")
                                    : normalize(getCellValue(item, field.key))}
                                </span>
                              )}
                            </td>
                          ))}
                          <td>
                            <div className="d-flex gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    className="action-btn save-btn"
                                    onClick={() => handleSave(actualIndex)}
                                    disabled={isLoading}
                                    title="Save changes"
                                  >
                                    {isLoading ? (
                                      <div className="spinner-border" style={{ width: 12, height: 12 }}></div>
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                        <polyline points="17,21 17,13 7,13 7,21" />
                                        <polyline points="7,3 7,8 15,8" />
                                      </svg>
                                    )}
                                  </button>
                                  <button
                                    className="action-btn cancel-btn"
                                    onClick={() => setEditIndex(null)}
                                    title="Cancel editing"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="action-btn edit-btn"
                                    onClick={() => handleEdit(visibleIndex)}
                                    disabled={isLoading}
                                    title="Edit this entry"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    className="action-btn delete-btn"
                                    onClick={() => handleDelete(visibleIndex)}
                                    disabled={isLoading}
                                    title="Delete this entry"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3,6 5,6 21,6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      <line x1="10" y1="11" x2="10" y2="17" />
                                      <line x1="14" y1="11" x2="14" y2="17" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state text-center p-5">
                  <div className="empty-state-icon">{getCurrentMasterOption()?.icon}</div>
                  <h5>No {getCurrentMasterOption()?.label} Records Found</h5>
                  <p className="text-muted">
                    Start by adding your first {getCurrentMasterOption()?.label?.toLowerCase()} entry.
                  </p>
                  <button
                    className="btn text-white"
                    style={{
                      backgroundColor: getCurrentMasterOption()?.color,
                      borderColor: getCurrentMasterOption()?.color,
                    }}
                    onClick={() => setShowAddForm(true)}
                  >
                    Add First Entry
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-5">
            <div style={{ fontSize: "4rem", marginBottom: "1rem", opacity: 0.3 }}>📊</div>
            <h5 className="text-muted">Select a master data type to begin</h5>
            <p className="text-muted">Choose from the options above to view and manage your data</p>
          </div>
        )}
      </div>

      {/* NEW: Sales Person Modal */}
      {showSPModal.open && (
        <div className="sp-modal" role="dialog" aria-modal="true">
          <div className="sp-modal-dialog">
            <div className="sp-modal-header">
              <strong>Add Sales Person</strong>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={closeSPModal}
                style={{ borderRadius: 6 }}
              >
                ✕
              </button>
            </div>
            <div className="sp-modal-body">
              <div className="mb-3">
                <label className="form-label">Sales Person Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={spForm.name}
                  onChange={(e) => setSpForm({ ...spForm, name: e.target.value.toUpperCase() })}
                  placeholder="Enter name"
                  style={{ textTransform: "uppercase" }}
                />
              </div>
              <div className="mb-2">
                <label className="form-label">Sales Person Email(s)</label>
                <input
                  type="text"
                  className="form-control"
                  value={spForm.emails}
                  onChange={(e) => setSpForm({ ...spForm, emails: e.target.value })}
                  placeholder="comma-separated (e.g., john@x.com, j.smith@x.com)"
                  style={{ textTransform: "none" }}
                />
              </div>
              <small className="text-muted">Tip: You can enter multiple emails, separated by commas.</small>
            </div>
            <div className="sp-modal-footer">
              <button className="btn btn-secondary" onClick={closeSPModal}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSPModal}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterDataManager;
