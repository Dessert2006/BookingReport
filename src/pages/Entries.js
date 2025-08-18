import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  setDoc,
  arrayUnion
} from "firebase/firestore";
import { DataGridPro } from "@mui/x-data-grid-pro";
import {
  TextField,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  FormControlLabel,
  IconButton,
  Box
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import axios from "axios";
import AuditTrail from "../components/AuditTrail";

/* -------------------------- utils / helpers -------------------------- */
const norm = (s) =>
  (s ?? "").toString().trim().replace(/\s+/g, " ").toUpperCase();

const coerceEmails = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const isUSFpod = (fpod, master = []) => {
  const s = (fpod || "").toString().trim().toUpperCase();
  if (/\b(USA|UNITED STATES|UNITED STATES OF AMERICA|U\.S\.A\.|U\.S\.)\b/.test(s))
    return true;
  const _norm = (x) =>
    (x || "").toString().trim().replace(/\s+/g, " ").toUpperCase();
  const hit = master.find((m) => _norm(m) === _norm(s));
  return (
    !!hit &&
    /\b(USA|UNITED STATES|UNITED STATES OF AMERICA|U\.S\.A\.|U\.S\.)\b/.test(
      hit.toUpperCase()
    )
  );
};

const styles = `
  .highlight-row { background-color: #FFFF00; }
  .location-button {
    margin: 5px; padding: 8px 16px; border: 2px solid #1976d2; background-color: white;
    color: #1976d2; border-radius: 20px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;
  }
  .location-button.active { background-color: #1976d2; color: white; }
  .location-button:hover { background-color: #1976d2; color: white; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
  .sort-button {
    margin: 3px; padding: 8px 14px; border: 2px solid #2e7d32; background-color: white; color: #2e7d32;
    border-radius: 15px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 5px;
  }
  .sort-button:hover {
    background-color: #2e7d32; color: white; transform: translateY(-2px); box-shadow: 0 3px 6px rgba(0,0,0,0.2);
  }
  .single-grid-container {
    height: 600px; width: 100%; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;
  }
`;

const entryFields = {
  customer: "Customer",
  salesPersonName: "Sales",
  bookingDate: "Booking Date",
  bookingNo: "Booking No",
  bookingValidity: "BKG Validity",
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
  firstPrinted: "First Print",
  correctionsFinalised: "Corrections Finalised",
  linerInvoice: "Liner Invoice",
  blReleased: "B/L Released",
  referenceNo: "Reference NO",
  blType: "BL Type",
  remarks: "Remarks"
};

/* ================================ COMPONENT ================================ */
function Entries(props) {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fpodMaster, setFpodMaster] = useState([]);
  const [locations, setLocations] = useState([]);

  // Duplicate UI state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [rowToDuplicate, setRowToDuplicate] = useState(null);
  const [newBookingNo, setNewBookingNo] = useState("");
  const [newContainerNo, setNewContainerNo] = useState("");
  const [keepStatuses, setKeepStatuses] = useState(false);

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

  // First Print dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [blNoInput, setBlNoInput] = useState("");

  // B/L Released confirm
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rowToComplete, setRowToComplete] = useState(null);

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState(null);

  // SOB
  const [sobDialogOpen, setSobDialogOpen] = useState(false);
  const [sobDateInput, setSobDateInput] = useState("");
  const [rowForSob, setRowForSob] = useState(null);
  const [sobConfirmDialogOpen, setSobConfirmDialogOpen] = useState(false);
  const [sobResult, setSobResult] = useState(null);
  const [containerNoDialogOpen, setContainerNoDialogOpen] = useState(false);
  const [sobMissingDialogOpen, setSobMissingDialogOpen] = useState(false);
  const [sobMissingFields, setSobMissingFields] = useState([]);
  const [mailStatusDialogOpen, setMailStatusDialogOpen] = useState(false);
  const [mailStatus, setMailStatus] = useState({ success: false, message: "" });

  // SI → BL Type
  const [blTypeDialogOpen, setBlTypeDialogOpen] = useState(false);
  const [selectedBlType, setSelectedBlType] = useState("");
  const [rowForBlType, setRowForBlType] = useState(null);

  // Audit
  const [page] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);

  // Missing email dialog
  const [missingEmailDialogOpen, setMissingEmailDialogOpen] = useState(false);
  const [missingEmailFields, setMissingEmailFields] = useState([]);

  // Add Vessel
  const [addVesselDialogOpen, setAddVesselDialogOpen] = useState(false);
  const [newVesselName, setNewVesselName] = useState("");

  // Add state for checkbox filter
  const [checkboxFilter, setCheckboxFilter] = useState("all"); // Options: "all", "checked", "unchecked"

  const gridContainerRef = useRef(null);
  let touchStartX = null;
  let touchStartY = null;

  /* ----------------------------- booking checkers ---------------------------- */
  const normalizeBookingNo = (s) =>
    (s || "").toString().toLowerCase().replace(/[^a-z0-9]/gi, "");
  const bookingNoExists = async (bookingNo) => {
    // strict
    const q1 = query(collection(db, "entries"), where("bookingNo", "==", bookingNo));
    const snap = await getDocs(q1);
    if (!snap.empty) return true;
    // normalized
    const all = await getDocs(collection(db, "entries"));
    return all.docs.some(
      (d) =>
        normalizeBookingNo(d.data().bookingNo) ===
        normalizeBookingNo(bookingNo)
    );
  };

  /* ------------------------------ misc formatters ------------------------------ */
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
        dayNum >= 1 &&
        dayNum <= 31 &&
        monthNum >= 1 &&
        monthNum <= 12 &&
        hourNum >= 0 &&
        hourNum <= 23 &&
        minuteNum >= 0 &&
        minuteNum <= 59
      ) {
        return `${day}/${month}-${hour}${minute} HRS`;
      } else {
        toast.error(
          "Invalid date or time. Please enter a valid DDMMHHMM (e.g., 06061800 for 06/06-1800 HRS)"
        );
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
    if (!value || typeof value !== "string") return value;
    let fixed = value;
    fixed = fixed.replace(
      /(\d+\s*x\s*\d+['\s]*(?:STD|HC|DV|RF|OT|TK|GP))(?=\d+\s*x\s*\d+)/gi,
      "$1, "
    );
    fixed = fixed.replace(
      /([A-Z]{4}\d{6,7})(?=[A-Z]{4}\d{6,7})/gi,
      "$1, "
    );
    fixed = fixed.replace(
      /((?:CONTAINER|CONU|TEMU|MSKU|TCLU|GESU)\d+)(?=(?:CONTAINER|CONU|TEMU|MSKU|TCLU|GESU))/gi,
      "$1, "
    );
    return fixed;
  };

  const parseAdvancedQuery = (query) => {
    if (!query) return [];
    const stopWords = ["details", "of", "on", "with", "for", "in", "at"];
    const tokens = query
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .split(/\s+/)
      .filter((t) => t && !stopWords.includes(t));
    return tokens;
  };

  const applySorting = (data, currentSortModel) => {
    if (!currentSortModel || currentSortModel.length === 0) return data;
    return [...data].sort((a, b) => {
      for (const sortItem of currentSortModel) {
        const { field, sort } = sortItem;
        let aValue = a[field];
        let bValue = b[field];

        if (field === "customer") {
          aValue = (typeof aValue === "object" ? aValue?.name : aValue) || "";
          bValue = (typeof bValue === "object" ? bValue?.name : bValue) || "";
        } else if (["bookingDate", "bookingValidity", "etd", "sobDate"].includes(field)) {
          const aDate = aValue ? new Date(aValue) : new Date(0);
          const bDate = bValue ? new Date(bValue) : new Date(0);
          aValue = aDate.getTime();
          bValue = bDate.getTime();
        } else {
          aValue = (aValue || "").toString().toLowerCase();
          bValue = (bValue || "").toString().toLowerCase();
        }

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        else if (aValue > bValue) comparison = 1;

        if (comparison !== 0) return sort === "desc" ? -comparison : comparison;
      }
      return 0;
    });
  };

  const normalizeForSearch = (str) =>
    !str ? "" : str.toString().toLowerCase().replace(/[^a-z0-9]/gi, "");

  const applyFilters = () => {
    let filtered = [...entries];

    if (activeLocationFilter === "NOMINATION") {
      filtered = filtered.filter((entry) => entry.isNominated === true);
    } else if (selectedLocations.length > 0) {
      filtered = filtered.filter((entry) =>
        selectedLocations.includes(entry.location)
      );
    }

    if (searchQuery) {
      const tokens = parseAdvancedQuery(searchQuery);
      filtered = filtered.filter((entry) =>
        tokens.every((token) => {
          const normalizedToken = normalizeForSearch(token);
          const textFields = [
            "location",
            "customer",
            "line",
            "pol",
            "pod",
            "fpod",
            "vessel",
            "bookingNo",
            "containerNo",
            "volume",
            "voyage",
            "blNo",
            "equipmentType",
            "portCutOff",
            "siCutOff",
            "salesPersonName",
            "referenceNo",
            "remarks"
          ];
          const textMatch = textFields.some((field) => {
            const value =
              typeof entry[field] === "object"
                ? entry[field]?.name
                : entry[field];
            return value && normalizeForSearch(value).includes(normalizedToken);
          });

          const dateFields = ["bookingDate", "bookingValidity", "etd", "sobDate"];
          const normalizedDate = normalizeDate(token);
          const dateMatch =
            normalizedDate &&
            dateFields.some((field) => entry[field] === normalizedDate);

          const booleanFields = [
            "vgmFiled",
            "siFiled",
            "finalDG",
            "firstPrinted",
            "correctionsFinalised",
            "linerInvoice",
            "blReleased",
            "isfSent",
            "sob"
          ];
          const booleanMatch = booleanFields.some((field) => {
            if (token === "yes" || token === "true" || token === "filed") {
              return entry[field] === true;
            }
            if (token === "no" || token === "false") {
              return entry[field] === false;
            }
            return false;
          });

          return textMatch || dateMatch || booleanMatch;
        })
      );
    }

    // Apply checkbox filter
    if (checkboxFilter === "checked") {
      filtered = filtered.filter((entry) => entry.specificCheckboxField === true);
    } else if (checkboxFilter === "unchecked") {
      filtered = filtered.filter((entry) => entry.specificCheckboxField === false);
    }

    filtered = applySorting(filtered, sortModel);
    setFilteredEntries(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [entries, searchQuery, selectedLocations, sortModel, activeLocationFilter]);

  /* ------------------------ fetch entries + master data ----------------------- */
  useEffect(() => {
    const fetchEntries = async () => {
      const querySnapshot = await getDocs(collection(db, "entries"));
      const entryList = [];
      const locationSet = new Set();

      const customerDoc = await getDoc(doc(db, "newMaster", "customer"));
      const customerMasterList = customerDoc.exists()
        ? customerDoc.data().list || []
        : [];

      querySnapshot.forEach((docSnap) => {
        const entryData = { ...docSnap.data(), id: docSnap.id };
        let customerObj = entryData.customer;
        if (typeof customerObj === "string") {
          const target = norm(customerObj);
          customerObj =
            customerMasterList.find((item) => norm(item.name) === target) || {
              name: customerObj,
              salesPerson: "",
              customerEmail: "",
              salesPersonEmail: ""
            };
        }

        // derive top-level containerNo string
        let containerNo = "";
        if (Array.isArray(entryData.equipmentDetails)) {
          containerNo = entryData.equipmentDetails
            .map((eq) => eq.containerNo)
            .filter(Boolean)
            .join(", ");
        } else if (Array.isArray(entryData.containerNo)) {
          containerNo = entryData.containerNo.filter(Boolean).join(", ");
        } else if (typeof entryData.containerNo === "string") {
          containerNo = entryData.containerNo;
        } else if (entryData.containerNo) {
          containerNo = String(entryData.containerNo);
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
          equipmentType:
            entryData.equipmentType?.type || entryData.equipmentType || "",
          volume: Array.isArray(entryData.volume)
            ? entryData.volume.join(", ")
            : entryData.volume || "",
          containerNo: containerNo,
          isfSent: entryData.isfSent || false,
          sob: entryData.sob || false,
          sobDate: entryData.sobDate || "",
          finalDG: entryData.finalDG || false,
          blNo: entryData.blNo || "",
          linerInvoice: entryData.linerInvoice || false,
          invoiceNo: "",
          isNominated: entryData.isNominated || false
        });

        if (entryData.location) {
          locationSet.add(
            entryData.location?.name || entryData.location || ""
          );
        }
      });

      setEntries(entryList);
      setLocations([...locationSet]);
    };

    const fetchMasterData = async () => {
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
          let list = (docSnap.data().list || []).map((item) =>
            field === "fpod"
              ? `${item.name}, ${item.country}`
              : field === "customer"
              ? item.name
              : (item.name || item.type || item || "")
          );
          list = list.sort((a, b) =>
            a.toString().localeCompare(b.toString(), undefined, {
              sensitivity: "base"
            })
          );
          newMasterData[field] = list;
        }
      }
      setMasterData(newMasterData);
      setFpodMaster(newMasterData.fpod);
    };

    fetchEntries();
    fetchMasterData();
  }, []);

  /* --------------------------------- sorting -------------------------------- */
  const handleQuickSort = (field, direction) =>
    setSortModel([{ field, sort: direction }]);
  const handleClearSort = () => setSortModel([]);

  /* ------------------------------- filter UI -------------------------------- */
  const handleLocationButtonFilter = (location) => {
    setActiveLocationFilter(location);
    if (location === "SEE ALL" || location === "NOMINATION") {
      setSelectedLocations([]);
    } else {
      setSelectedLocations([location]);
    }
  };

  const handleSearch = (e) => setSearchQuery(e.target.value);

  const handleLocationFilter = (location, checked) => {
    const newSelected = checked
      ? [...selectedLocations, location]
      : selectedLocations.filter((loc) => loc !== location);
    setSelectedLocations(newSelected);
  };

  /* --------------------------------- audit ---------------------------------- */
  const getAuditAction = (field, user, value) => ({
    field,
    user,
    value,
    timestamp: new Date().toISOString()
  });

  /* ------------------------------ row updating ------------------------------ */
  const handleProcessRowUpdate = async (newRow, oldRow) => {
    try {
  // No length limit enforced for volume edits. Keep the full value provided by the user.

      const formattedPortCutOff = newRow.portCutOff
        ? formatCutOffInput(newRow.portCutOff)
        : newRow.portCutOff;
      const formattedSiCutOff = newRow.siCutOff
        ? formatCutOffInput(newRow.siCutOff)
        : newRow.siCutOff;

      const cutOffRegex = /^\d{2}\/\d{2}-\d{4} HRS$/;
      if (formattedPortCutOff && !cutOffRegex.test(formattedPortCutOff)) {
        toast.error(
          "Port CutOff must be in the format DD/MM-HHMM HRS (e.g., 06/06-1800 HRS)"
        );
        throw new Error("Invalid Port CutOff format");
      }
      if (formattedSiCutOff && !cutOffRegex.test(formattedSiCutOff)) {
        toast.error(
          "SI CutOff must be in the format DD/MM-HHMM HRS (e.g., 06/06-1800 HRS)"
        );
        throw new Error("Invalid SI CutOff format");
      }

      // unify customer object
      let customerData = newRow.customer;
      if (typeof newRow.customer === "string") {
        const customerDoc = await getDoc(doc(db, "newMaster", "customer"));
        const list = customerDoc.data()?.list || [];
        const target = norm(newRow.customer);
        customerData =
          list.find((item) => norm(item.name) === target) || {
            name: newRow.customer,
            customerEmail: "",
            salesPersonEmail: ""
          };
      }

      // Map containerNo string → equipmentDetails[].containerNo
      let updatedEquipmentDetails = Array.isArray(newRow.equipmentDetails)
        ? [...newRow.equipmentDetails]
        : [];
      let containerNumbers = [];
      if (typeof newRow.containerNo === "string") {
        containerNumbers = newRow.containerNo
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
      } else if (Array.isArray(newRow.containerNo)) {
        containerNumbers = newRow.containerNo
          .map((c) => (typeof c === "string" ? c.trim() : c))
          .filter(Boolean);
      }
      if (containerNumbers.length > 0) {
        if (updatedEquipmentDetails.length < containerNumbers.length) {
          for (let i = updatedEquipmentDetails.length; i < containerNumbers.length; i++) {
            updatedEquipmentDetails.push({});
          }
        }
        updatedEquipmentDetails = updatedEquipmentDetails.map((eq, idx) => ({
          ...eq,
          containerNo: containerNumbers[idx] || eq.containerNo || ""
        }));
      } else {
        updatedEquipmentDetails = [];
      }

      // audit
      let allActions = [...(oldRow.actions || [])];
      const trackedFields = [
        { key: "blNo", label: "BL No" },
        { key: "containerNo", label: "Container No" },
        { key: "bookingNo", label: "Booking No" },
        { key: "volume", label: "Volume" },
        { key: "referenceNo", label: "Reference NO" },
        { key: "portCutOff", label: "Port CutOff" },
        { key: "siCutOff", label: "SI CutOff" },
        { key: "bookingDate", label: "Booking Date" },
        { key: "bookingValidity", label: "BKG Validity" },
        { key: "etd", label: "ETD" },
        { key: "customer", label: "Customer" },
        { key: "line", label: "Line" },
        { key: "pol", label: "POL" },
        { key: "pod", label: "POD" },
        { key: "fpod", label: "FPOD" },
        { key: "vessel", label: "Vessel" },
        { key: "voyage", label: "Voyage" },
        { key: "remarks", label: "Remarks" }
      ];
      for (const field of trackedFields) {
        let oldValue = oldRow[field.key];
        let newValue = newRow[field.key];
        if (typeof oldValue === "object" && oldValue !== null)
          oldValue = oldValue.name || oldValue;
        if (typeof newValue === "object" && newValue !== null)
          newValue = newValue.name || newValue;
        if (
          oldValue !== newValue &&
          newValue !== undefined &&
          newValue !== ""
        ) {
          allActions.push(
            getAuditAction(
              field.label,
              props.auth?.username || "Unknown",
              newValue?.toString() || ""
            )
          );
        }
      }
      // track everything else too
      const changedFields = Object.keys(newRow);
      for (const key of changedFields) {
        if (key === "actions") continue;
        let oldValue = oldRow[key];
        let newValue = newRow[key];
        if (typeof oldValue === "object" && oldValue !== null)
          oldValue = oldValue.name || oldValue;
        if (typeof newValue === "object" && newValue !== null)
          newValue = newValue.name || newValue;
        if (
          oldValue !== newValue &&
          newValue !== undefined &&
          newValue !== ""
        ) {
          allActions.push(
            getAuditAction(
              key,
              props.auth?.username || "Unknown",
              newValue?.toString() || ""
            )
          );
        }
      }

      // ensure volume isn't 'undefined x undefined' - derive from equipmentDetails if needed
      let finalVolume = newRow.volume;
      if (typeof finalVolume !== "string" || finalVolume.trim() === "") {
        if (Array.isArray(newRow.equipmentDetails) && newRow.equipmentDetails.length > 0) {
          finalVolume = newRow.equipmentDetails
            .map((d) => {
              const q = d?.qty || "";
              const t = d?.equipmentType || "";
              if (!q && !t) return "";
              return `${q} x ${t}`.trim();
            })
            .filter(Boolean)
            .join(", ");
        } else {
          finalVolume = finalVolume || "";
        }
      } else {
        // if someone somehow entered the literal 'undefined x undefined' fix it
        if (finalVolume.toLowerCase().includes("undefined x undefined")) {
          if (Array.isArray(newRow.equipmentDetails) && newRow.equipmentDetails.length > 0) {
            finalVolume = newRow.equipmentDetails
              .map((d) => `${d?.qty || ""} x ${d?.equipmentType || ""}`.trim())
              .filter(Boolean)
              .join(", ");
          }
        }
      }

      const formattedRow = {
        ...newRow,
        actions: allActions,
        lastEditedAt: new Date(),
        lastEditedBy: props.auth?.username || "Unknown",
        portCutOff: formattedPortCutOff,
        siCutOff: formattedSiCutOff,
        customer: customerData,
        salesPersonName: customerData.salesPerson || "",
        customerEmail: customerData.customerEmail || "",
        salesPersonEmail: customerData.salesPersonEmail || "",
        volume:
          typeof finalVolume === "string" && finalVolume.includes(",")
            ? fixConcatenatedData(
                finalVolume
                  .split(",")
                  .map((v) => v.trim())
                  .join(", ")
              )
            : finalVolume,
        equipmentDetails: updatedEquipmentDetails
      };

      // save w/out containerNo (derived)
      const { containerNo, ...rowToSave } = formattedRow;

      const portCutOffChanged = oldRow.portCutOff !== formattedPortCutOff;
      const siCutOffChanged = oldRow.siCutOff !== formattedSiCutOff;
      const etdChanged = oldRow.etd !== newRow.etd;

      const vesselTrimmed = (formattedRow.vessel || "").trim();
      const voyageTrimmed = (formattedRow.voyage || "").trim();
      const polTrimmed = (formattedRow.pol || "").trim();

      if (portCutOffChanged || siCutOffChanged || etdChanged) {
        const q = query(
          collection(db, "entries"),
          where("vessel", "==", vesselTrimmed),
          where("voyage", "==", voyageTrimmed),
          where("pol", "==", polTrimmed)
        );
        const querySnapshot = await getDocs(q);

        const updatedEntries = [...entries];
        const batchUpdates = [];

        querySnapshot.forEach((docSnap) => {
          const entryId = docSnap.id;
          const docData = docSnap.data();
          const docVessel = (docData.vessel || "").trim();
          const docVoyage = (docData.voyage || "").trim();
          const docPol = (docData.pol || "").trim();
          if (
            entryId !== formattedRow.id &&
            docVessel === vesselTrimmed &&
            docVoyage === voyageTrimmed &&
            docPol === polTrimmed
          ) {
            const updateData = {
              portCutOff: portCutOffChanged
                ? formattedPortCutOff
                : docData.portCutOff,
              siCutOff: siCutOffChanged ? formattedSiCutOff : docData.siCutOff,
              etd: etdChanged ? formattedRow.etd : docData.etd
            };
            const docRef = doc(db, "entries", entryId);
            batchUpdates.push(updateDoc(docRef, updateData));

            const idx = updatedEntries.findIndex((e) => e.id === entryId);
            if (idx !== -1) {
              updatedEntries[idx] = {
                ...updatedEntries[idx],
                ...updateData
              };
            }
          }
        });

        const currentIdx = updatedEntries.findIndex(
          (e) => e.id === formattedRow.id
        );
        if (currentIdx !== -1) {
          updatedEntries[currentIdx] = formattedRow;
        }

        const docRef = doc(db, "entries", formattedRow.id);
        const updateData = { ...rowToSave };
        delete updateData.id;
        delete updateData.salesPersonName;
        delete updateData.customerEmail;
        delete updateData.salesPersonEmail;
        batchUpdates.push(updateDoc(docRef, updateData));

        await Promise.all(batchUpdates);
        setEntries(updatedEntries);
        toast.success("Row(s) updated successfully!");
      } else {
        const updatedEntries = entries.map((e) =>
          e.id === formattedRow.id ? formattedRow : e
        );
        setEntries(updatedEntries);

        const docRef = doc(db, "entries", formattedRow.id);
        const updateData = { ...rowToSave };
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

  /* ------------------------------- export excel ------------------------------ */
  const exportToExcel = () => {
    const rowsToExport =
      selectedRows.length > 0
        ? filteredEntries.filter((entry) => selectedRows.includes(entry.id))
        : filteredEntries;

    const exportData = rowsToExport.map((entry) => {
      const row = {};
      allColumns.forEach((column) => {
        if (column.field !== "actions" && column.field !== "seeAudit") {
          let value = entry[column.field];
          if (column.field === "customer") {
            value = entry.customer?.name || entry.customer;
          } else if (column.field === "salesPersonName") {
            value = entry.customer?.salesPerson || "";
          } else if (
            ["bookingDate", "bookingValidity", "etd", "sobDate"].includes(
              column.field
            )
          ) {
            value = formatDate(value);
          } else if (
            [
              "vgmFiled",
              "siFiled",
              "finalDG",
              "firstPrinted",
              "correctionsFinalised",
              "linerInvoice",
              "blReleased",
              "isfSent",
              "sob"
            ].includes(column.field)
          ) {
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

  /* -------------------------- fields / column models ------------------------- */
  const booleanFields = [
    "vgmFiled",
    "siFiled",
    "finalDG",
    "firstPrinted",
    "correctionsFinalised",
    "linerInvoice",
    "blReleased",
    "isfSent",
    "sob"
  ];

  const prerequisiteFields = [
    "vgmFiled",
    "siFiled",
    "firstPrinted",
    "correctionsFinalised",
    "linerInvoice"
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

  let allColumns = [
    ...(activeLocationFilter === "SEE ALL" ||
    activeLocationFilter === "NOMINATION"
      ? [
          {
            field: "location",
            headerName: "Location",
            editable: true,
            type: "singleSelect",
            valueOptions: masterData.location,
            renderCell: (params) => params.value || ""
          }
        ]
      : []),
    {
      field: "customer",
      headerName: "Customer",
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.customer,
      valueParser: (value) => value,
      renderCell: (params) => params.value?.name || params.value || ""
    },
    {
      field: "salesPersonName",
      headerName: "Sales",
      editable: false,
      renderCell: (params) => params.value || ""
    },
    {
      field: "line",
      headerName: "Line",
      editable: true,
      type: "singleSelect",
      valueOptions: masterData.line,
      renderCell: (params) => params.value || ""
    },
    {
      field: "referenceNo",
      headerName: "Reference",
      editable: true,
      renderCell: (params) => params.value || ""
    },
    {
      field: "bookingNo",
      headerName: "Booking No",
      editable: true,
      renderCell: (params) => params.value || ""
    },
    ...Object.keys(entryFields)
      .filter(
        (key) =>
          ![
            "customer",
            "salesPersonName",
            "line",
            "referenceNo",
            "bookingNo",
            "location"
          ].includes(key)
      )
      .map((key) => {
        const isMasterField = masterFields.includes(key);
        const isBooleanField = booleanFields.includes(key);
        const isDateField = ["bookingDate", "bookingValidity", "etd"].includes(
          key
        );

        let flex;
        if (key === "salesPersonName") flex = 1;
        else if (isDateField) flex = 0.8;
        else if (isBooleanField) flex = 0.5;
        else if (key === "containerNo") flex = 1.5;
        else if (key === "volume") flex = 1.2;
        else if (key === "vessel") flex = 1;
        else if (key === "voyage") flex = 0.6;
        else if (key === "portCutOff" || key === "siCutOff") flex = 1;
        else if (key === "pol" || key === "pod") flex = 0.8;
        else if (key === "fpod") flex = 1;
        else flex = 0.8;

        return {
          field: key,
          headerName: entryFields[key],
          editable: key !== "salesPersonName",
          ...(isMasterField && {
            type: "singleSelect",
            valueOptions: masterData[key],
            valueParser: (value) => value,
            renderCell: (params) => params.value?.name || params.value || ""
          }),
          ...(isDateField && {
            type: "date",
            valueGetter: (value, row) => {
              const dateValue = value || row[key];
              if (!dateValue) return null;
              if (dateValue instanceof Date) return dateValue;
              if (typeof dateValue === "string") {
                if (/^\d{2}-\d{2}-\d{4}$/.test(dateValue)) {
                  const [day, month, year] = dateValue.split("-");
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
              if (!value) return { ...row, [key]: "" };
              const date = value instanceof Date ? value : new Date(value);
              if (isNaN(date)) return { ...row, [key]: "" };
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const day = String(date.getDate()).padStart(2, "0");
              return { ...row, [key]: `${year}-${month}-${day}` };
            }
          }),
          renderCell: (params) => {
            if (key === "firstPrinted") {
              return (
                <Checkbox
                  checked={!!params.row[key]}
                  disabled={params.row[key]}
                  onChange={(e) =>
                    handleCheckboxEdit(params.row, key, e.target.checked)
                  }
                  color="primary"
                />
              );
            }
            if (isBooleanField) {
              return (
                <Checkbox
                  checked={!!params.row[key]}
                  onChange={(e) =>
                    handleCheckboxEdit(params.row, key, e.target.checked)
                  }
                  color="primary"
                />
              );
            }
            if (isDateField) {
              const value = params.value;
              if (!value) return "";
              try {
                let dateToFormat;
                if (value instanceof Date) dateToFormat = value;
                else if (typeof value === "string") {
                  if (value.includes("-")) {
                    const parts = value.split("-");
                    if (parts.length === 3) {
                      if (parts[0].length === 4) dateToFormat = new Date(value);
                      else {
                        const [day, month, year] = parts;
                        dateToFormat = new Date(`${year}-${month}-${day}`);
                      }
                    }
                  } else dateToFormat = new Date(value);
                }
                if (dateToFormat && !isNaN(dateToFormat)) {
                  const y = dateToFormat.getFullYear();
                  const m = String(dateToFormat.getMonth() + 1).padStart(
                    2,
                    "0"
                  );
                  const d = String(dateToFormat.getDate()).padStart(2, "0");
                  return formatDate(`${y}-${m}-${d}`);
                }
                return "";
              } catch {
                return "";
              }
            }
            if (key === "salesPersonName")
              return params.row.customer?.salesPerson || "";
            if (key === "volume" || key === "containerNo") {
              const value = params.value || "";
              if (typeof value === "string" && value.includes(","))
                return value
                  .split(",")
                  .map((v) => v.trim())
                  .join(", ");
              return value;
            }
            return params.value || "";
          }
        };
      })
  ];

  // FINAL DG (after SI)
  if (!allColumns.some((c) => c.field === "finalDG")) {
    const siFiledIndex = allColumns.findIndex((c) => c.field === "siFiled");
    if (siFiledIndex !== -1) {
      allColumns.splice(siFiledIndex + 1, 0, {
        field: "finalDG",
        headerName: "FINAL DG",
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
                size="small"
              />
            );
          }
          return null;
        }
      });
    }
  }

  // Liner Invoice + ISF + SOB (if FPOD master present)
  if (fpodMaster.length > 0) {
    const corrIdx = allColumns.findIndex(
      (col) => col.field === "correctionsFinalised"
    );
    if (!allColumns.some((c) => c.field === "linerInvoice")) {
      allColumns.splice(corrIdx + 1, 0, {
        field: "linerInvoice",
        headerName: "LINER INVOICE",
        editable: true,
        renderCell: (params) => (
          <Checkbox
            checked={!!params.row.linerInvoice}
            onChange={(e) =>
              handleCheckboxEdit(params.row, "linerInvoice", e.target.checked)
            }
            color="primary"
            size="small"
          />
        )
      });
    }
    const firstPrintedIndex = allColumns.findIndex(
      (col) => col.field === "firstPrinted"
    );
    if (!allColumns.some((c) => c.field === "isfSent")) {
      allColumns.splice(firstPrintedIndex + 1, 0, {
        field: "isfSent",
        headerName: "ISF SENT",
        editable: true,
        renderCell: (params) => {
          const isUS = isUSFpod(params.row.fpod, fpodMaster);
          if (isUS) {
            return (
              <Checkbox
                checked={!!params.row.isfSent}
                onChange={(e) =>
                  handleCheckboxEdit(params.row, "isfSent", e.target.checked)
                }
                color="primary"
                size="small"
              />
            );
          }
          return null;
        }
      });
      allColumns.splice(firstPrintedIndex + 2, 0, {
        field: "sob",
        headerName: "SOB",
        editable: true,
        renderCell: (params) => (
          <Checkbox
            checked={!!params.row.sob}
            onChange={(e) => handleSobCheckbox(params.row, e.target.checked)}
            color="primary"
            size="small"
          />
        )
      });
    }
  }

  // BL Type column after BL Released
  if (!allColumns.some((c) => c.field === "blType")) {
    const blReleasedIndex = allColumns.findIndex(
      (col) => col.field === "blReleased"
    );
    if (blReleasedIndex !== -1) {
      allColumns.splice(blReleasedIndex + 1, 0, {
        field: "blType",
        headerName: "BL Type",
        editable: false,
        renderCell: (params) => params.value || ""
      });
    }
  }

  // BL No column
  if (!allColumns.some((c) => c.field === "blNo")) {
    allColumns.push({
      field: "blNo",
      headerName: "BL No",
      editable: true
    });
  }

  // Actions (Duplicate + Delete)
  allColumns.push({
    field: "actions",
    headerName: "Actions",
    sortable: false,
    filterable: false,
    renderCell: (params) => (
      <>
        <IconButton
          color="primary"
          onClick={() => handleDuplicateClick(params.row)}
          size="small"
          title="Duplicate"
          style={{ marginRight: 4 }}
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
        <IconButton
          color="error"
          onClick={() => handleDeleteClick(params.row)}
          size="small"
          title="Delete"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </>
    )
  });

  // Admin: See Audit as second column (after checkbox)
  if (props.auth?.isAdmin || props.auth?.role === "admin") {
    // Remove existing seeAudit if present
    allColumns = allColumns.filter(col => col.field !== "seeAudit");
    // Insert seeAudit as the first column (after checkbox, which is not in allColumns)
    allColumns = [
      {
        field: "seeAudit",
        headerName: "See Audit",
        sortable: false,
        filterable: false,
        width: 110,
        renderCell: (params) => (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setSelectedEntry(params.row);
              setAuditDialogOpen(true);
            }}
          >
            See Audit
          </Button>
        )
      },
      ...allColumns
    ];
  }

  /* ------------------------------ delete row ------------------------------ */
  const handleDeleteClick = (row) => {
    setRowToDelete(row);
    setDeleteDialogOpen(true);
  };
  const handleDeleteConfirm = async () => {
    if (!rowToDelete) return;
    try {
      await deleteDoc(doc(db, "entries", rowToDelete.id));
      setEntries((prev) => prev.filter((e) => e.id !== rowToDelete.id));
      toast.success("Entry deleted successfully!");
    } catch (err) {
      console.error("Delete error:", err);
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

  /* ---------------------------------- SOB ---------------------------------- */
  const handleSobCheckbox = (row, checked) => {
    if (checked) {
      const containerNo = Array.isArray(row.containerNo)
        ? row.containerNo.join(",").trim()
        : (row.containerNo || "").trim();
      const voyage = (row.voyage || "").trim();
      if (!containerNo) {
        toast.error("Please fill the Container No before checking SOB.");
        return;
      }
      if (!voyage) {
        toast.error("Please fill the Voyage before checking SOB.");
        return;
      }
      if (!row.vgmFiled) {
        toast.error("Please mark VGM Filed before checking SOB.");
        return;
      }
      if (!row.siFiled) {
        toast.error("Please mark SI Filed before checking SOB.");
        return;
      }
      setRowForSob(row);
      setSobDateInput("");
      setSobDialogOpen(true);
    } else {
      const newRow = { ...row, sob: false, sobDate: "" };
      handleProcessRowUpdate(newRow, row).then(() => {
        toast.info("SOB unchecked");
      });
    }
  };

  const handleSobSubmit = async () => {
    if (!sobDateInput) {
      toast.error("Please select a date for SOB.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sobDateInput)) {
      toast.error("Invalid date format. Please use YYYY-MM-DD format.");
      return;
    }
    setSobDialogOpen(false);

    const formattedSobDate = formatDate(sobDateInput); // DD-MM-YYYY for display
    const etdDate = sobDateInput; // keep as YYYY-MM-DD for storage

    const newRow = {
      ...rowForSob,
      sob: true,
      sobDate: formattedSobDate,
      etd: etdDate
    };

    try {
      await handleProcessRowUpdate(newRow, rowForSob);
      toast.success("SOB checked, date added and ETD synced");

      // emails present?
      const customerEmails = coerceEmails(newRow.customerEmail);
      const salesPersonEmails = coerceEmails(newRow.salesPersonEmail);

      const missing = [];
      if (customerEmails.length === 0) missing.push("Customer Email");
      if (salesPersonEmails.length === 0) missing.push("Sales Person Email");
      if (!newRow.customer?.name && typeof newRow.customer !== "string")
        missing.push("Customer Name");
      if (!newRow.bookingNo) missing.push("Booking No");

      if (missing.length > 0) {
        setMissingEmailFields(missing);
        setMissingEmailDialogOpen(true);
      } else {
        try {
          const containerNo = Array.isArray(newRow.containerNo)
            ? newRow.containerNo.join(", ")
            : newRow.containerNo || "";

          const emailData = {
            customer_email: customerEmails,
            sales_person_email: salesPersonEmails,
            customer_name: newRow.customer?.name || newRow.customer,
            booking_no: newRow.bookingNo,
            sob_date: formattedSobDate,
            vessel: newRow.vessel,
            voyage: newRow.voyage,
            pol: newRow.pol,
            pod: newRow.pod,
            fpod: newRow.fpod || "",
            container_no: containerNo,
            volume: newRow.volume,
            bl_no: newRow.blNo || ""
          };

          await axios.post(
            "https://booking-email-backend.onrender.com/api/send-sob-email",
            emailData,
            { timeout: 10000 }
          );

          setMailStatus({ success: true, message: "Mail sent successfully." });
        } catch (emailError) {
          let errorMessage = "Unknown error occurred";
          if (emailError.code === "ECONNREFUSED")
            errorMessage = "Email service not available (connection refused)";
          else if (emailError.code === "ETIMEDOUT")
            errorMessage = "Email service timeout";
          else if (emailError.response)
            errorMessage = `Email API error: ${emailError.response.status} - ${
              emailError.response.data?.message ||
              emailError.response.statusText
            }`;
          else if (emailError.request) errorMessage = "No response from email service";
          else errorMessage = emailError.message;

          setMailStatus({ success: false, message: "Mail not sent: " + errorMessage });
        }
        setMailStatusDialogOpen(true);
      }
    } catch {
      toast.error("Failed to update SOB date");
    }

    setRowForSob(null);
    setSobDateInput("");
  };

  const handleSobCancel = () => {
    setSobDialogOpen(false);
    setRowForSob(null);
    setSobDateInput("");
  };

  const handleSobConfirmClose = () => {
    setSobConfirmDialogOpen(false);
    setSobResult(null);
  };

  /* --------------------------- checkbox gating logic -------------------------- */
  const handleCheckboxEdit = async (row, field, value) => {
    // 1) SI Filed → needs container no + choose BL type
    if (field === "siFiled" && value) {
      const containerNo = Array.isArray(row.containerNo)
        ? row.containerNo.join(",").trim()
        : (row.containerNo || "").trim();
      if (!containerNo) {
        toast.error("Please fill the Container No before marking SI Filed.");
        return;
      }
      setRowForBlType(row);
      setBlTypeDialogOpen(true);
      return;
    }

    // 2) First Print → open BL No dialog
    if (field === "firstPrinted" && value) {
      setCurrentRow(row);
      setOpenDialog(true);
      return;
    }

    // prerequisites (add ISF if US FPOD)
    const fieldsToCheck = [...prerequisiteFields];
    const isUS = isUSFpod(row.fpod, fpodMaster);
    if (isUS && !fieldsToCheck.includes("isfSent")) fieldsToCheck.push("isfSent");

    // 3) B/L Released gating
    if (field === "blReleased" && value) {
      const required = fieldsToCheck.filter(
        (f) => f !== "blReleased" && f !== "linerInvoice"
      );
      const missingPrereqs = required.filter((f) => row[f] !== true);

      if (missingPrereqs.length === 0) {
        if (row.linerInvoice) {
          setRowToComplete({ ...row, blReleased: true });
          setConfirmDialogOpen(true);
          return;
        } else {
          const currentActions = row.actions || [];
          const newAction = getAuditAction(
            "B/L Released",
            props.auth?.username || "Unknown",
            "Yes"
          );
          const newRowAfterBL = {
            ...row,
            blReleased: true,
            actions: [...currentActions, newAction]
          };
          await handleProcessRowUpdate(newRowAfterBL, row);
          toast.info("Please tick Liner Invoice to complete the process.");
          setTimeout(
            () => toast.info("Liner Invoice must be ticked to move to Completed Files."),
            500
          );
          return;
        }
      }
      const nice = {
        vgmFiled: "VGM Filed",
        siFiled: "SI Filed",
        firstPrinted: "First Print",
        correctionsFinalised: "Corrections Finalised",
        isfSent: "ISF Sent"
      };
      toast.error(
        `Complete before B/L Release: ${missingPrereqs
          .map((m) => nice[m] || m)
          .join(", ")}`
      );
      return;
    }

    // 4) Liner Invoice gating
    if (field === "linerInvoice" && value) {
      const requiredBeforeInvoice = fieldsToCheck.filter(
        (f) => f !== "linerInvoice" && f !== "blReleased"
      );
      const missingBeforeInvoice = requiredBeforeInvoice.filter(
        (f) => row[f] !== true
      );

      if (missingBeforeInvoice.length > 0) {
        const nice = {
          vgmFiled: "VGM Filed",
          siFiled: "SI Filed",
          firstPrinted: "First Print",
          correctionsFinalised: "Corrections Finalised",
          isfSent: "ISF Sent"
        };
        toast.error(
          `Complete before Liner Invoice: ${missingBeforeInvoice
            .map((m) => nice[m] || m)
            .join(", ")}`
        );
        return;
      }

      if (row.blReleased) {
        setRowToComplete({ ...row, linerInvoice: true });
        setConfirmDialogOpen(true);
        return;
      }

      const newRow = { ...row, linerInvoice: true };
      await handleProcessRowUpdate(newRow, row);
      return;
    }

    // 5) Corrections Finalised → needs First Print first
    if (field === "correctionsFinalised" && value) {
      if (!row.firstPrinted) {
        toast.error("Please tick First Print before Corrections Finalised.");
        return;
      }
      const newRow = { ...row, correctionsFinalised: true };
      await handleProcessRowUpdate(newRow, row);
      return;
    }

    // 6) default: update boolean + audit
    const currentActions = row.actions || [];
    const newAction = getAuditAction(
      entryFields[field] || field,
      props.auth?.username || "Unknown",
      value ? "Yes" : "No"
    );
    const newRow = {
      ...row,
      [field]: value,
      actions: [...currentActions, newAction]
    };
    await handleProcessRowUpdate(newRow, row);
  };

  /* ------------------------------- dialogs: FP ------------------------------- */
  const handleDialogSubmit = async () => {
    if (blNoInput.trim() === "") {
      toast.error("BL No cannot be empty!");
      return;
    }
    const currentActions = currentRow.actions || [];
    const newActions = [
      ...currentActions,
      getAuditAction("First Print", props.auth?.username || "Unknown", "Yes"),
      getAuditAction("BL No", props.auth?.username || "Unknown", blNoInput.trim())
    ];
    const newRow = {
      ...currentRow,
      firstPrinted: true,
      blNo: blNoInput.trim(),
      actions: newActions
    };
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

  /* ------------------------------ dialogs: BL type ----------------------------- */
  const handleBlTypeDialogSubmit = async () => {
    if (!selectedBlType) {
      toast.error("Please select BL Type");
      return;
    }
    const currentActions = rowForBlType.actions || [];
    const newActions = [
      ...currentActions,
      getAuditAction("SI Filed", props.auth?.username || "Unknown", "Yes"),
      getAuditAction("BL Type", props.auth?.username || "Unknown", selectedBlType)
    ];
    const newRow = {
      ...rowForBlType,
      siFiled: true,
      blType: selectedBlType,
      actions: newActions
    };
    await handleProcessRowUpdate(newRow, rowForBlType);
    setSelectedBlType("");
    setRowForBlType(null);
    setBlTypeDialogOpen(false);
  };
  const handleBlTypeDialogClose = () => {
    setSelectedBlType("");
    setRowForBlType(null);
    setBlTypeDialogOpen(false);
  };

  /* --------------------------- complete / move file --------------------------- */
  const handleConfirmComplete = async () => {
    if (!rowToComplete) return;
    try {
      const updatedRow = { ...rowToComplete, blReleased: true };
      setEntries((prev) =>
        prev.map((e) => (e.id === updatedRow.id ? updatedRow : e))
      );

      const entryData = { ...updatedRow };
      delete entryData.id;
      delete entryData.salesPersonName;
      delete entryData.customerEmail;
      delete entryData.salesPersonEmail;

      await addDoc(collection(db, "completedFiles"), entryData);
      await deleteDoc(doc(db, "entries", updatedRow.id));
      setEntries((prev) => prev.filter((e) => e.id !== updatedRow.id));

      toast.success("Entry marked as B/L Released and moved to Completed Files!");
    } catch (err) {
      console.error("Complete error:", err);
      toast.error("Failed to mark as B/L Released.");
      setEntries((prev) =>
        prev.map((e) =>
          e.id === rowToComplete.id ? { ...e, blReleased: false } : e
        )
      );
    } finally {
      setConfirmDialogOpen(false);
      setRowToComplete(null);
    }
  };
  const handleCancelComplete = () => {
    if (rowToComplete && rowToComplete.blReleased && !rowToComplete.linerInvoice) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === rowToComplete.id ? { ...e, blReleased: false } : e
        )
      );
    }
    setConfirmDialogOpen(false);
    setRowToComplete(null);
  };

  /* ------------------------------- row styling ------------------------------- */
  const getRowClassName = (params) => {
    const row = params.row;
    return !row.portCutOff || !row.siCutOff ? "highlight-row" : "";
  };

  /* ------------------------------- touch scroll ------------------------------ */
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  };
  const handleTouchMove = (e) => {
    if (touchStartX !== null && touchStartY !== null && e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        e.preventDefault();
      } else {
        e.currentTarget.scrollLeft += 0;
        e.currentTarget.scrollTop += e.deltaY;
        e.preventDefault();
      }
    }
  };

  /* --------------------------------- row click -------------------------------- */
  const handleRowClick = async (params) => {
    const entryId = params.row.id || params.id;
    const entryDoc = await getDoc(doc(db, "entries", entryId));
    if (entryDoc.exists()) {
      setSelectedEntry({ id: entryId, ...entryDoc.data() });
    } else {
      setSelectedEntry(null);
    }
  };

  /* ------------------------------- add vessel -------------------------------- */
  const handleAddVessel = async () => {
    const name = newVesselName.trim();
    if (!name) {
      toast.error("Vessel name cannot be empty.");
      return;
    }
    try {
      // keep master as list of objects { name }
      const docRef = doc(db, "newMaster", "vessel");
      const snap = await getDoc(docRef);
      let list = [];
      if (snap.exists()) {
        list = snap.data().list || [];
      }
      // avoid duplicates (case-insensitive)
      const exists = list.some(
        (v) => (v.name || v).toString().toUpperCase() === name.toUpperCase()
      );
      if (!exists) {
        await updateDoc(docRef, { list: arrayUnion({ name }) }).catch(async () => {
          // if doc didn't exist
          await setDoc(docRef, { list: [{ name }] });
        });
      }
      setMasterData((prev) => ({
        ...prev,
        vessel: [...prev.vessel, name].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        )
      }));
      toast.success("Vessel added successfully.");
      setAddVesselDialogOpen(false);
      setNewVesselName("");
    } catch (error) {
      console.error("Error adding vessel:", error);
      toast.error("Failed to add vessel.");
    }
  };

  /* ------------------------------- duplicate flow ------------------------------ */
  const parseContainerInput = (s) =>
    (s || "")
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);

  const handleDuplicateClick = (row) => {
    setRowToDuplicate(row);
    setNewBookingNo(row.bookingNo ? `${row.bookingNo}-COPY` : "");
    setNewContainerNo(row.containerNo || "");
    setKeepStatuses(false);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setRowToDuplicate(null);
    setNewBookingNo("");
    setNewContainerNo("");
    setKeepStatuses(false);
  };

  const handleDuplicateSubmit = async () => {
    try {
      if (!rowToDuplicate) return;
      const booking = newBookingNo.trim();
      if (!booking) {
        toast.error("New Booking No is required.");
        return;
      }
      if (await bookingNoExists(booking)) {
        toast.error("Booking No already exists. Please use a different number.");
        return;
      }
      const containers = parseContainerInput(newContainerNo);
      if (containers.length === 0) {
        toast.error("Please enter at least one Container No.");
        return;
      }

      const src = rowToDuplicate;
      const statusFields = {
        vgmFiled: keepStatuses ? !!src.vgmFiled : false,
        siFiled: keepStatuses ? !!src.siFiled : false,
        finalDG: keepStatuses ? !!src.finalDG : false,
        firstPrinted: keepStatuses ? !!src.firstPrinted : false,
        correctionsFinalised: keepStatuses ? !!src.correctionsFinalised : false,
        linerInvoice: keepStatuses ? !!src.linerInvoice : false,
        blReleased: keepStatuses ? !!src.blReleased : false,
        isfSent: keepStatuses ? !!src.isfSent : false,
        sob: keepStatuses ? !!src.sob : false,
        sobDate: keepStatuses ? src.sobDate || "" : "",
        blNo: keepStatuses ? src.blNo || "" : ""
      };

      const newActions = [
        ...(src.actions || []),
        getAuditAction(
          "Duplicated From",
          props.auth?.username || "Unknown",
          src.bookingNo || src.id || ""
        )
      ];

      const equipmentDetails = containers.map((c) => ({ containerNo: c }));

      // doc for Firestore
      const newDocDb = {
        ...src,
        bookingNo: booking,
        actions: newActions,
        lastEditedAt: new Date(),
        lastEditedBy: props.auth?.username || "Unknown",
        ...statusFields,
        equipmentDetails
      };

      delete newDocDb.id;
      delete newDocDb.invoiceNo;
      delete newDocDb.salesPersonName;
      delete newDocDb.customerEmail;
      delete newDocDb.salesPersonEmail;
      delete newDocDb.containerNo;

      const docRef = await addDoc(collection(db, "entries"), newDocDb);

      // UI row
      const uiRow = {
        id: docRef.id,
        ...newDocDb,
        location: src.location,
        line: src.line,
        pol: src.pol,
        pod: src.pod,
        fpod: src.fpod,
        vessel: src.vessel,
        equipmentType: src.equipmentType,
        customer: src.customer,
        salesPersonName: src.customer?.salesPerson || "",
        customerEmail: src.customer?.customerEmail || "",
        salesPersonEmail: src.customer?.salesPersonEmail || "",
        volume: Array.isArray(src.volume)
          ? src.volume.join(", ")
          : src.volume || "",
        containerNo: containers.join(", "),
        isfSent: newDocDb.isfSent || false,
        sob: newDocDb.sob || false,
        sobDate: newDocDb.sobDate || "",
        finalDG: newDocDb.finalDG || false,
        blNo: newDocDb.blNo || "",
        linerInvoice: newDocDb.linerInvoice || false,
        isNominated: src.isNominated || false
      };

      setEntries((prev) => [...prev, uiRow]);
      toast.success("Entry duplicated.");
      handleDuplicateCancel();
    } catch (err) {
      console.error("Duplicate failed:", err);
      toast.error("Failed to duplicate entry.");
    }
  };

  /* ---------------------------------- UI ---------------------------------- */
  return (
    <div className="container mt-4">
      <style>{styles}</style>
      <h2 className="mb-4 text-center">Booking Entries</h2>

      <Box sx={{ mb: 3, display: "flex", justifyContent: "center", gap: 1 }}>
        {["MUMBAI", "GUJARAT", "SEE ALL", "NOMINATION"].map((location) => (
          <button
            key={location}
            className={`location-button ${
              activeLocationFilter === location ? "active" : ""
            }`}
            onClick={() => handleLocationButtonFilter(location)}
          >
            {location}
          </button>
        ))}
      </Box>

      <Box sx={{ mb: 1, display: "flex", justifyContent: "center" }}>
        <span
          style={{
            fontWeight: 500,
            fontSize: 16,
            color: "#1976d2",
            textAlign: "center"
          }}
        >
          Add vessel from here if not present in vessel drop down list
        </span>
      </Box>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "center" }}>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => setAddVesselDialogOpen(true)}
        >
          Add Vessel
        </Button>
      </Box>

      <Dialog
        open={addVesselDialogOpen}
        onClose={() => setAddVesselDialogOpen(false)}
      >
        <DialogTitle>Add Vessel</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Vessel Name"
            type="text"
            fullWidth
            value={newVesselName}
            onChange={(e) => setNewVesselName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddVesselDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddVessel} color="primary">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          mb: 3,
          display: "flex",
          justifyContent: "center",
          gap: 2,
          flexWrap: "wrap"
        }}
      >
        <button
          className="sort-button"
          onClick={() => handleQuickSort("etd", "asc")}
          title="Sort by ETD (Earliest First)"
        >
          📅 ETD ↑ (Earliest)
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort("etd", "desc")}
          title="Sort by ETD (Latest First)"
        >
          📅 ETD ↓ (Latest)
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort("line", "asc")}
          title="Sort by Line (A-Z)"
        >
          🚢 Line A-Z
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort("line", "desc")}
          title="Sort by Line (Z-A)"
        >
          🚢 Line Z-A
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort("customer", "asc")}
          title="Sort by Customer (A-Z)"
        >
          👤 Customer A-Z
        </button>
        <button
          className="sort-button"
          onClick={() => handleQuickSort("customer", "desc")}
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
          style={{ marginLeft: "10px" }}
        >
          Export to Excel
        </Button>
      </div>

      {(activeLocationFilter === "SEE ALL" ||
        activeLocationFilter === "NOMINATION") && (
        <div className="mb-3">
          <label className="form-label">Filter by Location:</label>
          <div>
            {locations.map((location) => (
              <FormControlLabel
                key={location}
                control={
                  <Checkbox
                    checked={selectedLocations.includes(location)}
                    onChange={(e) =>
                      handleLocationFilter(location, e.target.checked)
                    }
                    color="primary"
                  />
                }
                label={location}
              />
            ))}
          </div>
        </div>
      )}

      <div
        className="single-grid-container"
        ref={gridContainerRef}
        onWheel={(e) => {
          if (Math.abs(e.deltaX) > 0 && Math.abs(e.deltaY) > 0) {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
              e.currentTarget.scrollTop += 0;
              e.currentTarget.scrollLeft += e.deltaX;
              e.preventDefault();
            } else {
              e.currentTarget.scrollLeft += 0;
              e.currentTarget.scrollTop += e.deltaY;
              e.preventDefault();
            }
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <DataGridPro
          rows={filteredEntries}
          columns={allColumns}
          // pin selection checkbox column first, then seeAudit, then bookingNo, customer, line
          pinnedColumns={{ left: ["__check__", "seeAudit", "bookingNo", "customer", "line"] }}
          checkboxSelection
          disableSelectionOnClick
          getRowClassName={getRowClassName}
          selectionModel={selectedRows}
          onSelectionModelChange={setSelectedRows}
          processRowUpdate={handleProcessRowUpdate}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          disableColumnMenu={false}
          rowHeight={52}
          autoHeight={false}
          disableColumnResize={false}
          onProcessRowUpdateError={(err) =>
            toast.error(err?.message || "Row update failed")
          }
          pagination={false}
          onRowClick={handleRowClick}
          sx={{
            height: "100%",
            width: "100%",
            border: "none",
            "& .MuiDataGrid-virtualScroller": {
              "&::-webkit-scrollbar": { height: "12px", width: "12px" },
              "&::-webkit-scrollbar-track": { backgroundColor: "#f1f1f1" },
              "& ::-webkit-scrollbar-thumb": {
                backgroundColor: "#888",
                borderRadius: "6px"
              },
              "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "#555" }
            },
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f8f9fa",
              fontWeight: "bold",
              fontSize: "14px",
              borderBottom: "2px solid #e0e0e0"
            },
            "& .MuiDataGrid-columnHeader": {
              padding: "8px 4px",
              "&:focus": { outline: "none" },
              "&:hover": { backgroundColor: "#e3f2fd" }
            },
            "& .MuiDataGrid-columnSeparator": {
              display: "block",
              color: "#ddd",
              "&:hover": { color: "#1976d2" }
            },
            "& .MuiDataGrid-cell": {
              borderRight: "1px solid #f0f0f0",
              fontSize: "13px",
              padding: "8px",
              "&:focus": { outline: "none" }
            },
            "& .MuiDataGrid-row:nth-of-type(even)": { backgroundColor: "#fafafa" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "#f0f8ff !important" },
            "& .MuiDataGrid-row.Mui-selected": {
              backgroundColor: "#e3f2fd !important"
            },
            "& .MuiDataGrid-row.Mui-selected:hover": {
              backgroundColor: "#bbdefb !important"
            }
          }}
        />
      </div>

      {/* First Print dialog */}
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

      {/* SOB date dialog */}
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

      {/* Duplicate dialog */}
      <Dialog
        open={duplicateDialogOpen}
        onClose={handleDuplicateCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Duplicate Entry</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              label="New Booking No"
              value={newBookingNo}
              onChange={(e) => setNewBookingNo(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Container No(s)"
              value={newContainerNo}
              onChange={(e) => setNewContainerNo(e.target.value)}
              placeholder="e.g. MSKU1234567, TCLU7654321"
              helperText="Use commas or new lines for multiple containers."
              fullWidth
              multiline
              minRows={2}
              required
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={keepStatuses}
                  onChange={(e) => setKeepStatuses(e.target.checked)}
                />
              }
              label="Keep current statuses (VGM, SI Filed, First Print, etc.)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDuplicateCancel}>Cancel</Button>
          <Button onClick={handleDuplicateSubmit} variant="contained">
            Create Copy
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mail status */}
      <Dialog
        open={mailStatusDialogOpen}
        onClose={() => setMailStatusDialogOpen(false)}
      >
        <DialogTitle>Mail Status</DialogTitle>
        <DialogContent>
          <div
            style={{
              color: mailStatus.success ? "#388e3c" : "#d32f2f",
              fontWeight: 500,
              fontSize: 16
            }}
          >
            {mailStatus.message}
          </div>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setMailStatusDialogOpen(false)}
            color="primary"
            autoFocus
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Missing email dialog */}
      <Dialog
        open={missingEmailDialogOpen}
        onClose={() => setMissingEmailDialogOpen(false)}
      >
        <DialogTitle>Missing Email Details</DialogTitle>
        <DialogContent>
          <div style={{ marginBottom: 8 }}>
            We couldn’t send the SOB email because the following are missing:
          </div>
          <ul style={{ marginTop: 0 }}>
            {missingEmailFields.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <div style={{ marginTop: 8, fontSize: 13, color: "#555" }}>
            Please update the customer in master data (Sales person + emails /
            Customer email), then retry.
          </div>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setMissingEmailDialogOpen(false)}
            autoFocus
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* BL Type */}
      <Dialog open={blTypeDialogOpen} onClose={handleBlTypeDialogClose}>
        <DialogTitle>Select BL Type</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Button
              variant={selectedBlType === "OBL" ? "contained" : "outlined"}
              onClick={() => setSelectedBlType("OBL")}
            >
              OBL
            </Button>
            <Button
              variant={selectedBlType === "SEAWAY" ? "contained" : "outlined"}
              onClick={() => setSelectedBlType("SEAWAY")}
            >
              SEAWAY
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBlTypeDialogClose}>Cancel</Button>
          <Button onClick={handleBlTypeDialogSubmit} disabled={!selectedBlType}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm BL Release → Completed Files */}
      <Dialog open={confirmDialogOpen} onClose={handleCancelComplete}>
        <DialogTitle>Confirm B/L Release</DialogTitle>
        <DialogContent>
          <p>
            Are you sure you want to mark this as B/L Released? This will move
            the entry to Completed Files.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelComplete}>Cancel</Button>
          <Button onClick={handleConfirmComplete} color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <p>
            Are you sure you want to delete this entry? This action cannot be
            undone.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Helper popups */}
      <Dialog
        open={containerNoDialogOpen}
        onClose={() => setContainerNoDialogOpen(false)}
      >
        <DialogTitle>Container Number Required</DialogTitle>
        <DialogContent>
          Please enter the container number first before marking SOB.
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setContainerNoDialogOpen(false)}
            color="primary"
            autoFocus
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={sobMissingDialogOpen}
        onClose={() => setSobMissingDialogOpen(false)}
      >
        <DialogTitle>Fields Remaining</DialogTitle>
        <DialogContent>
          The following fields must be filled before marking SOB:
          <br />
          <ul>
            {sobMissingFields.map((field, idx) => (
              <li key={idx}>{field}</li>
            ))}
          </ul>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSobMissingDialogOpen(false)}
            color="primary"
            autoFocus
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Audit Trail */}
      <Dialog
        open={auditDialogOpen}
        onClose={() => setAuditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Audit Trail</DialogTitle>
        <DialogContent>
          {selectedEntry ? (
            <AuditTrail entry={selectedEntry} show={true} />
          ) : (
            <div style={{ padding: 24, color: "#d32f2f", fontWeight: 500 }}>
              No entry data found for this row.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Entries;
