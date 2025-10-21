// Formatting utilities matching web app

export const formatMoneyline = (ml: number | null): string => {
  if (ml === null || ml === undefined) return '-';
  if (ml > 0) return `+${ml}`;
  return ml.toString();
};

export const formatSpread = (spread: number | null): string => {
  if (spread === null || spread === undefined) return '-';
  if (spread > 0) return `+${spread}`;
  return spread.toString();
};

export const convertTimeToEST = (timeString: string | null | undefined): string => {
  if (!timeString) return 'TBD';
  
  try {
    // If it's a full datetime string, parse it
    if (timeString.includes('T') || timeString.includes('+')) {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) + ' EST';
    }
    
    // Otherwise, parse as time string
    const [hours, minutes] = String(timeString).split(':').map(Number);
    const estHours = hours + 4;
    const finalHours = estHours >= 24 ? estHours - 24 : estHours;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    
    const estDate = new Date(year, month, day, finalHours, minutes, 0);
    
    return estDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) + ' EST';
  } catch (error) {
    console.error('Error formatting time:', error);
    return String(timeString);
  }
};

export const formatDate = (dateString: string): string => {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

export const formatCompactDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'TBD';
  
  try {
    // Handle if it's already a Date object
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(dateString);
  }
};

export const roundToNearestHalf = (value: number | null | undefined): number | string => {
  if (value === null || value === undefined) return '-';
  return Math.round(value * 2) / 2;
};

export const getDisplayedProb = (p: number | null): number | null => {
  if (p === null || p === undefined) return null;
  return p >= 0.5 ? p : 1 - p;
};

