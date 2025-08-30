import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-toastify";

export default function Locals({ auth }) {
  const [lines, setLines] = useState([]);
  const [pols, setPols] = useState([]);

  const [selectedLine, setSelectedLine] = useState("");
  const [selectedPol, setSelectedPol] = useState("");
  // Grid state: charges x equipment types
  const columns = ["20 DV", "40DV", "20HAZ", "40HAZ"];
  const chargeRows = [
    "THC",
    "DOC",
    "SEAL",
    "HAZDOC",
    "MUC",
    "TOLL",
    "SEAWAY BL FEE",
    "Surrender Charges",
    "Admin Fee",
    "Equipment Charges",
    "VTS"
  ];

  const [gridValues, setGridValues] = useState(() => {
    // initialize empty grid
    const obj = {};
    for (const r of chargeRows) {
      obj[r] = {};
      for (const c of columns) obj[r][c] = "";
    }
    return obj;
  });

  const [currencies, setCurrencies] = useState(() => {
    const obj = {};
    for (const r of chargeRows) {
      obj[r] = {};
      for (const c of columns) obj[r][c] = "";
    }
    return obj;
  });

  const handleGridChange = (charge, col, value) => {
    setGridValues((prev) => ({
      ...prev,
      [charge]: {
        ...prev[charge],
        [col]: value
      }
    }));
  };

  const formatNumber = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(/,/g, ""));
    if (Number.isNaN(n)) return null;
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const formatDisplay = (v) => {
    const f = formatNumber(v);
    return f === null ? "-" : f;
  };

  // totals removed — grid shows per-charge values only

  const [loadingSave, setLoadingSave] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lastSavedBy, setLastSavedBy] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savedGrid, setSavedGrid] = useState(null); // snapshot { grid, currencies } to revert on cancel
  const [focusedCell, setFocusedCell] = useState(null); // key `row||col`

  const createEmptyGrid = () => {
    const obj = {};
    for (const r of chargeRows) {
      obj[r] = {};
      for (const c of columns) obj[r][c] = "";
    }
    return obj;
  };

  const createEmptyCurrencies = () => {
    const obj = {};
    for (const r of chargeRows) {
      obj[r] = {};
      for (const c of columns) obj[r][c] = "";
    }
    return obj;
  };

  const makeDocId = (line, pol) => encodeURIComponent(`${line}||${pol}`);

  // load saved grid when line+pol selected
  useEffect(() => {
    const loadSaved = async () => {
  // immediately reset grid and currencies so previous values don't show while loading
  const empty = createEmptyGrid();
  const emptyCurrencies = createEmptyCurrencies();
  setGridValues(empty);
  setCurrencies(emptyCurrencies);
  setSavedGrid(null);
  setLastSavedAt(null);

      if (!selectedLine || !selectedPol) {
        return;
      }

      try {
        const id = makeDocId(selectedLine, selectedPol);
        const ref = doc(db, "localsCharges", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          // If data.grid exists, use it; otherwise ignore
          if (data.grid) {
            const loaded = {};
            for (const r of chargeRows) {
              loaded[r] = {};
              for (const c of columns) {
                loaded[r][c] = data.grid[r] && data.grid[r][c] != null ? String(data.grid[r][c]) : "";
              }
            }
            setGridValues(loaded);
            // load currencies if present (expected shape: { row: { col: currency } })
            if (data.currencies) {
              const loadedCurr = {};
              for (const r of chargeRows) {
                loadedCurr[r] = {};
                for (const c of columns) {
                  loadedCurr[r][c] = (data.currencies[r] && data.currencies[r][c]) || "";
                }
              }
              setCurrencies(loadedCurr);
              setSavedGrid({ grid: loaded, currencies: loadedCurr });
            } else {
              const emptyCurr = createEmptyCurrencies();
              setCurrencies(emptyCurr);
              setSavedGrid({ grid: loaded, currencies: emptyCurr });
            }
          }
          setLastSavedAt(data.updatedAt || data.createdAt || null);
          setLastSavedBy(data.updatedBy || data.lastEditedBy || data.createdBy || null);
        }
      } catch (err) {
        console.error("Error loading localsCharges", err);
        toast.error("Failed to load saved charges");
      }
    };

    loadSaved();
  }, [selectedLine, selectedPol]);

  const handleSave = async () => {
    if (!selectedLine || !selectedPol) {
      toast.warn("Please select Line and POL before saving.");
      return;
    }
    setLoadingSave(true);
    try {
      const id = makeDocId(selectedLine, selectedPol);
      const ref = doc(db, "localsCharges", id);
      const payload = {
        line: selectedLine,
        pol: selectedPol,
    grid: gridValues,
    currencies,
        updatedAt: new Date().toISOString(),
        updatedBy: auth?.username || auth?.email || "Unknown"
      };
      await setDoc(ref, payload, { merge: true });
      setLastSavedAt(payload.updatedAt);
      setLastSavedBy(payload.updatedBy);
  setSavedGrid({ grid: gridValues, currencies });
  setIsEditing(false);
  toast.success("Charges saved successfully.");
    } catch (err) {
      console.error("Error saving localsCharges", err);
      toast.error("Failed to save charges.");
    } finally {
      setLoadingSave(false);
    }
  };

  const handleClear = () => {
    if (!isEditing) {
      toast.info("Clear is only available while editing. Click Edit to modify values.");
      return;
    }

    setGridValues(() => createEmptyGrid());
    setCurrencies(createEmptyCurrencies());
  };

  const handleEdit = () => {
    // enable editing; keep current savedGrid to allow cancel
    setIsEditing(true);
    if (!savedGrid) {
      // set savedGrid snapshot for cancel to revert to current state
      setSavedGrid({ grid: gridValues, currencies });
    }
  };

  const handleCancel = () => {
    // revert to savedGrid or empty
    if (savedGrid) {
      setGridValues(savedGrid.grid);
      setCurrencies(savedGrid.currencies || createEmptyCurrencies());
    } else {
      setGridValues(createEmptyGrid());
      setCurrencies(createEmptyCurrencies());
    }
    setIsEditing(false);
  };

  useEffect(() => {
    const fetchMasterField = async (field) => {
      try {
        const ref = doc(db, "newMaster", field);
        const snap = await getDoc(ref);
        if (!snap.exists()) return [];
        const data = snap.data();
        const list = data.list || [];
        // normalize entries: support array of strings or objects with name/type
        return list.map((item) => {
          if (!item && item !== 0) return "";
          if (typeof item === "string") return item;
          if (typeof item === "object") return item.name || item.type || JSON.stringify(item);
          return String(item);
        });
      } catch (err) {
        console.error("Error fetching master field", field, err);
        return [];
      }
    };

    const fetchAll = async () => {
      const [linesList, polList] = await Promise.all([
        fetchMasterField("line"),
        fetchMasterField("pol")
      ]);

      setLines((linesList || []).filter(Boolean).sort());
      setPols((polList || []).filter(Boolean).sort());
    };

    fetchAll();
  }, []);

  return (
    <div className="container py-3">
      <h3>Locals</h3>
      <p>Select values below (options loaded from Master data):</p>

      <div className="row g-3">
        <div className="col-sm-6 col-md-4">
          <label className="form-label">Line</label>
          <select className="form-select" value={selectedLine} onChange={(e) => setSelectedLine(e.target.value)}>
            <option value="">-- Select Line --</option>
            {lines.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

  {/* Equipment Type removed */}

        <div className="col-sm-6 col-md-4">
          <label className="form-label">POL</label>
          <select className="form-select" value={selectedPol} onChange={(e) => setSelectedPol(e.target.value)}>
            <option value="">-- Select POL --</option>
            {pols.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <style>{`
          .locals-table thead th { position: sticky; top: 0; background: #fff; z-index: 2; }
          .locals-table tbody tr:nth-child(odd) { background: #fbfbfb; }
          .locals-table tbody tr:hover { background: #eef6ff; }
          .locals-table td, .locals-table th { vertical-align: middle; }
          .locals-table .num { text-align: right; padding-right: 12px; font-variant-numeric: tabular-nums; }
          .locals-table .charge-name { font-weight: 600; }
          .locals-totals { background: #f1f5f9; font-weight: 700; }
          /* Make editable inputs visually identical to view cells */
          .locals-table td { position: relative; }
          .input-editable {
            display: block;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            padding: 0.375rem 0.75rem !important; /* match table cell padding */
            margin: 0;
            font: inherit;
            color: inherit;
            text-align: right !important;
          }
          .input-editable:focus { outline: 1px dashed rgba(0,123,255,0.15); }
        `}</style>
        <h5>Local Charges (enter values per equipment type)</h5>
        <div className="d-flex gap-2 mb-2">
          {!isEditing ? (
            <>
              <button className="btn btn-outline-primary btn-sm" onClick={handleEdit}>
                Edit
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loadingSave}>
                {loadingSave ? "Saving..." : "Save"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleClear}>
                Clear
              </button>
              <button className="btn btn-light btn-sm" onClick={handleCancel}>
                Cancel
              </button>
            </>
          )}
          <div className="ms-auto align-self-center text-muted small">
            {isEditing ? (
              lastSavedAt ? (
                <span>
                  <span>{`Last saved: ${new Date(lastSavedAt).toLocaleString()}`}</span>
                  {lastSavedBy ? <span>{` by ${lastSavedBy}`}</span> : null}
                </span>
              ) : (
                "Not saved yet"
              )
            ) : null}
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered table-sm locals-table">
            <thead className="table-light">
              <tr>
                <th>Charge \ Equip</th>
                {columns.map((c) => (
                  <th key={c} className="text-center num">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chargeRows.map((r) => (
                <tr key={r}>
                  <td style={{ minWidth: 220 }} className="charge-name">{r}</td>
                  {columns.map((c) => (
                    <td key={c} className="align-middle text-end num">
                      {isEditing ? (
                        (() => {
                          const key = `${r}||${c}`;
                          const formatted = formatNumber(gridValues[r][c]);
                          const showFormatted = focusedCell !== key;
                          return (
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <select className="form-select form-select-sm" style={{ width: 90 }} value={currencies[r][c] || ""} onChange={(e) => setCurrencies((p) => ({ ...p, [r]: { ...(p[r]||{}), [c]: e.target.value } }))}>
                                <option value="">--</option>
                                <option value="USD">USD</option>
                                <option value="INR">INR</option>
                              </select>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="input-editable"
                                value={showFormatted ? (formatted === null ? "" : formatted) : (gridValues[r][c] || "")}
                                onChange={(e) => handleGridChange(r, c, e.target.value)}
                                onFocus={(e) => { setFocusedCell(key); try { e.target.select(); } catch (err) {} }}
                                onBlur={(e) => {
                                  const cleaned = String(e.target.value || "").replace(/,/g, "").trim();
                                  const sanitized = cleaned.replace(/[^0-9.\-]/g, "");
                                  handleGridChange(r, c, sanitized);
                                  setFocusedCell(null);
                                }}
                                placeholder="0"
                              />
                            </div>
                          );
                        })()
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                          <div>{formatDisplay(gridValues[r][c])}</div>
                          <div className="text-muted small" style={{ minWidth: 36, textAlign: 'left' }}>{(currencies[r] && currencies[r][c]) || ''}</div>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
