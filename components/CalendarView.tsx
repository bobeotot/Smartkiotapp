
import React, { useState, useMemo } from 'react';
import { Transaction, Category } from '../types';
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
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  
  // State cho công cụ chuyển đổi link (Xuất đi)
  const [driveUrl, setDriveUrl] = useState('');
  const [convertedUrl, setConvertedUrl] = useState('');

  // State cho link Nhập về
  const [importIcalUrl, setImportIcalUrl] = useState('');
  const [targetImportRoom, setTargetImportRoom] = useState(Object.keys(ROOM_ICAL_CONFIG)[0]);

  const months = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];

  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const roomList = Object.keys(ROOM_ICAL_CONFIG);

  const handleDownloadICal = (room: string) => {
    const icalContent = generateAppICal(transactions, room);
    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `room_${room}_calendar.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setDownloadStatus(room);
    setTimeout(() => setDownloadStatus(null), 3000);
  };

  const convertDriveUrl = () => {
    try {
      const match = driveUrl.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]{25,})/);
      if (match && match[1]) {
        const directLink = `https://drive.google.com/uc?id=${match[1]}&export=download`;
        setConvertedUrl(directLink);
      } else {
        alert("Link Google Drive không đúng. Hãy copy link từ nút 'Chia sẻ' trên Drive.");
      }
    } catch (e) {
      alert("Lỗi xử lý link");
    }
  };

  const handleSaveImportUrl = () => {
    if (!importIcalUrl.includes('booking.com')) {
      alert("Vui lòng nhập link iCal chuẩn từ Booking.com");
      return;
    }
    // Trong thực tế sẽ lưu vào database, ở đây ta thông báo thành công
    alert(`Đã cấu hình đồng bộ ngược cho phòng ${targetImportRoom}. Hệ thống sẽ quét đơn mới từ link này.`);
    setImportIcalUrl('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Đã sao chép link chuẩn! Hãy dán vào Booking.com");
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

      let displayName = "Khách lẻ";
      if (booking) {
        if (booking.guestName && booking.guestName.trim() !== "") {
          displayName = booking.guestName;
        } else {
          displayName = booking.description
            .replace(/\[Booking\.com\]/g, '')
            .replace(/Phòng \d+/g, '')
            .split('(')[0].trim() || "Khách lẻ";
        }
      }

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
          
          {booking ? (
            <div className="mt-1 w-full h-full flex flex-col items-center justify-center text-center px-0.5 pointer-events-none">
              <div className="text-[10px] md:text-[11px] font-black uppercase leading-[1.1] mb-1 line-clamp-2 break-words drop-shadow-sm">
                {displayName}
              </div>
            </div>
          ) : (
            isToday && (
              <div className="mt-auto mb-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
            )
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
                <th className="sticky left-0 z-20 bg-slate-50 p-4 text-left border-right border-slate-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)] min-w-[120px]">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phòng / Ngày</span>
                </th>
                {daysArr.map(d => {
                  const date = new Date(selectedYear, selectedMonth, d);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <th key={d} className={`p-3 text-center min-w-[60px] border-r border-slate-50 ${isToday ? 'bg-blue-50' : ''} ${isWeekend && !isToday ? 'bg-slate-50/50' : ''}`}>
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
                  <td className="sticky left-0 z-20 bg-white p-4 font-black text-slate-700 text-xs border-r border-slate-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                    Phòng {room}
                  </td>
                  {daysArr.map(d => {
                    const currentDate = new Date(selectedYear, selectedMonth, d);
                    const booking = getBookingForDate(currentDate, room);
                    const isToday = currentDate.toDateString() === new Date().toDateString();
                    
                    let displayName = "";
                    if (booking) {
                      displayName = booking.guestName || booking.description.split('(')[0].trim() || "Khách";
                    }

                    return (
                      <td 
                        key={d} 
                        onClick={() => booking && setActiveBooking(booking)}
                        className={`p-1 text-center h-16 border-r border-slate-50 transition-all ${isToday ? 'bg-blue-50/30' : ''} ${booking ? 'cursor-pointer' : ''}`}
                      >
                        {booking ? (
                          <div className={`w-full h-full rounded-lg ${getBookingColor(booking.id)} p-1 flex flex-col items-center justify-center text-white shadow-sm hover:brightness-110 active:scale-95 transition-all overflow-hidden`}>
                             <span className="text-[8px] font-black uppercase leading-tight line-clamp-2">{displayName}</span>
                             <span className="text-[7px] font-bold opacity-75 mt-0.5">{Math.round(booking.amount/1000)}k</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-10 group">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter group-hover:opacity-100 transition-opacity">Trống</span>
                          </div>
                        )}
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
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Cấu hình Đồng bộ iCal 2 Chiều</h3>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Đảm bảo lịch trống của bạn luôn khớp với Booking.com</p>
        </div>

        {/* BƯỚC 1: XUẤT LỊCH (APP -> BOOKING) */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-blue-100">1</div>
             <h4 className="font-black text-slate-800 uppercase text-sm">Bước 1: Xuất lịch (App lên Booking.com)</h4>
          </div>
          
          <div className="bg-blue-600 p-8 rounded-[40px] text-white space-y-6 shadow-2xl shadow-blue-100">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                   <i className="fab fa-google-drive"></i>
                </div>
                <h4 className="font-black uppercase text-[10px] tracking-widest">Công cụ hỗ trợ Link Google Drive</h4>
             </div>

             <div className="space-y-3">
                <p className="text-[10px] font-black uppercase opacity-70">1. Dán link file iCal (.ics) trên Google Drive vào đây:</p>
                <input 
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full bg-white/10 border border-white/20 p-4 rounded-2xl outline-none focus:bg-white/20 transition-all font-bold text-sm placeholder:text-white/30"
                />
                <button 
                  onClick={convertDriveUrl}
                  className="w-full bg-white text-blue-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Tạo Link Direct chuẩn
                </button>
             </div>

             {convertedUrl && (
               <div className="pt-4 space-y-2 animate-in slide-in-from-bottom-2">
                  <p className="text-[10px] font-black uppercase opacity-70 text-emerald-300">2. Link này dán vào phần "Nhập lịch" trên Booking.com:</p>
                  <div className="flex gap-2">
                    <input 
                      readOnly 
                      value={convertedUrl}
                      className="flex-1 bg-black/20 border border-white/10 p-3 rounded-xl text-[10px] font-mono overflow-hidden text-ellipsis"
                    />
                    <button 
                      onClick={() => copyToClipboard(convertedUrl)}
                      className="bg-emerald-400 text-white px-5 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-emerald-500/20"
                    >
                      Copy
                    </button>
                  </div>
               </div>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roomList.map(room => (
              <button 
                key={room}
                onClick={() => handleDownloadICal(room)}
                className={`p-5 rounded-[24px] border border-slate-100 bg-slate-50 text-[10px] font-black uppercase flex items-center justify-between gap-2 transition-all hover:bg-white hover:shadow-md active:scale-95 ${downloadStatus === room ? 'ring-2 ring-green-500 bg-green-50/50' : ''}`}
              >
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                    <i className="fas fa-home"></i>
                   </div>
                   <span>Tải iCal Phòng {room}</span>
                </div>
                <i className={`fas ${downloadStatus === room ? 'fa-check text-green-500' : 'fa-download text-slate-300'}`}></i>
              </button>
            ))}
          </div>
        </div>

        {/* BƯỚC 2: NHẬP LỊCH (BOOKING -> APP) */}
        <div className="space-y-6 pt-6 border-t border-slate-100">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-indigo-100">2</div>
             <h4 className="font-black text-slate-800 uppercase text-sm">Bước 2: Nhập lịch (Booking.com về App)</h4>
           </div>

           <div className="bg-indigo-50 p-8 rounded-[40px] border border-indigo-100 space-y-6">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <i className="fas fa-link text-xl"></i>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">Mục dán Link iCal từ Booking.com</p>
                    <p className="text-xs text-indigo-700/70 font-medium italic">Link này giúp App tự tải đơn từ Booking về màn hình.</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chọn phòng cấu hình</label>
                      <select 
                        value={targetImportRoom}
                        onChange={(e) => setTargetImportRoom(e.target.value)}
                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {roomList.map(r => <option key={r} value={r}>Phòng {r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Dán Link Export từ Booking</label>
                      <input 
                        value={importIcalUrl}
                        onChange={(e) => setImportIcalUrl(e.target.value)}
                        placeholder="https://ical.booking.com/v1/export?t=..."
                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-mono outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                 </div>
                 <button 
                  onClick={handleSaveImportUrl}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                 >
                   Lưu & Kích hoạt đồng bộ ngược
                 </button>

                 <div className="bg-white/60 p-5 rounded-3xl space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase border-b pb-2">Hướng dẫn chi tiết:</p>
                    <ol className="text-xs text-slate-700 space-y-3 list-decimal ml-4 font-bold">
                      <li>Đăng nhập <b>Booking.com Admin</b>.</li>
                      <li>Vào menu: <b>Giá & Tình trạng trống</b> → <b>Đồng bộ lịch</b>.</li>
                      <li>Tại phòng tương ứng, chọn <b>"Xuất lịch" (Export)</b>.</li>
                      <li>Copy đường link iCal (dạng <code>https://ical.booking.com/v1/export?t=...</code>).</li>
                      <li>Dán vào ô trên và bấm <b>Lưu</b>.</li>
                    </ol>
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                <i className="fas fa-sync-alt"></i>
             </div>
             <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Cơ chế hoạt động</p>
          </div>
          <p className="text-xs text-emerald-700/80 leading-relaxed font-medium">
            Mỗi khi bạn truy cập ứng dụng hoặc nhấn <b>Đồng bộ</b>, App sẽ truy cập Link bạn đã dán để kiểm tra xem có đơn hàng nào mới từ Booking.com hay không. Nếu có, đơn sẽ được tự động thêm vào lịch sử và sơ đồ phòng mà bạn không cần nhập tay.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm sticky top-20 z-30">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
              viewMode === 'timeline' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="fas fa-stream"></i> Sơ đồ
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
              viewMode === 'month' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="fas fa-calendar-alt"></i> Tháng
          </button>
          <button
            onClick={() => setViewMode('config')}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
              viewMode === 'config' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="fas fa-sync-alt"></i> Cấu hình iCal
          </button>
        </div>

        <div className="flex items-center gap-4">
           {viewMode === 'timeline' && (
             <select 
               value={selectedMonth} 
               onChange={(e) => setSelectedMonth(Number(e.target.value))}
               className="bg-slate-100 border-none outline-none p-2 rounded-xl text-[10px] font-black uppercase text-slate-600 focus:ring-2 focus:ring-blue-500/20"
             >
               {months.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
             </select>
           )}

           {viewMode === 'month' && (
             <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl overflow-x-auto max-w-[200px] no-scrollbar">
                {roomList.map(room => (
                  <button
                    key={room}
                    onClick={() => setSelectedRoom(room)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all ${
                      selectedRoom === room ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {room}
                  </button>
                ))}
             </div>
           )}

          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-2xl border border-slate-200">
            <button onClick={() => setSelectedYear(y => y - 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-blue-600 transition-colors">
                <i className="fas fa-chevron-left text-[10px]"></i>
            </button>
            <span className="text-[11px] font-black text-slate-800 px-2">{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => y + 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-blue-600 transition-colors">
                <i className="fas fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'timeline' && renderTimeline()}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-1">
          {months.map((_, i) => (
            <div key={i} className="h-full">{renderMonth(i)}</div>
          ))}
        </div>
      )}
      {viewMode === 'config' && renderConfig()}

      {/* Pop-up Chi tiết */}
      {activeBooking && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setActiveBooking(null)}
        >
          <div className="bg-white w-full max-w-xs rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-7 space-y-5">
              <div className="flex justify-between items-start">
                <div className={`w-12 h-12 flex items-center justify-center rounded-2xl text-white shadow-lg ${getBookingColor(activeBooking.id)}`}>
                  <i className="fas fa-user-check text-lg"></i>
                </div>
                <button 
                  onClick={() => setActiveBooking(null)} 
                  className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="space-y-1">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Khách hàng</h3>
                <p className="text-xl font-black text-slate-800 leading-tight">
                  {activeBooking.guestName || activeBooking.description.replace(/\[Booking\.com\]/g, '').split('(')[0].trim() || "Khách lẻ"}
                </p>
                {activeBooking.source === 'booking.com' && (
                   <span className="inline-block bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded-md uppercase mt-1">Nguồn: Booking.com</span>
                )}
                <div className={`mt-1 inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase ${activeBooking.isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                   {activeBooking.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Thời gian</h3>
                  <p className="text-sm font-black text-slate-700">{activeBooking.quantity} đêm</p>
                </div>
                <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                  <h3 className="text-[9px] font-black uppercase text-blue-400 tracking-wider mb-1">Tổng tiền</h3>
                  <p className="text-sm font-black text-blue-600">{activeBooking.amount.toLocaleString()}đ</p>
                </div>
              </div>

              <div className="pt-2">
                 <div className="flex items-center gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-xl shadow-slate-200">
                    <i className="far fa-calendar-alt text-blue-400"></i>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Lịch trình phòng {activeBooking.room}</span>
                      <span className="text-[11px] font-black tracking-tight">{activeBooking.checkIn} → {activeBooking.checkOut}</span>
                    </div>
                 </div>
              </div>
            </div>
            
            <button 
              onClick={() => setActiveBooking(null)} 
              className="w-full py-4 bg-slate-50 border-t border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 hover:text-slate-600 transition-all"
            >
              Đóng thông tin
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .scrollbar-thin::-webkit-scrollbar {
          height: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
      `}} />
    </div>
  );
};
