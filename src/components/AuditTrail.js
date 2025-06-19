// components/AuditTrail.js
import React from 'react';
import { Box, Typography, Divider, Chip } from '@mui/material';

const AuditTrail = ({ entry, show }) => {
  if (!show || !entry) return null;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return null; // Return null instead of 'Unknown time'
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return null;
      
      // Format: DD/MM/YYYY HH:MM:SS
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return null;
    }
  };

  const formatFirestoreTimestamp = (timestamp) => {
    if (!timestamp) return 'Not recorded';
    try {
      // Handle Firestore timestamp
      if (timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return formatTimestamp(date.toISOString());
      }
      // Handle ISO string or Date
      if (typeof timestamp === 'string' || timestamp instanceof Date) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return formatTimestamp(date.toISOString());
        }
      }
      return 'Not recorded';
    } catch (error) {
      return 'Not recorded';
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Audit Trail
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Entry ID:</strong> {entry.id || 'Unknown'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Customer:</strong> {entry.customer?.name || entry.customer || 'Unknown'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Booking No:</strong> {entry.bookingNo || 'Unknown'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Created by:</strong> {entry.createdBy || 'Unknown'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Created at:</strong> {formatFirestoreTimestamp(entry.createdAt)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Last edited by:</strong> {entry.lastEditedBy || 'Unknown'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Last edited at:</strong> {formatFirestoreTimestamp(entry.lastEditedAt)}
        </Typography>
      </Box>
      <Divider sx={{ my: 2 }} />
      <Typography variant="h6" gutterBottom>
        Field Actions
      </Typography>
      {entry.actions && entry.actions.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {entry.actions.map((action, index) => {
            const formattedTime = formatFirestoreTimestamp(action.timestamp);
            return (
              <Box
                key={index}
                sx={{
                  p: 1.5,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 1,
                  border: '1px solid #e0e0e0',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  <Chip
                    label={action.user || 'Unknown'}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Typography variant="body2" color="text.secondary">
                    set
                  </Typography>
                  <Chip
                    label={action.field}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                  <Typography variant="body2" color="text.secondary">
                    to
                  </Typography>
                  <Chip
                    label={`"${action.value}"`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                </Box>
                {formattedTime && (
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ 
                      ml: 1, 
                      display: 'block',
                      fontStyle: 'italic' 
                    }}
                  >
                    on {formattedTime}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 2 }}>
          No actions recorded for this entry.
        </Typography>
      )}
    </Box>
  );
};

export default AuditTrail;