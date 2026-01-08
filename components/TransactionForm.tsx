
import React, { useState, useEffect, useMemo } from 'react';
import { Category, Transaction } from '../types';
import { CATEGORY_CONFIG, ROOM_ICAL_CONFIG, ROOM_DEPENDENCIES } from '../constants';

interface TransactionFormProps {
  transactions: Transaction[];
  onAdd: (transaction: Transaction, shouldPrint?: boolean) => void;
  onClose: () => void;
}

type LaundryType = 'CLOTHES' | 'BEDDING' | 'SHOES';
type ShoeMaterial = 'LEATHER' | 'FABRIC';
type BikeType = 'FULL' | 'HALF';
type FoodPackage = 'SINGLE' | 'WEEK' | 'MONTH';

export const TransactionForm: React.FC<TransactionFormProps> = ({ transactions, onAdd, onClose }) => {
  const [category, setCategory] = useState<Category>(Category.HOMESTAY);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestAddress, setGuestAddress] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toLocaleDateString('sv-SE'));
  
  // Laundry states
  const [laundryType, setLaundryType] = useState<LaundryType>('CLOTHES');
  const [shoeMaterial, setShoeMaterial] = useState<ShoeMaterial>('FABRIC');
  const [isDryOnly, setIsDryOnly] = useState(false);
  const [isSeparateWash, setIsSeparateWash] = useState(false);
  const [isThickBedding, setIsThickBedding] = useState(false);

  // Bike states
  const [bikeType, setBikeType] = useState<BikeType>('FULL');

  // Food states
  const [foodPackage, setFoodPackage] = useState<FoodPackage>('SINGLE');

  // Homestay states
  const [selectedRoom, setSelectedRoom] = useState<string>('101');
  const [checkInDate, setCheckInDate] = useState<string>(new Date().toLocaleDateString('sv-SE'));
  const [checkOutDate, setCheckOutDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('sv-SE');
  });

  const conflictInfo = useMemo(() => {
    if (category !== Category.HOMESTAY) return null;
    const newStart = new Date(checkInDate);
    const newEnd = new Date(checkOutDate);
    
    const relatedRooms = [selectedRoom];
    if (ROOM_DEPENDENCIES[selectedRoom]) {
      relatedRooms.push(...ROOM_DEPENDENCIES[selectedRoom]);
    }
    Object.entries(ROOM_DEPENDENCIES).forEach(([parent, children]) => {
      if (children.includes(selectedRoom)) {
        relatedRooms.push(parent);
      }
    });

    return transactions.find(t => {
      if (t.category !== Category.HOMESTAY || !t.room) return false;
      if (!relatedRooms.includes(t.room)) return false;
      
      let tStart: Date, tEnd: Date;
      if (t.checkIn && t.checkOut) {
        tStart = new Date(t.checkIn);
        tEnd = new Date(t.checkOut);
      } else {
        return false;
      }
      
      tStart.setHours(0,0,0,0);
      tEnd.setHours(0,0,0,0);
      newStart.setHours(0,0,0,0);
      newEnd.setHours(0,0,0,0);

      return (newStart < tEnd) && (newEnd > tStart);
    });
  }, [category, selectedRoom, checkInDate, checkOutDate, transactions]);

  useEffect(() => {
    if (isManualPrice) return;
    
    if (category === Category.LAUNDRY) {
      if (laundryType === 'CLOTHES') {
        if (isDryOnly) {
          const pricePerKg = 15000; // Giá sấy riêng
          setSubtotal(pricePerKg * quantity);
          setDescription(`Chỉ sấy quần áo (${quantity}kg)`);
        } else {
          // Giặt sấy: <= 3kg tính 45k, > 3kg tính 15k/kg
          let base = quantity <= 3 ? 45000 : 15000 * quantity;
          if (isSeparateWash) base += 20000; // Phụ phí giặt riêng
          setSubtotal(base);
          setDescription(`Giặt sấy quần áo (${quantity}kg)${isSeparateWash ? ' + Tách màu' : ''}`);
        }
      } else if (laundryType === 'BEDDING') {
        const price = isThickBedding ? 30000 : 25000;
        setSubtotal(price * quantity);
        setDescription(`Giặt sấy Chăn ga ${isThickBedding ? 'dày' : 'mỏng'} (${quantity} cái)`);
      } else if (laundryType === 'SHOES') {
        const price = shoeMaterial === 'LEATHER' ? 60000 : 50000;
        setSubtotal(price * quantity);
        setDescription(`Giặt giày Sneaker ${shoeMaterial === 'LEATHER' ? 'da' : 'vải'} (${quantity} đôi)`);
      }
    } else if (category === Category.HOMESTAY) {
      const start = new Date(checkInDate);
      const end = new Date(checkOutDate);
      const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (86400000)));
      const roomPrice = ROOM_ICAL_CONFIG[selectedRoom]?.price || 350000;
      setSubtotal(roomPrice * nights);
      setDescription(`Phòng ${selectedRoom} (${checkInDate} - ${checkOutDate})`);
      setQuantity(nights);
    } else if (category === Category.BIKE) {
      const price = bikeType === 'FULL' ? 150000 : 80000;
      setSubtotal(price * quantity);
      setDescription(`Thuê xe đạp - ${bikeType === 'FULL' ? 'Cả ngày' : 'Nửa ngày'} (x${quantity} chiếc)`);
    } else if (category === Category.FOOD) {
      let basePrice = 60000;
      let typeLabel = "Suất lẻ";
      if (foodPackage === 'WEEK') { basePrice = 400000; typeLabel = "Gói tuần"; }
      if (foodPackage === 'MONTH') { basePrice = 1500000; typeLabel = "Gói tháng"; }
      setSubtotal(basePrice * quantity);
      setDescription(`Healthy Food (${typeLabel}) x${quantity}`);
    }
  }, [category, laundryType, shoeMaterial, isDryOnly, isSeparateWash, isThickBedding, quantity, selectedRoom, checkInDate, checkOutDate, isManualPrice, bikeType, foodPackage]);

  const handleSubmit = (shouldPrint: boolean) => {
    if (conflictInfo) {
      alert("Cảnh báo: Phòng đã được đặt trong khoảng thời gian này!");
      return;
    }
    const now = new Date();
    const finalDate = new Date(transactionDate);
    finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    
    onAdd({
      id: `m-${Date.now()}`,
      category,
      amount: subtotal * (1 - discount / 100),
      originalAmount: subtotal,
      discount,
      date: finalDate.toISOString(),
      description,
      guestName: guestName.trim() || "Khách lẻ",
      guestPhone: guestPhone.trim(),
      guestAddress: guestAddress.trim(),
      quantity,
      unit: category === Category.LAUNDRY ? (laundryType === 'SHOES' ? 'đôi' : laundryType === 'BEDDING' ? 'cái' : 'kg') : (category === Category.HOMESTAY ? 'đêm' : category === Category.BIKE ? 'chiếc' : 'phần'),
      source: 'manual',
      room: category === Category.HOMESTAY ? selectedRoom : undefined,
      checkIn: category === Category.HOMESTAY ? checkInDate : undefined,
      checkOut: category === Category.HOMESTAY ? checkOutDate : undefined
    }, shouldPrint);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-800 uppercase text-sm tracking-tight">Tạo đơn hàng mới</h2>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto no-scrollbar">
          {/* Category Switcher */}
          <div className="grid grid-cols-4 gap-2">
            {Object.values(Category).map(cat => (
              <button 
                key={cat} 
                onClick={() => {
                  setCategory(cat); 
                  setIsManualPrice(false); 
                  setQuantity(1);
                }} 
                className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${category === cat ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400'}`}
              >
                <span className="text-lg">{CATEGORY_CONFIG[cat].icon}</span>
                <span className="text-[8px] font-bold uppercase mt-1">{cat}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Ngày giao dịch</label>
            <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500" />
          </div>

          {/* Homestay View */}
          {category === Category.HOMESTAY && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Chọn phòng</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(ROOM_ICAL_CONFIG).map(room => (
                    <button 
                      key={room}
                      type="button"
                      onClick={() => setSelectedRoom(room)}
                      className={`py-2 rounded-xl text-xs font-black uppercase border-2 transition-all ${selectedRoom === room ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}
                    >
                      {room}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Check-in</label>
                  <input type="date" value={checkInDate} onChange={e => setCheckInDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Check-out</label>
                  <input type="date" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Tên khách đặt</label>
                <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Tên khách hàng..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500" />
              </div>

              {conflictInfo && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600">
                  <i className="fas fa-exclamation-triangle text-xs"></i>
                  <span className="text-[10px] font-bold uppercase">Phòng đã bận trong thời gian này</span>
                </div>
              )}
            </div>
          )}

          {/* Laundry View */}
          {category === Category.LAUNDRY && (
             <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  <button onClick={() => setLaundryType('CLOTHES')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${laundryType === 'CLOTHES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Quần áo</button>
                  <button onClick={() => setLaundryType('BEDDING')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${laundryType === 'BEDDING' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Chăn ga</button>
                  <button onClick={() => setLaundryType('SHOES')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${laundryType === 'SHOES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Giày</button>
                </div>
                
                {laundryType === 'CLOTHES' && (
                  <div className="flex gap-4 p-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isDryOnly} onChange={e => setIsDryOnly(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                      <span className="text-[10px] font-bold uppercase text-slate-600">Chỉ sấy (15k)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isSeparateWash} onChange={e => setIsSeparateWash(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                      <span className="text-[10px] font-bold uppercase text-slate-600">Giặt tách màu (+20k)</span>
                    </label>
                  </div>
                )}

                {laundryType === 'BEDDING' && (
                  <label className="flex items-center gap-2 cursor-pointer p-1">
                    <input type="checkbox" checked={isThickBedding} onChange={e => setIsThickBedding(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    <span className="text-[10px] font-bold uppercase text-slate-600">Loại dày (+5k)</span>
                  </label>
                )}

                {laundryType === 'SHOES' && (
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                    <button onClick={() => setShoeMaterial('FABRIC')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${shoeMaterial === 'FABRIC' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Vải/Lưới</button>
                    <button onClick={() => setShoeMaterial('LEATHER')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${shoeMaterial === 'LEATHER' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Da/Lộn</button>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Số lượng ({laundryType === 'SHOES' ? 'đôi' : laundryType === 'BEDDING' ? 'cái' : 'kg'})</label>
                  <input type="number" step="0.1" value={quantity} onChange={e => setQuantity(Math.max(0, Number(e.target.value)))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                </div>
             </div>
          )}

          {/* Bike View */}
          {category === Category.BIKE && (
            <div className="space-y-4 animate-in fade-in duration-300">
               <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  <button onClick={() => setBikeType('FULL')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${bikeType === 'FULL' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'}`}>Cả ngày (150k)</button>
                  <button onClick={() => setBikeType('HALF')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${bikeType === 'HALF' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'}`}>Nửa ngày (80k)</button>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Số lượng xe</label>
                  <input type="number" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
                </div>
            </div>
          )}

          {/* Healthy Food View */}
          {category === Category.FOOD && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Tên khách</label>
                  <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Tên..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">SĐT</label>
                  <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="SĐT..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Địa chỉ giao hàng</label>
                <input type="text" value={guestAddress} onChange={e => setGuestAddress(e.target.value)} placeholder="Địa chỉ chi tiết..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Gói dịch vụ</label>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  <button onClick={() => setFoodPackage('SINGLE')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${foodPackage === 'SINGLE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Ngày</button>
                  <button onClick={() => setFoodPackage('WEEK')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${foodPackage === 'WEEK' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Tuần</button>
                  <button onClick={() => setFoodPackage('MONTH')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase ${foodPackage === 'MONTH' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Tháng</button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Số phần / buổi</label>
                <input type="number" value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" />
              </div>
            </div>
          )}

          {/* Pricing Section */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="bg-slate-900 p-4 rounded-xl flex justify-between items-center text-white shadow-lg">
              <div className="flex flex-col">
                <span className="text-[8px] font-black opacity-60 uppercase tracking-widest">Tổng cộng</span>
                <span className="text-[9px] italic opacity-40">{description}</span>
              </div>
              <span className="text-xl font-black text-blue-400">{(subtotal * (1 - discount/100)).toLocaleString()}đ</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button type="button" onClick={() => handleSubmit(false)} className="py-4 font-black text-[10px] rounded-2xl bg-slate-100 text-slate-800 uppercase tracking-widest">Chỉ Lưu</button>
            <button type="button" onClick={() => handleSubmit(true)} className="py-4 font-black text-[10px] rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-100 uppercase tracking-widest">Lưu & In HĐ</button>
          </div>
        </div>
      </div>
    </div>
  );
};
