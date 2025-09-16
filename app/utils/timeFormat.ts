/**
 * Time formatting utilities for the app
 */

/**
 * Format event time from database format to display format (matches Games tab format)
 * Input: "2025-08-03 19:11:00+00" -> Output: "7:11 PM"
 */
export function formatEventTime(eventTimeString?: string): string {
  if (!eventTimeString || eventTimeString === 'TBD') {
    return 'TBD';
  }

  try {
    // Parse the database timestamp with safe normalization
    const date = parseDateSafe(eventTimeString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'TBD';
    }

    // Format to local time (12-hour format) - same as Games tab
    const timeString = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return timeString;
  } catch (error) {
    console.error('Error formatting event time:', error);
    return 'TBD';
  }
}

/**
 * Format game time (same function as used in Games tab)
 */
export function formatGameTime(dateString: string): string {
  if (!dateString || dateString === 'TBD') {
    return 'TBD';
  }
  
  try {
    const date = parseDateSafe(dateString);
    if (isNaN(date.getTime())) {
      return 'TBD';
    }
    
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting game time:', error);
    return 'TBD';
  }
}

/**
 * Format event time with date for full display
 * Input: "2025-08-03 19:11:00+00" -> Output: "Aug 3, 7:11 PM"
 */
export function formatEventTimeWithDate(eventTimeString?: string): string {
  if (!eventTimeString || eventTimeString === 'TBD') {
    return 'TBD';
  }

  try {
    const date = parseDateSafe(eventTimeString);
    
    if (isNaN(date.getTime())) {
      return 'TBD';
    }

    // Format with date and time
    const dateTimeString = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return dateTimeString;
  } catch (error) {
    console.error('Error formatting event time with date:', error);
    return 'TBD';
  }
}

/**
 * Check if event time is today
 */
export function isEventToday(eventTimeString?: string): boolean {
  if (!eventTimeString || eventTimeString === 'TBD') {
    return false;
  }

  try {
    const eventDate = parseDateSafe(eventTimeString);
    const today = new Date();
    
    return eventDate.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
}

/**
 * Safely parse common DB timestamp formats into Date
 * Handles:
 * - "YYYY-MM-DD HH:mm:ss+00" -> replace space with 'T'
 * - Missing timezone -> append 'Z' to treat as UTC
 */
function parseDateSafe(input: string): Date {
  try {
    let s = (input || '').trim();
    if (!s) return new Date('Invalid');
    // Normalize space-separated date/time to ISO 'T'
    if (s.includes(' ') && !s.includes('T')) {
      s = s.replace(' ', 'T');
    }
    // If no timezone info, default to UTC by appending 'Z'
    const hasTZ = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !hasTZ) {
      s += 'Z';
    }
    return new Date(s);
  } catch (e) {
    return new Date('Invalid');
  }
}