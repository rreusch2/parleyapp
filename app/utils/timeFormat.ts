/**
 * Time formatting utilities for the app
 */

/**
 * Format event time from database format to display format
 * Input: "2025-08-03 19:11:00+00" -> Output: "7:11 PM"
 */
export function formatEventTime(eventTimeString?: string): string {
  if (!eventTimeString || eventTimeString === 'TBD') {
    return 'TBD';
  }

  try {
    // Parse the database timestamp
    const date = new Date(eventTimeString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'TBD';
    }

    // Format to local time (12-hour format)
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
 * Format event time with date for full display
 * Input: "2025-08-03 19:11:00+00" -> Output: "Aug 3, 7:11 PM"
 */
export function formatEventTimeWithDate(eventTimeString?: string): string {
  if (!eventTimeString || eventTimeString === 'TBD') {
    return 'TBD';
  }

  try {
    const date = new Date(eventTimeString);
    
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
    const eventDate = new Date(eventTimeString);
    const today = new Date();
    
    return eventDate.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
}