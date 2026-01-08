
import React, { useState, useEffect } from 'react';
import { Transaction, Category, RoomConfig } from '../types';
import { ROOM_ICAL_CONFIG } from '../constants';
import { generateAppICal } from '../services/bookingService';

interface CalendarViewProps {
  transactions: Transaction[];
}

const BOOKING_COLORS = [
  'bg-indigo-600', 'bg-blue-600', 'bg-emerald-600', 'bg-rose-500', 'bg-amber-500', 'bg-violet-500'
];

type CalendarSubView = 'month' | 'timeline' | 'config';

export const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<CalendarSubView>('timeline');
  const [selectedRoom, setSelectedRoom] = useState<string>(Object.keys(ROOM_ICAL_CONFIG)[0]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [activeBooking, setActiveBooking] = useState<Transaction | null>(null);
  
  // Quản lý cấu hình phòng trong localStorage
  const [roomConfigs, setRoomConfigs] = useState<Record<string, RoomConfig>>(() => {
    const saved = localStorage.getItem('smart_kiot_room_configs');
    return saved ? JSON.parse(saved) : ROOM_ICAL_CONFIG;
  });

  const [driveUrl, setDriveUrl] = useState('');
  const [convertedUrl, setConvertedUrl] = useState('');

  const months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const roomList = Object.keys(roomConfigs);

  const saveConfigs = (newConfigs: Record<string, RoomConfig>) => {
    setRoomConfigs(newConfigs);
    localStorage.setItem('smart_kiot_room_configs', JSON.stringify(newConfigs));
  };

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

  const renderCell = (date: Date, room: string, isMonthView: boolean = false) => {
    const bookings = getBookingsForDate(date, room);
    if (bookings.length === 0) return null;
    const mainBooking = bookings[0];
    const hasConflict = bookings.length > 1;
    const isBookingCom = mainBooking.source === 'booking.com';
    
    return (
      <div 
        onClick={(e) => { e.stopPropagation(); setActiveBooking(mainBooking); }} 
        className={`w-full h-full rounded-lg ${getBookingColor(mainBooking.id, mainBooking.source)} p-1 flex flex-col items-center justify-center text-white shadow-sm hover:brightness-110 active:scale-95 transition-all overflow-hidden cursor-pointer relative`}
      >
        {isBookingCom && <div className="absolute top-0.5 left-0.5 bg-white text-blue-700 rounded-full w-2.5 h-2.5 flex items-center justify-center text-[5px] font-black shadow-sm">B</div>}
        {hasConflict && <div className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-2.5 h-2.5 flex items-center justify-center text-[5px] font-black animate-pulse">!</div>}
        <span className={`font-black uppercase leading-tight line-clamp-1 ${isMonthView ? 'text-[7px]' : 'text-[8px]'}`}>
          {mainBooking.guestName || "Khách"}
        </span>
      </div>
    );
  };

  const renderMonth = () => {
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const emptyDays = firstDay === 0 ? 6 : firstDay - 1;
    const calendarDays = Array.from({ length: emptyDays + daysInMonth }, (_, i) => i < emptyDays ? null : i - emptyDays + 1);

    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <div className="flex bg-white p-2 rounded-2xl border border-slate-200 w-fit mx-auto mb-4 overflow-x-auto max-w-full no-scrollbar">
          {roomList.map(room => (
            <button key={room} onClick={() => setSelectedRoom(room)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${selectedRoom === room ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>Phòng {room}</button>
          ))}
        </div>
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {daysOfWeek.map(day => (<div key={day} className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="h-24 bg-slate-50/30 border-r border-b border-slate-50"></div>;
              const date = new Date(selectedYear, selectedMonth, day);
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div key={day} className={`h-24 border-r border-b border-slate-100 p-1 relative flex flex-col gap-1 ${isToday ? 'bg-blue-50/50' : ''}`}>
                  <span className={`text-[10px] font-black ml-1 mt-1 ${isToday ? 'text-blue-600' : 'text-slate-300'}`}>{day}</span>
                  <div className="flex-1 overflow-hidden">{renderCell(date, selectedRoom, true)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return (
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-500">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="sticky left-0 z-20 bg-slate-50 p-4 text-left border-r border-slate-100 min-w-[100px]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phòng</span>
                </th>
                {daysArr.map(d => {
                  const date = new Date(selectedYear, selectedMonth, d);
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <th key={d} className={`p-3 text-center min-w-[60px] border-r border-slate-50 ${isToday ? 'bg-blue-50' : ''}`}>
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
                  {daysArr.map(d => (<td key={d} className="p-1 text-center h-14 border-r border-slate-50">{renderCell(new Date(selectedYear, selectedMonth, d), room)}</td>))}
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

      {viewMode === 'timeline' && renderTimeline()}
      {viewMode === 'month' && renderMonth()}
      {viewMode === 'config' && (
        <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl p-8 space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-6">
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest border-l-4 border-indigo-600 pl-4">Cấu hình Link iCal Booking.com</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase text-left border-b border-slate-100">
                    <th className="p-4">Phòng</th>
                    <th className="p-4">Link iCal (Dán link Booking tại đây)</th>
                    <th className="p-4">Giá phòng (VNĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {/* Fixed typing issue by explicitly casting Object.entries to resolve 'unknown' error */}
                  {(Object.entries(roomConfigs) as [string, RoomConfig][]).map(([room, config]) => (
                    <tr key={room}>
                      <td className="p-4 font-black text-slate-700 text-xs">Phòng {room}</td>
                      <td className="p-4">
                        <input 
                          type="text" 
                          value={config.icalUrl} 
                          onChange={(e) => {
                            const newConfigs = { ...roomConfigs, [room]: { ...config, icalUrl: e.target.value } };
                            saveConfigs(newConfigs);
                          }}
                          placeholder="Dán link iCal từ Booking.com..." 
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="p-4">
                        <input 
                          type="number" 
                          value={config.price} 
                          onChange={(e) => {
                            const newConfigs = { ...roomConfigs, [room]: { ...config, price: Number(e.target.value) } };
                            saveConfigs(newConfigs);
                          }}
                          className="w-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black outline-none focus:border-indigo-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] text-red-500 font-bold italic">* Sau khi dán link, hãy ra Dashboard bấm "ĐỒNG BỘ NGAY" để tải lịch mới.</p>
          </div>

          <div className="space-y-6 pt-10 border-t border-slate-100">
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest border-l-4 border-blue-600 pl-4">Hướng dẫn khóa phòng tự động</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                <i className="fas fa-download text-blue-600 text-xl"></i>
                <h5 className="font-black text-[10px] uppercase">Bước 1: Tải file lịch</h5>
                <div className="flex flex-wrap gap-2 pt-2">
                  {roomList.map(r => (
                    <button key={r} onClick={() => downloadICalFile(r)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[8px] font-black uppercase hover:bg-blue-50 hover:text-blue-600 transition-all">P.{r}</button>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                <i className="fab fa-google-drive text-emerald-600 text-xl"></i>
                <h5 className="font-black text-[10px] uppercase">Bước 2: Sửa Link Drive</h5>
                <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Dán link Drive chia sẻ..." className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[9px] outline-none" />
                <button onClick={() => {
                  const match = driveUrl.match(/\/d\/(.+?)\/(view|edit|usp)/);
                  if (match && match[1]) setConvertedUrl(`https://drive.google.com/uc?export=download&id=${match[1]}`);
                  else alert("Link Drive không đúng định dạng!");
                }} className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase">Chuyển đổi</button>
              </div>
              {convertedUrl && (
                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 space-y-3 animate-in zoom-in-95">
                  <h5 className="font-black text-[10px] uppercase text-blue-700">Bước 3: Dán vào Booking</h5>
                  <code className="block p-3 bg-white rounded-lg text-[8px] break-all font-mono font-bold text-blue-600">{convertedUrl}</code>
                  <button onClick={() => { navigator.clipboard.writeText(convertedUrl); alert("Đã copy!"); }} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase">Sao chép Link</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveBooking(null)}>
          <div className="bg-white w-full max-w-xs rounded-[40px] shadow-2xl p-7 space-y-5 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className={`w-14 h-14 flex items-center justify-center rounded-[20px] text-white shadow-lg text-xl ${getBookingColor(activeBooking.id, activeBooking.source)}`}><i className="fas fa-user-check"></i></div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thông tin đặt phòng</span>
              <h3 className="text-xl font-black text-slate-800">{activeBooking.guestName || "Khách lẻ"}</h3>
            </div>
            <div className="bg-slate-900 text-white p-5 rounded-[24px] space-y-3">
              <div className="flex items-center gap-3">
                <i className="far fa-calendar-alt text-blue-400"></i>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-slate-500 uppercase">Ngày nhận & trả</span>
                  <span className="text-[10px] font-black">{activeBooking.checkIn} → {activeBooking.checkOut}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <i className="fas fa-door-open text-emerald-400"></i>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-slate-500 uppercase">Số phòng</span>
                  <span className="text-[10px] font-black">Phòng {activeBooking.room}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setActiveBooking(null)} className="w-full py-4 bg-slate-50 text-slate-400 font-black text-[10px] uppercase rounded-2xl hover:bg-slate-100 transition-colors">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
};
