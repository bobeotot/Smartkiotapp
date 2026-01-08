
import { Category, Transaction, RoomConfig } from "../types";

export interface BookingEvent {
  id: string;
  start: string;
  end: string;
  summary: string;
  room: string;
}

const formatIcalDate = (raw: string): string => {
  if (!raw) return "";
  const clean = raw.split(':').pop()?.split('T')[0] || "";
  if (clean.length < 8) return "";
  const y = clean.substring(0, 4);
  const m = clean.substring(4, 6);
  const d = clean.substring(6, 8);
  return `${y}-${m}-${d}`;
};

const parseICal = (text: string, room: string): BookingEvent[] => {
  const events: BookingEvent[] = [];
  const lines = text.split(/\r?\n/);
  let currentEvent: Partial<BookingEvent> | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    while (i + 1 < lines.length && (lines[i+1].startsWith(' ') || lines[i+1].startsWith('\t'))) {
      line += lines[i+1].substring(1);
      i++;
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = { room };
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent?.id && currentEvent?.start && currentEvent?.end) {
        events.push(currentEvent as BookingEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('UID:')) currentEvent.id = line.substring(4).trim();
      if (line.startsWith('DTSTART')) currentEvent.start = formatIcalDate(line);
      if (line.startsWith('DTEND')) currentEvent.end = formatIcalDate(line);
      if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8).trim();
    }
  }
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
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(config.icalUrl)}&timestamp=${Date.now()}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) continue;

      const data = await response.json();
      const icalText = data.contents;

      if (icalText && icalText.includes('BEGIN:VCALENDAR')) {
        const events = parseICal(icalText, roomNumber);
        allEvents = [...allEvents, ...events];
      }
    } catch (error) {
      console.error(`Error syncing room ${roomNumber}:`, error);
    }
  }

  const updatedTransactions = [...currentTransactions];
  let newTransactions: Transaction[] = [];

  allEvents.forEach(event => {
    const exists = updatedTransactions.find(t => t.externalId === event.id);
    if (!exists) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const price = roomConfigs[event.room]?.price || 350000;
      
      const newTx: Transaction = {
        id: `auto-${event.id}`,
        externalId: event.id,
        source: 'booking.com',
        category: Category.HOMESTAY,
        room: event.room,
        amount: price * nights,
        originalAmount: price * nights,
        discount: 0,
        date: new Date().toISOString(),
        description: `[Booking.com] ${event.summary || 'Khách đặt'} (${event.start} - ${event.end})`,
        quantity: nights,
        unit: 'đêm',
        checkIn: event.start,
        checkOut: event.end,
        isPaid: true,
        guestName: (event.summary || 'Khách Booking').replace('Booked - ', '')
      };
      newTransactions.push(newTx);
    }
  });

  return newTransactions;
};

/**
 * Tạo file iCal đạt chuẩn để Booking.com có thể đọc và khóa phòng
 */
export const generateAppICal = (transactions: Transaction[], targetRoom: string): string => {
  const now = new Date().toISOString().replace(/[-:.]/g, '').split('T')[0] + 'T000000Z';
  let ical = "BEGIN:VCALENDAR\r\n";
  ical += "VERSION:2.0\r\n";
  ical += "PRODID:-//Smart Kiot//Business Management//EN\r\n";
  ical += "CALSCALE:GREGORIAN\r\n";
  ical += "METHOD:PUBLISH\r\n";
  
  // Lấy các đơn đặt thủ công trên App (không bao gồm đơn đã đồng bộ từ Booking về)
  const appBookings = transactions.filter(t => 
    t.category === Category.HOMESTAY && 
    t.room === targetRoom && 
    t.source !== 'booking.com'
  );

  appBookings.forEach(t => {
    const start = t.checkIn?.replace(/-/g, '') || "";
    const end = t.checkOut?.replace(/-/g, '') || "";
    
    if (start && end) {
      ical += "BEGIN:VEVENT\r\n";
      ical += `UID:${t.id}@smartkiot.app\r\n`;
      ical += `DTSTAMP:${now}\r\n`;
      ical += `DTSTART;VALUE=DATE:${start}\r\n`;
      ical += `DTEND;VALUE=DATE:${end}\r\n`;
      ical += `SUMMARY:Đã đặt (Smart Kiot): ${t.guestName || 'Khách'}\r\n`;
      ical += "STATUS:CONFIRMED\r\n";
      ical += "TRANSP:OPAQUE\r\n"; // Quan trọng: Báo cho Booking biết đây là thời gian BẬN
      ical += "END:VEVENT\r\n";
    }
  });

  ical += "END:VCALENDAR\r\n";
  return ical;
};
