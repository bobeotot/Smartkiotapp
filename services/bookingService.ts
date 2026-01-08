
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
  // Lấy phần sau dấu hai chấm (ví dụ DTSTART;VALUE=DATE:20231027 -> 20231027)
  const clean = raw.split(':').pop()?.split('T')[0] || "";
  if (clean.length < 8) return "";
  
  const y = clean.substring(0, 4);
  const m = clean.substring(4, 6);
  const d = clean.substring(6, 8);
  // Đảm bảo trả về YYYY-MM-DD chính xác
  return `${y}-${m}-${d}`;
};

const parseICal = (text: string, room: string): BookingEvent[] => {
  const events: BookingEvent[] = [];
  const lines = text.split(/\r?\n/);
  let currentEvent: Partial<BookingEvent> | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    // Xử lý line folding
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
    if (!config.icalUrl || config.icalUrl.trim() === "") continue;

    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(config.icalUrl.trim())}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        console.warn(`iCal ${roomNumber} fail: ${response.status}`);
        continue;
      }

      const icalText = await response.text();

      if (icalText && icalText.includes('BEGIN:VCALENDAR')) {
        const events = parseICal(icalText, roomNumber);
        allEvents = [...allEvents, ...events];
        console.log(`Loaded ${events.length} events for Room ${roomNumber}`);
      }
    } catch (error) {
      console.error(`Sync error Room ${roomNumber}:`, error);
    }
  }

  const newTransactions: Transaction[] = [];

  allEvents.forEach(event => {
    // Tìm đơn trùng bằng externalId (UID từ iCal)
    const exists = currentTransactions.find(t => t.externalId === event.id);
    
    if (!exists) {
      // Tính số đêm dựa trên chuỗi ngày
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
        description: `[Booking.com] ${event.summary || 'Khách đặt'} (${event.start})`,
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

export const generateAppICal = (transactions: Transaction[], targetRoom: string): string => {
  const now = new Date().toISOString().replace(/[-:.]/g, '').split('T')[0] + 'T000000Z';
  let ical = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Smart Kiot//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
  
  const appBookings = transactions.filter(t => 
    t.category === Category.HOMESTAY && t.room === targetRoom && t.source !== 'booking.com'
  );

  appBookings.forEach(t => {
    const start = t.checkIn?.replace(/-/g, '') || "";
    const end = t.checkOut?.replace(/-/g, '') || "";
    if (start && end) {
      ical += "BEGIN:VEVENT\r\n";
      ical += `UID:${t.id}@smartkiot.app\r\nDTSTAMP:${now}\r\n`;
      ical += `DTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\n`;
      ical += `SUMMARY:SmartKiot: ${t.guestName || 'Khách'}\r\nSTATUS:CONFIRMED\r\nTRANSP:OPAQUE\r\nEND:VEVENT\r\n`;
    }
  });

  ical += "END:VCALENDAR\r\n";
  return ical;
};
