
import { Category, Transaction, RoomConfig } from "../types";

export interface BookingEvent {
  id: string;
  start: string;
  end: string;
  summary: string;
  room: string;
}

// Hàm ngắt dòng cho iCal (không quá 75 ký tự theo chuẩn RFC 5545)
const foldLine = (line: string): string => {
  if (line.length <= 75) return line;
  return line.substring(0, 75) + "\r\n " + foldLine(line.substring(75));
};

const formatLine = (key: string, value: string): string => {
  return foldLine(`${key}:${value}`) + "\r\n";
};

/**
 * Xử lý ngày tháng từ iCal: 20241025 hoặc 20241025T120000Z
 * Trả về định dạng: YYYY-MM-DD
 */
const formatIcalDate = (raw: string): string => {
  const datePart = raw.split('T')[0]; // Lấy phần trước chữ T nếu có
  if (datePart.length < 8) return "";
  const y = datePart.substring(0, 4);
  const m = datePart.substring(4, 6);
  const d = datePart.substring(6, 8);
  return `${y}-${m}-${d}`;
};

const parseICal = (text: string, room: string): BookingEvent[] => {
  const events: BookingEvent[] = [];
  const lines = text.split(/\r?\n/);
  let currentEvent: Partial<BookingEvent> | null = null;

  lines.forEach(line => {
    const cleanLine = line.trim();
    if (cleanLine.startsWith('BEGIN:VEVENT')) {
      currentEvent = { room };
    } else if (cleanLine.startsWith('END:VEVENT')) {
      if (currentEvent?.id && currentEvent?.start && currentEvent?.end) {
        events.push(currentEvent as BookingEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (cleanLine.startsWith('UID:')) currentEvent.id = cleanLine.substring(4).trim();
      if (cleanLine.startsWith('DTSTART')) {
        const val = cleanLine.split(/[:;]/).pop() || "";
        currentEvent.start = formatIcalDate(val);
      }
      if (cleanLine.startsWith('DTEND')) {
        const val = cleanLine.split(/[:;]/).pop() || "";
        currentEvent.end = formatIcalDate(val);
      }
      if (cleanLine.startsWith('SUMMARY:')) currentEvent.summary = cleanLine.substring(8).trim();
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
      // Sử dụng proxy thay thế nếu corsproxy.io gặp vấn đề
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(config.icalUrl)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) continue;

      const data = await response.json();
      const icalText = data.contents;

      if (icalText && icalText.includes('BEGIN:VCALENDAR')) {
        allEvents = [...allEvents, ...parseICal(icalText, roomNumber)];
      }
    } catch (error) {
      console.error(`Error syncing room ${roomNumber}:`, error);
    }
  }

  let updatedTransactions = [...currentTransactions];
  let addedCount = 0;

  allEvents.forEach(event => {
    // Kiểm tra xem đã tồn tại giao dịch này chưa dựa trên externalId (UID từ iCal)
    const exists = updatedTransactions.find(t => t.externalId === event.id);
    
    if (!exists) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const price = roomConfigs[event.room]?.price || 350000;
      
      const newTx: Transaction = {
        id: `auto-${event.id}`, // Dùng UID làm ID để tránh trùng lặp
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
        guestName: event.summary?.replace('Booked - ', '') || 'Khách Booking'
      };
      updatedTransactions.push(newTx);
      addedCount++;
    }
  });

  return updatedTransactions;
};

export const generateAppICal = (transactions: Transaction[], targetRoom: string): string => {
  const now = new Date().toISOString().replace(/[-:.]/g, '').split('T')[0] + 'T000000Z';
  
  let ical = "BEGIN:VCALENDAR\r\n";
  ical += "VERSION:2.0\r\n";
  ical += "PRODID:-//Smart Kiot//NONSGML v1.0//EN\r\n";
  ical += "CALSCALE:GREGORIAN\r\n";
  ical += "METHOD:PUBLISH\r\n";
  ical += `X-WR-CALNAME:Room ${targetRoom} Calendar\r\n`;
  
  const homestayManual = transactions.filter(t => 
    t.category === Category.HOMESTAY && 
    (t.source === 'manual' || !t.source) && 
    t.room === targetRoom
  );

  homestayManual.forEach(t => {
    const start = t.checkIn?.replace(/-/g, '') || "";
    const end = t.checkOut?.replace(/-/g, '') || "";
    if (start && end) {
      ical += "BEGIN:VEVENT\r\n";
      ical += `UID:${t.id}@smartkiot.app\r\n`;
      ical += `DTSTAMP:${now}\r\n`;
      ical += `DTSTART;VALUE=DATE:${start}\r\n`;
      ical += `DTEND;VALUE=DATE:${end}\r\n`;
      ical += `SUMMARY:Đã đặt: ${t.guestName || 'Khách'}\r\n`;
      ical += "STATUS:CONFIRMED\r\n";
      ical += "TRANSP:OPAQUE\r\n";
      ical += "END:VEVENT\r\n";
    }
  });

  ical += "END:VCALENDAR\r\n";
  return ical;
};
