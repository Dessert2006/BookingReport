import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { DataGrid } from "@mui/x-data-grid";
import { TextField, FormControlLabel, Checkbox } from "@mui/material";

function CompletedFiles() {
  const [completedEntries, setCompletedEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [locations, setLocations] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);

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
          blNo: entryData.blNo || ""
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
    "isfSent"
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
          return params.value || "";
        }
      };
    }),
    {
      field: "blNo",
      headerName: "BL No",
      width: 200
    }
  ];

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