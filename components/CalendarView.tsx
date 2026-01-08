import React, { useState } from "react";
import { Transaction, Category } from "../types";
import { ROOM_ICAL_CONFIG } from "../constants";
import { generateAppICal } from "../services/bookingService";

interface CalendarViewProps {
  transactions: Transaction[];
}

const BOOKING_COLORS = [
  "bg-indigo-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-rose-500",
  "bg-amber-500",
  "bg-violet-500",
];

type CalendarSubView = "month" | "timeline" | "config";

export const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<CalendarSubView>("timeline");
  const [selectedRoom, setSelectedRoom] = useState(
    Object.keys(ROOM_ICAL_CONFIG)[0]
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [activeBooking, setActiveBooking] = useState<Transaction | null>(null);

  const [driveUrl, setDriveUrl] = useState("");
  const [convertedUrl, setConvertedUrl] = useState("");

  const months = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ];

  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const roomList = Object.keys(ROOM_ICAL_CONFIG);

  const getBookingColor = (id: string, source?: string) => {
    if (source === "booking.com") return "bg-blue-700";
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return BOOKING_COLORS[Math.abs(hash) % BOOKING_COLORS.length];
  };

  const getBookingsForDate = (date: Date, room: string) => {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    return transactions
      .filter((t) => {
        if (t.category !== Category.HOMESTAY || t.room !== room) return false;
        if (!t.checkIn || !t.checkOut) return false;

        const start = new Date(t.checkIn);
        const end = new Date(t.checkOut);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        return target >= start && target < end;
      })
      .sort((a, b) => (a.source === "booking.com" ? -1 : 1));
  };

  const downloadICalFile = (room: string) => {
    const content = generateAppICal(transactions, room);
    const blob = new Blob([content], {
      type: "text/calendar;charset=utf-8",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lich_phong_${room}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ================= CONFIG VIEW ================= */

  const renderConfig = () => (
    <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl p-8 space-y-12">
      <div>
        <h4 className="font-black text-slate-800 uppercase text-sm mb-6">
          Hướng dẫn khóa phòng trên Booking.com
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
            <h5 className="font-black text-[10px] uppercase">
              Bước 1: Tải lịch
            </h5>
            <p className="text-[10px] text-slate-500">
              Bấm nút <strong>Tải file .ics</strong> để lưu lịch phòng.
            </p>
          </div>

          <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
            <h5 className="font-black text-[10px] uppercase">
              Bước 2: Upload Drive
            </h5>
            <p className="text-[10px] text-slate-500">
              Tải file lên Google Drive, chọn “Chia sẻ” – “Bất kỳ ai có link”.
            </p>
          </div>

          <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
            <h5 className="font-black text-[10px] uppercase">
              Bước 3: Import Booking
            </h5>
            <p className="text-[10px] text-slate-500">
              Dán link vào mục Import Calendar trên Booking.com.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roomList.map((room) => (
          <button
            key={room}
            onClick={() => downloadICalFile(room)}
            className="p-6 rounded-3xl border-2 border-dashed border-slate-200 hover:border-blue-500 text-center"
          >
            <div className="font-black text-[10px] uppercase">
              Tải file .ics
            </div>
            <div className="text-[9px] text-slate-400">Phòng {room}</div>
          </button>
        ))}
      </div>

      <div className="bg-amber-50 p-6 rounded-3xl space-y-4">
        <h4 className="font-black text-amber-800 uppercase text-xs">
          Sửa link Google Drive
        </h4>

        <div className="flex gap-2">
          <input
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="Dán link Drive tại đây"
            className="flex-1 p-3 rounded-xl text-[10px]"
          />

          <button
            onClick={() => {
              const match = driveUrl.match(/\/d\/(.+?)\//);
              if (match) {
                setConvertedUrl(
                  `https://drive.google.com/uc?export=download&id=${match[1]}`
                );
              } else {
                alert("Link Drive không hợp lệ");
              }
            }}
            className="px-6 bg-amber-600 text-white rounded-xl text-[10px]"
          >
            Sửa link
          </button>
        </div>

        {convertedUrl && (
          <code className="block text-[9px] break-all text-blue-600">
            {convertedUrl}
          </code>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex gap-2">
        <button onClick={() => setViewMode("timeline")}>Timeline</button>
        <button onClick={() => setViewMode("month")}>Month</button>
        <button onClick={() => setViewMode("config")}>Config</button>
      </div>

      {viewMode === "config" && renderConfig()}
    </div>
  );
};
