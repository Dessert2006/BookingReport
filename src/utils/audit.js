// src/utils/audit.js
import { serverTimestamp } from "firebase/firestore";

// Call this when creating a new entry
export function getDefaultAuditFields(username) {
  if (!username) {
    console.warn("Username is required for audit fields");
    username = "Unknown";
  }
  return {
    createdBy: username,
    createdAt: serverTimestamp(),
    lastEditedBy: username,
    lastEditedAt: serverTimestamp(),
    actions: [],
  };
}

// Call this when editing an entry
export function getUpdatedAuditFields({ prevActions, username, field, value }) {
  if (!username) {
    console.warn("Username is required for audit fields");
    username = "Unknown";
  }
  if (!field) {
    console.warn("Field name is required for audit action");
    return {
      lastEditedBy: username,
      lastEditedAt: serverTimestamp(),
      actions: prevActions || [],
    };
  }
  
  // Add timestamp to each action - THIS IS THE IMPORTANT PART
  const newAction = {
    field,
    user: username,
    value: value || "",
    timestamp: new Date().toISOString() // THIS LINE ADDS THE TIMESTAMP
  };
  
  return {
    lastEditedBy: username,
    lastEditedAt: serverTimestamp(),
    actions: [
      ...(prevActions || []),
      newAction
    ],
  };
}