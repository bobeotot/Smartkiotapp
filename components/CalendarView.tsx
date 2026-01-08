
import React, { useState, useMemo } from 'react';
import { Transaction, Category, RoomConfig } from '../types';
import { ROOM_ICAL_CONFIG } from '../constants';
import { generateAppICal } from '../services/bookingService';

interface CalendarViewProps {
  transactions: Transaction[];
}

const BOOKING_COLORS = [
  'bg-indigo-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-rose-500',
  'bg-amber-500',
  'bg-violet-500'
];

type CalendarSubView = 'month' | 'timeline' | 'config';

export const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<CalendarSubView>('timeline');
  const [selectedRoom, setSelectedRoom] = useState<string>(Object.keys(ROOM_ICAL_CONFIG)[0]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [activeBooking, setActiveBooking] = useState<Transaction | null>(null);
  
  const [localConfigs, setLocalConfigs] = useState<Record<string, RoomConfig>>(() => {
    const saved = localStorage.getItem('smart_kiot_room_configs');
    return saved ? JSON.parse(saved) : ROOM_ICAL_CONFIG;
  });

  const [importIcalUrl, setImportIcalUrl] = useState('');
  const [targetImportRoom, setTargetImportRoom] = useState(Object.keys(ROOM_ICAL_CONFIG)[0]);
  const [driveUrl, setDriveUrl] = useState('');
  const [convertedUrl, setConvertedUrl] = useState('');

  const months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const roomList = Object.keys(ROOM_ICAL_CONFIG);

  const getBookingColor = (id: string, source?: string) => {
    if (source === 'booking.com') return 'bg-blue-700';
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return BOOKING_COLORS[Math.abs(hash) % BOOKING_COLORS.length];
  };

  const getBookingsForDate = (date: Date, room: string) => {
    const target = new Date(date);
    target.setHours(0,0,0,0);
    return transactions.filter(t => {
      if (t.category !== Category.HOMESTAY || t.room !== room) return false;
      if (!t.checkIn || !t.checkOut) return false;
      const start = new Date(t.checkIn);
      const end = new Date(t.checkOut);
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      return target >= start && target < end;
    }).sort((a, b) => (a.source === 'booking.com' ? -1 : 1));
  };

  const downloadICalFile = (room: string) => {
    const content = generateAppICal(transactions, room);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `lich_phong_${room}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCell = (date: Date, room: string, isMonth: boolean = false) => {
    const bookings = getBookingsForDate(date, room);
    if (bookings.length === 0) return null;
    const mainBooking = bookings[0];
    const hasConflict = bookings.length > 1;
    const isBookingCom = mainBooking.source === 'booking.com';
    return (
      <div onClick={(e) => { e.stopPropagation(); setActiveBooking(mainBooking); }} className={`w-full h-full rounded-lg ${getBookingColor(mainBooking.id, mainBooking.source)} p-1 flex flex-col items-center justify-center text-white shadow-sm hover:brightness-110 active:scale-95 transition-all overflow-hidden cursor-pointer relative`}>
        {isBookingCom && <div className="absolute top-0.5 left-0.5 bg-white text-blue-700 rounded-full w-3 h-3 flex items-center justify-center text-[6px] font-black shadow-sm">B</div>}
        {hasConflict && <div className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-[6px] font-black animate-pulse">!</div>}
        <span className={`font-black uppercase leading-tight line-clamp-1 ${isMonth ? 'text-[9px]' : 'text-[8px]'}`}>{mainBooking.guestName || "Khách"}</span>
      </div>
    );
  };

  const renderTimeline = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="sticky left-0 z-20 bg-slate-50 p-4 text-left border-r border-slate-100 min-w-[120px]"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phòng / Ngày</span></th>
                {daysArr.map(d => {
                  const date = new Date(selectedYear, selectedMonth, d);
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <th key={d} className={`p-3 text-center min-w-[65px] border-r border-slate-50 ${isToday ? 'bg-blue-50' : ''}`}>
                      <div className={`text-[11px] font-black ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>{d}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase">{daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roomList.map(room => (
                <tr key={room} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <td className="sticky left-0 z-20 bg-white p-4 font-black text-slate-700 text-xs border-r border-slate-100">Phòng {room}</td>
                  {daysArr.map(d => (
                    <td key={d} className="p-1 text-center h-16 border-r border-slate-50">{renderCell(new Date(selectedYear, selectedMonth, d), room)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm sticky top-20 z-30">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
          <button onClick={() => setViewMode('timeline')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'timeline' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Sơ đồ</button>
          <button onClick={() => setViewMode('month')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Tháng</button>
          <button onClick={() => setViewMode('config')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'config' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Đồng bộ 2 chiều</button>
        </div>
        <div className="flex items-center gap-4">
           {viewMode !== 'config' && (
             <div className="flex items-center gap-2">
               <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-slate-100 p-2 rounded-xl text-[10px] font-black uppercase text-slate-600 outline-none">
                 {months.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
               </select>
               <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-2xl border border-slate-200">
                 <button onClick={() => setSelectedYear(y => y - 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400"><i className="fas fa-chevron-left text-[10px]"></i></button>
                 <span className="text-[11px] font-black text-slate-800 px-2">{selectedYear}</span>
                 <button onClick={() => setSelectedYear(y => y + 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400"><i className="fas fa-chevron-right text-[10px]"></i></button>
               </div>
             </div>
           )}
        </div>
      </div>

      {viewMode === 'timeline' && renderTimeline()}
      {viewMode === 'config' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-12 animate-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black">1</div>
              <h4 className="font-black text-slate-800 uppercase text-sm">Hướng dẫn khóa phòng trên Booking.com</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                <i className="fas fa-download text-indigo-600 text-xl"></i>
                <h5 className="font-black text-[10px] uppercase">Bước 1: Tải lịch</h5>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Bấm vào nút "Tải file .ics" của từng phòng bên dưới để lưu lịch từ App về máy tính.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                <p>
  Chuột phải vào file trên Drive &gt; Chia sẻ &gt; Bất kỳ ai có đường liên kết
</p>

                <h5 className="font-black text-[10px] uppercase">Bước 2: Upload lên Drive</h5>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Tải file vừa tải lên Google Drive, chuột phải chọn "Chia sẻ" -> "Bất kỳ ai có link". Sau đó dán link vào công cụ Sửa Link bên dưới.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                <i className="fas fa-link text-blue-600 text-xl"></i>
                <h5 className="font-black text-[10px] uppercase">Bước 3: Dán vào Booking</h5>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Lấy link đã sửa dán vào phần "Import Calendar" trên Booking.com Extranet. Booking sẽ tự động đọc lịch này để khóa phòng.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {roomList.map(room => (
              <button key={room} onClick={() => downloadICalFile(room)} className="p-6 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-center group">
                <i className="fas fa-file-export text-slate-300 group-hover:text-blue-600 mb-3 text-xl transition-colors"></i>
                <div className="font-black text-slate-800 uppercase text-[10px]">Tải file .ics</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Phòng {room}</div>
              </button>
            ))}
          </div>

          <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100 space-y-4">
            <h4 className="font-black text-amber-800 uppercase text-xs">Sửa link Google Drive (Lấy link trực tiếp cho Booking.com)</h4>
            <div className="flex gap-2">
              <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Dán link Drive đã chia sẻ tại đây..." className="flex-1 p-4 bg-white border border-amber-200 rounded-2xl text-[10px] outline-none" />
              <button onClick={() => {
                const match = driveUrl.match(/\/d\/(.+?)\/(view|edit|usp)/);
                if (match && match[1]) setConvertedUrl(`https://drive.google.com/uc?export=download&id=${match[1]}`);
                else alert("Link Drive không đúng định dạng chia sẻ");
              }} className="px-6 bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase">Sửa Link</button>
            </div>
            {convertedUrl && (
              <div className="p-4 bg-white border rounded-2xl flex items-center gap-2 animate-in zoom-in-95">
                <code className="flex-1 text-[9px] font-mono break-all text-blue-600">{convertedUrl}</code>
                <button onClick={() => { navigator.clipboard.writeText(convertedUrl); alert("Đã copy link! Hãy dán link này vào phần Import trên Booking.com"); }} className="p-2 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase">Copy</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveBooking(null)}>
          <div className="bg-white w-full max-w-xs rounded-[32px] shadow-2xl p-7 space-y-5 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className={`w-12 h-12 flex items-center justify-center rounded-2xl text-white shadow-lg ${getBookingColor(activeBooking.id, activeBooking.source)}`}><i className="fas fa-user-check"></i></div>
            <h3 className="text-xl font-black text-slate-800">{activeBooking.guestName || "Khách lẻ"}</h3>
            <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center gap-3">
              <i className="far fa-calendar-alt text-blue-400"></i>
              <div className="flex flex-col"><span className="text-[8px] font-bold text-slate-400 uppercase">Phòng {activeBooking.room}</span><span className="text-[10px] font-black">{activeBooking.checkIn} → {activeBooking.checkOut}</span></div>
            </div>
            <button onClick={() => setActiveBooking(null)} className="w-full py-4 bg-slate-50 border-t border-slate-100 text-slate-400 font-black text-[10px] uppercase rounded-2xl">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
};
