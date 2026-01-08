
import { Category, Transaction, RoomConfig } from "../types";

export interface BookingEvent {
  id: string;
  start: string;
  end: string;
  summary: string;
  room: string;
}

const parseICal = (text: string, room: string): BookingEvent[] => {
  const events: BookingEvent[] = [];
  const lines = text.split(/\r?\n/);
  let currentEvent: Partial<BookingEvent> | null = null;

  lines.forEach(line => {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = { room };
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent?.id && currentEvent?.start && currentEvent?.end) {
        events.push(currentEvent as BookingEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('UID:')) currentEvent.id = line.substring(4).trim();
      if (line.startsWith('DTSTART')) {
        const val = line.split(/[:;]/).pop() || "";
        currentEvent.start = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
      }
      if (line.startsWith('DTEND')) {
        const val = line.split(/[:;]/).pop() || "";
        currentEvent.end = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
      }
      if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8).trim();
    }
  });

  return events;
};

export const syncBookingCom = async (
  currentTransactions: Transaction[], 
  roomConfigs: Record<string, RoomConfig>
): Promise<Transaction[]> => {
  let allEvents: BookingEvent[] = [];
  
  for (const [roomNumber, config] of Object.entries(roomConfigs)) {
    if (!config.icalUrl) continue;

    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(config.icalUrl)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) continue;

      const icalText = await response.text();
      if (icalText.includes('BEGIN:VCALENDAR')) {
        allEvents = [...allEvents, ...parseICal(icalText, roomNumber)];
      }
    } catch (error) {
      console.error(`Error syncing room ${roomNumber}:`, error);
    }
  }

  let updatedTransactions = [...currentTransactions];

  allEvents.forEach(event => {
    const exists = updatedTransactions.find(t => t.externalId === event.id);
    if (!exists) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const price = roomConfigs[event.room]?.price || 0;
      
      const newTx: Transaction = {
        id: `auto-${Date.now()}-${event.id}`,
        externalId: event.id,
        source: 'booking.com',
        category: Category.HOMESTAY,
        room: event.room,
        amount: price * nights,
        originalAmount: price * nights,
        discount: 0,
        date: new Date().toISOString(),
        description: `[Booking.com] Phòng ${event.room} (${event.start} - ${event.end})`,
        quantity: nights,
        unit: 'đêm',
        checkIn: event.start,
        checkOut: event.end
      };
      updatedTransactions.push(newTx);
    }
  });

  updatedTransactions = updatedTransactions.filter(t => {
    if (t.source === 'booking.com') {
      return allEvents.some(e => e.id === t.externalId);
    }
    return true;
  });

  return updatedTransactions;
};

/**
 * Tạo nội dung file iCal chuẩn RFC 5545
 */
export const generateAppICal = (transactions: Transaction[], targetRoom: string): string => {
  const now = new Date().toISOString().replace(/[-:.]/g, '').split('T')[0] + 'T000000Z';
  
  let ical = "BEGIN:VCALENDAR\r\n";
  ical += "VERSION:2.0\r\n";
  ical += "PRODID:-//Smart Kiot//NONSGML v1.0//EN\r\n";
  ical += "METHOD:PUBLISH\r\n";
  ical += "X-WR-CALNAME:Smart Kiot - Room " + targetRoom + "\r\n";
  ical += "X-WR-TIMEZONE:Asia/Ho_Chi_Minh\r\n";
  
  const homestayManual = transactions.filter(t => 
    t.category === Category.HOMESTAY && 
    t.source === 'manual' && 
    t.room === targetRoom
  );

  homestayManual.forEach(t => {
    const start = t.checkIn?.replace(/-/g, '') || "";
    const end = t.checkOut?.replace(/-/g, '') || "";
    if (start && end) {
      ical += "BEGIN:VEVENT\r\n";
      ical += `UID:${t.id}@smartkiotsusu.app\r\n`;
      ical += `DTSTAMP:${now}\r\n`;
      ical += `DTSTART;VALUE=DATE:${start}\r\n`;
      ical += `DTEND;VALUE=DATE:${end}\r\n`;
      ical += `SUMMARY:Booked via Smart Kiot (${t.guestName || 'Guest'})\r\n`;
      ical += `DESCRIPTION:Manual booking for Room ${targetRoom}\r\n`;
      ical += "STATUS:CONFIRMED\r\n";
      ical += "TRANSP:OPAQUE\r\n";
      ical += "END:VEVENT\r\n";
    }
  });

  ical += "END:VCALENDAR";
  return ical;
};
