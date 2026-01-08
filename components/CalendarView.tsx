
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Category, RoomConfig } from '../types';
import { ROOM_ICAL_CONFIG } from '../constants';
import { generateAppICal } from '../services/bookingService';

interface CalendarViewProps {
  transactions: Transaction[];
}

const BOOKING_COLORS = [
  'bg-red-500',
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-pink-500',
  'bg-blue-600',
  'bg-violet-500',
  'bg-rose-500',
  'bg-teal-600'
];

type CalendarSubView = 'month' | 'timeline' | 'config';

export const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<CalendarSubView>('timeline');
  const [selectedRoom, setSelectedRoom] = useState<string>(Object.keys(ROOM_ICAL_CONFIG)[0]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [activeBooking, setActiveBooking] = useState<Transaction | null>(null);
  
  // State cho cấu hình phòng (Lưu vĩnh viễn)
  const [localConfigs, setLocalConfigs] = useState<Record<string, RoomConfig>>(() => {
    const saved = localStorage.getItem('smart_kiot_room_configs');
    return saved ? JSON.parse(saved) : ROOM_ICAL_CONFIG;
  });

  // State cho link Nhập về từ Booking.com
  const [importIcalUrl, setImportIcalUrl] = useState('');
  const [targetImportRoom, setTargetImportRoom] = useState(Object.keys(ROOM_ICAL_CONFIG)[0]);

  // State cho công cụ chuyển đổi link Google Drive
  const [driveUrl, setDriveUrl] = useState('');
  const [convertedUrl, setConvertedUrl] = useState('');

  const months = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];

  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const roomList = Object.keys(ROOM_ICAL_CONFIG);

  const downloadICalFile = (room: string) => {
    const content = generateAppICal(transactions, room);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `room_${room}_calendar.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConvertDriveLink = () => {
    const match = driveUrl.match(/\/d\/(.+?)\/(view|edit|usp)/);
    if (match && match[1]) {
      const directLink = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      setConvertedUrl(directLink);
    } else {
      alert("Link Google Drive không đúng định dạng. Vui lòng dán link 'Chia sẻ' từ Google Drive.");
    }
  };

  const handleCopyConverted = () => {
    navigator.clipboard.writeText(convertedUrl);
    alert("Đã copy link trực tiếp! Hãy dán link này vào Booking.com.");
  };

  const handleSaveImportUrl = () => {
    if (!importIcalUrl.startsWith('http')) {
      alert("Vui lòng dán link Export hợp lệ");
      return;
    }
    
    const updated = {
      ...localConfigs,
      [targetImportRoom]: {
        ...localConfigs[targetImportRoom],
        icalUrl: importIcalUrl
      }
    };
    
    setLocalConfigs(updated);
    localStorage.setItem('smart_kiot_room_configs', JSON.stringify(updated));
    
    alert(`Đã lưu cấu hình phòng ${targetImportRoom}. Nhấn nút 'Đồng bộ' ở Header để tải đơn hàng mới.`);
    setImportIcalUrl('');
  };

  const getBookingColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % BOOKING_COLORS.length;
    return BOOKING_COLORS[index];
  };

  const getBookingForDate = (date: Date, room: string) => {
    return transactions.find(t => {
      if (t.category !== Category.HOMESTAY || t.room !== room) return false;
      if (!t.checkIn || !t.checkOut) return false;
      
      const start = new Date(t.checkIn);
      const end = new Date(t.checkOut);
      const current = new Date(date);
      
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      current.setHours(0,0,0,0);

      return current >= start && current < end;
    });
  };

  const renderMonth = (monthIdx: number) => {
    const firstDayOfMonth = new Date(selectedYear, monthIdx, 1);
    const lastDayOfMonth = new Date(selectedYear, monthIdx + 1, 0);
    
    let startDay = firstDayOfMonth.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square md:aspect-auto md:h-20 border border-transparent"></div>);
    }

    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      const currentDate = new Date(selectedYear, monthIdx, d);
      const booking = getBookingForDate(currentDate, selectedRoom);
      const isToday = currentDate.toDateString() === new Date().toDateString();

      days.push(
        <div 
          key={d} 
          onClick={() => booking && setActiveBooking(booking)}
          className={`relative aspect-square md:aspect-auto md:h-20 flex flex-col items-center justify-start p-1 border rounded-lg transition-all overflow-hidden shadow-sm cursor-pointer ${
            booking 
              ? `${getBookingColor(booking.id)} text-white border-transparent hover:brightness-110 active:scale-95` 
              : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
          } ${isToday ? 'ring-2 ring-blue-500 z-10' : ''}`}
        >
          <span className={`absolute top-0.5 right-1 text-[10px] font-black leading-none ${booking ? 'text-white/60' : 'text-slate-300'}`}>
            {d}
          </span>
          {booking && (
            <div className="mt-1 w-full h-full flex items-center justify-center text-center px-0.5 pointer-events-none">
              <div className="text-[10px] md:text-[11px] font-black uppercase leading-[1.1] line-clamp-2">
                {booking.guestName || "Khách lẻ"}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
        <h4 className="text-[11px] font-black uppercase text-slate-800 mb-4 text-center tracking-widest border-b border-slate-50 pb-2">
            {months[monthIdx]}
        </h4>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek.map(d => (
            <div key={d} className="text-[9px] text-slate-400 font-black text-center uppercase">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {days}
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-500">
        <div className="overflow-x-auto overflow-y-visible scrollbar-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="sticky left-0 z-20 bg-slate-50 p-4 text-left border-right border-slate-100 min-w-[120px]">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phòng / Ngày</span>
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
                  <td className="sticky left-0 z-20 bg-white p-4 font-black text-slate-700 text-xs border-r border-slate-100">
                    Phòng {room}
                  </td>
                  {daysArr.map(d => {
                    const currentDate = new Date(selectedYear, selectedMonth, d);
                    const booking = getBookingForDate(currentDate, room);
                    return (
                      <td key={d} onClick={() => booking && setActiveBooking(booking)} className="p-1 text-center h-16 border-r border-slate-50">
                        {booking ? (
                          <div className={`w-full h-full rounded-lg ${getBookingColor(booking.id)} p-1 flex flex-col items-center justify-center text-white shadow-sm hover:brightness-110 active:scale-95 transition-all overflow-hidden cursor-pointer`}>
                             <span className="text-[8px] font-black uppercase leading-tight line-clamp-1">{booking.guestName || "Khách"}</span>
                             <span className="text-[7px] font-bold opacity-75">{Math.round(booking.amount/1000)}k</span>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderConfig = () => {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2 border-b pb-4">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Đồng bộ lịch Booking.com</h3>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Sử dụng Google Drive để lưu lịch</p>
        </div>

        {/* CÔNG CỤ CHUYỂN ĐỔI LINK GOOGLE DRIVE */}
        <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100 space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-amber-100"><i className="fab fa-google-drive"></i></div>
             <h4 className="font-black text-amber-800 uppercase text-xs">Công cụ sửa link Google Drive (Lấy Link Trực Tiếp)</h4>
          </div>
          <div className="space-y-3">
            <p className="text-[9px] font-bold text-amber-600 uppercase">Dán link "Chia sẻ" từ Drive vào đây để lấy link chuẩn cho Booking.com:</p>
            <div className="flex gap-2">
              <input 
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="Dán link Drive vào đây..."
                className="flex-1 p-4 bg-white border border-amber-200 rounded-2xl text-[10px] outline-none"
              />
              <button 
                onClick={handleConvertDriveLink}
                className="px-6 bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all"
              >
                Sửa Link
              </button>
            </div>
            {convertedUrl && (
              <div className="p-4 bg-white border border-amber-200 rounded-2xl space-y-2 animate-in zoom-in-95 duration-200">
                <p className="text-[9px] font-black text-slate-400 uppercase">Link trực tiếp (Dùng link này cho Booking.com):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-slate-50 rounded text-[9px] break-all text-blue-600 font-mono">{convertedUrl}</code>
                  <button onClick={handleCopyConverted} className="p-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase">Copy</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* XUẤT LỊCH (APP -> DRIVE -> BOOKING) */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-blue-100">1</div>
             <h4 className="font-black text-slate-800 uppercase text-sm">Xuất lịch từ App lên Google Drive</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {roomList.map(room => (
              <div key={room} className="space-y-2">
                <button 
                  onClick={() => downloadICalFile(room)}
                  className="w-full group p-6 rounded-[32px] border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-center space-y-3"
                >
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center mx-auto transition-all text-slate-400">
                    <i className="fas fa-file-download text-sm"></i>
                  </div>
                  <div>
                    <div className="font-black text-slate-800 uppercase text-[10px]">Tải file .ics</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Phòng {room}</div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* NHẬP LỊCH (BOOKING -> APP) */}
        <div className="space-y-6 pt-6 border-t border-slate-100">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-indigo-100">2</div>
             <h4 className="font-black text-slate-800 uppercase text-sm">Nhập lịch từ Booking.com về App</h4>
           </div>

           <div className="bg-indigo-50 p-8 rounded-[40px] border border-indigo-100 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chọn phòng cấu hình</label>
                  <select 
                    value={targetImportRoom}
                    onChange={(e) => {
                      setTargetImportRoom(e.target.value);
                      setImportIcalUrl(localConfigs[e.target.value]?.icalUrl || '');
                    }}
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black outline-none"
                  >
                    {roomList.map(r => <option key={r} value={r}>Phòng {r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Link Export hiện tại</label>
                  <input 
                    value={importIcalUrl}
                    onChange={(e) => setImportIcalUrl(e.target.value)}
                    placeholder="Dán link iCal từ Booking..."
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-mono outline-none"
                  />
                </div>
              </div>
              <button 
                onClick={handleSaveImportUrl}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all"
              >
                Lưu Link & Cấu Hình
              </button>
           </div>
           
           <div className="p-6 border rounded-3xl bg-slate-50 border-slate-200 space-y-3">
              <p className="text-[10px] font-black text-slate-500 uppercase">Trạng thái Link đã lưu:</p>
              <div className="space-y-2">
                {roomList.map(room => (
                  <div key={room} className="flex justify-between items-center text-[9px] font-bold">
                    <span className="text-slate-400 uppercase">Phòng {room}:</span>
                    <span className={localConfigs[room]?.icalUrl ? 'text-emerald-600' : 'text-red-400'}>
                      {localConfigs[room]?.icalUrl ? 'ĐÃ CÓ LINK' : 'CHƯA CÓ LINK'}
                    </span>
                  </div>
                ))}
              </div>
           </div>
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
           {viewMode === 'timeline' && (
             <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-slate-100 p-2 rounded-xl text-[10px] font-black uppercase text-slate-600 outline-none">
               {months.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
             </select>
           )}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-2xl border border-slate-200">
            <button onClick={() => setSelectedYear(y => y - 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-blue-600 transition-colors"><i className="fas fa-chevron-left text-[10px]"></i></button>
            <span className="text-[11px] font-black text-slate-800 px-2">{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => y + 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-blue-600 transition-colors"><i className="fas fa-chevron-right text-[10px]"></i></button>
          </div>
        </div>
      </div>

      {viewMode === 'timeline' && renderTimeline()}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {months.map((_, i) => <div key={i}>{renderMonth(i)}</div>)}
        </div>
      )}
      {viewMode === 'config' && renderConfig()}

      {activeBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setActiveBooking(null)}>
          <div className="bg-white w-full max-w-xs rounded-[32px] shadow-2xl overflow-hidden p-7 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between">
              <div className={`w-12 h-12 flex items-center justify-center rounded-2xl text-white shadow-lg ${getBookingColor(activeBooking.id)}`}><i className="fas fa-user-check"></i></div>
              <button onClick={() => setActiveBooking(null)} className="text-slate-300"><i className="fas fa-times"></i></button>
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Khách hàng</h3>
              <p className="text-xl font-black text-slate-800">{activeBooking.guestName || "Khách lẻ"}</p>
              <div className={`mt-1 inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase ${activeBooking.isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{activeBooking.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}</div>
            </div>
            <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center gap-3">
              <i className="far fa-calendar-alt text-blue-400"></i>
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Phòng {activeBooking.room}</span>
                <span className="text-[10px] font-black">{activeBooking.checkIn} → {activeBooking.checkOut}</span>
              </div>
            </div>
            <button onClick={() => setActiveBooking(null)} className="w-full py-4 bg-slate-50 border-t border-slate-100 text-slate-400 font-black text-[10px] uppercase">Đóng</button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-thin::-webkit-scrollbar { height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}} />
    </div>
  );
};
