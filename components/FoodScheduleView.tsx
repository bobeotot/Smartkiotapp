
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Category, FoodDayMetadata } from '../types';
import { dbService } from '../services/dbService';

interface MealInfo {
  txId: string;
  metaKey: string;
  mealIdx: number; 
  metadata: FoodDayMetadata;
  originalTx: Transaction;
}

interface GuestDeliveryGroup {
  guestName: string;
  guestPhone?: string;
  guestAddress?: string;
  meals: MealInfo[];
}

interface FoodScheduleViewProps {
  transactions: Transaction[];
}

// Hàm lấy ngày theo giờ địa phương YYYY-MM-DD
const getLocalDateString = (dateInput?: string | Date) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleDateString('sv-SE'); // sv-SE trả về YYYY-MM-DD
};

export const FoodScheduleView: React.FC<FoodScheduleViewProps> = ({ transactions }) => {
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [activeTab, setActiveTab] = useState<number>(0); // 0: Sáng, 1: Trưa, 2: Chiều
  
  // State quản lý danh sách món ăn dự kiến cho buổi đó (để soạn trước menu)
  const [plannedDishes, setPlannedDishes] = useState<Record<string, string[]>>({});
  const [editingMeal, setEditingMeal] = useState<{ txId: string; metaKey: string; label: string } | null>(null);
  const [editingMenuDish, setEditingMenuDish] = useState<{ oldName: string; mealIdx: number } | null>(null);
  const [tempDish, setTempDish] = useState('');

  // Tự động tổng hợp món ăn từ các giao dịch hiện có để làm gợi ý
  const existingDishesInTransactions = useMemo(() => {
    const list: string[] = [];
    transactions.forEach(t => {
      if (t.foodMetadata) {
        Object.values(t.foodMetadata).forEach((m: any) => {
          if (m.dish && !list.includes(m.dish)) list.push(m.dish);
        });
      }
    });
    return list;
  }, [transactions]);

  const dateOptions = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    
    return [
      { label: 'Hôm nay', iso: getLocalDateString(today), dow: 'T' + (today.getDay() + 1 === 1 ? 'CN' : today.getDay() + 1) },
      { label: 'Ngày mai', iso: getLocalDateString(tomorrow), dow: 'T' + (tomorrow.getDay() + 1 === 1 ? 'CN' : tomorrow.getDay() + 1) }
    ];
  }, []);

  const groupedDeliveries = useMemo(() => {
    const groups: Record<string, GuestDeliveryGroup> = {};
    const targetDate = selectedDate;

    transactions.filter(t => t.category === Category.FOOD).forEach(t => {
      // Parse ngày bắt đầu từ giao dịch
      const startDate = new Date(t.date);
      
      let days = 1;
      if (t.description.includes("Gói tuần")) days = 7;
      if (t.description.includes("Gói tháng")) days = 30;

      for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateStr = getLocalDateString(d);
        
        if (dateStr === targetDate) {
          const groupKey = `${t.guestName}-${t.guestPhone || ''}-${t.id}`;
          if (!groups[groupKey]) {
            groups[groupKey] = {
              guestName: t.guestName || "Khách lẻ",
              guestPhone: t.guestPhone,
              guestAddress: t.guestAddress,
              meals: []
            };
          }

          // Mỗi đơn hàng có thể có nhiều phần ăn (quantity)
          // Chia làm tối đa 3 buổi nếu quantity > 1
          const mealCount = Math.min(t.quantity, 3); 
          for (let q = 0; q < mealCount; q++) {
            const metaKey = `${dateStr}:${q}`;
            groups[groupKey].meals.push({
              txId: t.id,
              metaKey: metaKey,
              mealIdx: q,
              metadata: (t.foodMetadata?.[metaKey] as FoodDayMetadata) || { dish: '', delivered: false },
              originalTx: t
            });
          }
        }
      }
    });

    return Object.values(groups).sort((a, b) => a.guestName.localeCompare(b.guestName));
  }, [transactions, selectedDate]);

  // Thống kê thực đơn bao gồm cả món trong Kế hoạch và món khách đã chọn
  const menuSummary = useMemo(() => {
    const counts = [0, 0, 0];
    const dishCounts: Record<string, number>[] = [{}, {}, {}];
    const sessionKey = `${selectedDate}:${activeTab}`;
    
    // Khởi tạo các món từ kế hoạch soạn trước
    const plannedForCurrent = plannedDishes[sessionKey] || [];
    plannedForCurrent.forEach(d => {
      dishCounts[activeTab][d] = 0;
    });

    // Cộng dồn từ khách hàng thực tế
    groupedDeliveries.forEach(group => {
      group.meals.forEach(m => {
        counts[m.mealIdx]++;
        if (m.mealIdx === activeTab) {
          const dishName = (m.metadata.dish || 'CHƯA CHỌN MÓN').trim().toUpperCase();
          dishCounts[m.mealIdx][dishName] = (dishCounts[m.mealIdx][dishName] || 0) + 1;
        }
      });
    });

    return { counts, dishCounts: dishCounts[activeTab] };
  }, [groupedDeliveries, selectedDate, activeTab, plannedDishes]);

  const handleAddPlannedDish = (name: string) => {
    const normalized = name.trim().toUpperCase();
    if (!normalized) return;
    const sessionKey = `${selectedDate}:${activeTab}`;
    setPlannedDishes(prev => ({
      ...prev,
      [sessionKey]: [...(prev[sessionKey] || []), normalized]
    }));
    setTempDish('');
    setEditingMenuDish(null);
  };

  const handleBatchUpdateDish = async (oldName: string, newName: string, mealIdx: number) => {
    const normalizedNewName = newName.trim().toUpperCase();
    if (!normalizedNewName || normalizedNewName === oldName) return;

    // 1. Cập nhật trong Kế hoạch soạn trước
    const sessionKey = `${selectedDate}:${mealIdx}`;
    if (plannedDishes[sessionKey]) {
      setPlannedDishes(prev => ({
        ...prev,
        [sessionKey]: prev[sessionKey].map(d => d === oldName ? normalizedNewName : d)
      }));
    }

    // 2. Cập nhật cho toàn bộ khách hàng đang ăn món này
    const affectedTransactions: Transaction[] = [];
    transactions.forEach(tx => {
      if (tx.category !== Category.FOOD || !tx.foodMetadata) return;
      let hasChange = false;
      const newMetadata = { ...tx.foodMetadata } as Record<string, FoodDayMetadata>;
      Object.entries(newMetadata).forEach(([key, metaValue]) => {
        const meta = metaValue as FoodDayMetadata;
        const [datePart, idxPart] = key.split(':');
        if (datePart === selectedDate && parseInt(idxPart) === mealIdx && (meta.dish || 'CHƯA CHỌN MÓN').toUpperCase() === oldName) {
          newMetadata[key] = { ...meta, dish: normalizedNewName };
          hasChange = true;
        }
      });
      if (hasChange) affectedTransactions.push({ ...tx, foodMetadata: newMetadata });
    });

    if (affectedTransactions.length > 0) {
      await dbService.syncTransactions(affectedTransactions);
    }
  };

  const handleAssignDishToGuest = async (txId: string, metaKey: string, dishName: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    const newMetadata = { ...(tx.foodMetadata || {}) } as Record<string, FoodDayMetadata>;
    const currentMeta = (newMetadata[metaKey] || {}) as FoodDayMetadata;
    newMetadata[metaKey] = { ...currentMeta, dish: dishName.toUpperCase() };
    await dbService.syncTransactions([{ ...tx, foodMetadata: newMetadata }]);
    setEditingMeal(null);
  };

  const handleToggleDelivered = async (txId: string, metaKey: string, currentStatus: boolean) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    const newMetadata = { ...(tx.foodMetadata || {}) } as Record<string, FoodDayMetadata>;
    const currentMeta = (newMetadata[metaKey] || {}) as FoodDayMetadata;
    newMetadata[metaKey] = { ...currentMeta, delivered: !currentStatus };
    await dbService.syncTransactions([{ ...tx, foodMetadata: newMetadata }]);
  };

  const mealLabels = ["SÁNG", "TRƯA", "CHIỀU"];
  const mealIcons = ["fa-sun", "fa-cloud-sun", "fa-moon"];
  const mealColors = ["text-orange-500", "text-emerald-500", "text-indigo-500"];
  const mealBgs = ["bg-orange-50", "bg-emerald-50", "bg-indigo-50"];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 max-w-2xl mx-auto px-4">
      {/* Date & Session Selector */}
      <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm sticky top-20 z-30 space-y-4">
        <div className="flex gap-2">
          {dateOptions.map(opt => (
            <button
              key={opt.iso}
              onClick={() => setSelectedDate(opt.iso)}
              className={`flex-1 py-3 rounded-2xl flex flex-col items-center justify-center transition-all border-2 ${
                selectedDate === opt.iso 
                ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                : 'bg-slate-50 border-slate-100 text-slate-400'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">{opt.label}</span>
              <span className="text-xs font-bold opacity-60">{opt.dow} - {opt.iso.split('-').reverse().slice(0, 2).join('/')}</span>
            </button>
          ))}
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl">
          {mealLabels.map((label, idx) => (
            <button
              key={label}
              onClick={() => setActiveTab(idx)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${
                activeTab === idx ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
              }`}
            >
              <i className={`fas ${mealIcons[idx]} ${activeTab === idx ? mealColors[idx] : ''}`}></i>
              {label} ({menuSummary.counts[idx]})
            </button>
          ))}
        </div>
      </div>

      {/* THỰC ĐƠN BUỔI (PRE-PLANNING) */}
      <div className={`${mealBgs[activeTab]} p-6 rounded-[32px] border border-black/5 space-y-5 animate-in slide-in-from-top-4 duration-300`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${activeTab === 0 ? 'bg-orange-500' : activeTab === 1 ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
              <i className={`fas ${mealIcons[activeTab]} text-xs`}></i>
            </div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">Thực đơn {mealLabels[activeTab]}</h3>
          </div>
          <button 
            onClick={() => { setEditingMenuDish({ oldName: '', mealIdx: activeTab }); setTempDish(''); }}
            className="px-4 py-2 bg-white text-slate-800 rounded-xl shadow-sm text-[9px] font-black uppercase flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
          >
            <i className="fas fa-plus"></i> Thêm món
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {Object.entries(menuSummary.dishCounts).length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-black/5 rounded-2xl">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Bấm "Thêm món" để soạn thực đơn</p>
            </div>
          ) : (
            Object.entries(menuSummary.dishCounts).map(([name, count]) => (
              <div key={name} className="flex justify-between items-center bg-white p-3.5 rounded-2xl shadow-sm border border-black/5 group">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black uppercase text-slate-700 tracking-tight">{name}</span>
                  {name !== 'CHƯA CHỌN MÓN' && (
                    <button 
                      onClick={() => { setEditingMenuDish({ oldName: name, mealIdx: activeTab }); setTempDish(name); }}
                      className="opacity-0 group-hover:opacity-100 text-blue-500 text-[10px] font-black uppercase transition-opacity"
                    >
                      Sửa tên
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-white text-[11px] font-black ${activeTab === 0 ? 'bg-orange-500' : activeTab === 1 ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
                    x{count}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DANH SÁCH GIAO HÀNG */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Đơn hàng buổi {mealLabels[activeTab]}</h3>
        {groupedDeliveries.filter(g => g.meals.some(m => m.mealIdx === activeTab)).length === 0 ? (
          <div className="py-20 text-center opacity-20">
            <i className="fas fa-box-open text-4xl mb-4"></i>
            <p className="text-[10px] font-black uppercase tracking-widest">Không có đơn cho buổi này</p>
          </div>
        ) : (
          groupedDeliveries
            .filter(g => g.meals.some(m => m.mealIdx === activeTab))
            .map((group, idx) => {
              const meal = group.meals.find(m => m.mealIdx === activeTab)!;
              return (
                <div key={idx} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:border-emerald-500/50 transition-all">
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-800 uppercase tracking-tight">{group.guestName}</h4>
                        {group.guestPhone && (
                          <a href={`tel:${group.guestPhone}`} className="text-blue-500"><i className="fas fa-phone-alt text-xs"></i></a>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => setEditingMeal({ txId: meal.txId, metaKey: meal.metaKey, label: mealLabels[activeTab] })}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                          meal.metadata.dish ? 'bg-slate-50 border-slate-100' : 'bg-red-50 border-red-200 animate-pulse'
                        }`}
                      >
                        <i className={`fas ${mealIcons[activeTab]} ${mealColors[activeTab]} text-[10px]`}></i>
                        <span className={`text-[10px] font-black uppercase ${meal.metadata.dish ? 'text-slate-800' : 'text-red-500'}`}>
                          {meal.metadata.dish || 'CHƯA CHỌN MÓN'}
                        </span>
                        <i className="fas fa-chevron-down text-[8px] text-slate-300"></i>
                      </button>

                      {group.guestAddress && (
                        <div className="text-[9px] text-slate-400 font-medium italic">
                          Đ/c: {group.guestAddress}
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => handleToggleDelivered(meal.txId, meal.metaKey, !!meal.metadata.delivered)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${
                        meal.metadata.delivered ? 'bg-slate-100 text-slate-400' : 'bg-emerald-500 text-white shadow-lg active:scale-95'
                      }`}
                    >
                      <i className={`fas ${meal.metadata.delivered ? 'fa-check-circle' : 'fa-truck'}`}></i>
                      {meal.metadata.delivered ? 'Đã giao' : 'Giao hàng'}
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* MODAL: THÊM/SỬA MÓN THỰC ĐƠN */}
      {editingMenuDish && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-xs rounded-[40px] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-[10px] font-black uppercase text-slate-400 text-center tracking-widest">
              {editingMenuDish.oldName ? 'Đổi tên món' : 'Thêm món vào thực đơn'}
            </h3>
            <input 
              autoFocus
              value={tempDish}
              onChange={(e) => setTempDish(e.target.value)}
              placeholder="Nhập tên món..."
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-center uppercase text-sm outline-none focus:border-blue-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setEditingMenuDish(null)} className="py-4 rounded-2xl bg-slate-100 text-[10px] font-black uppercase text-slate-500">Hủy</button>
              <button 
                onClick={() => editingMenuDish.oldName ? handleBatchUpdateDish(editingMenuDish.oldName, tempDish, editingMenuDish.mealIdx) : handleAddPlannedDish(tempDish)}
                className="py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHỌN MÓN CHO KHÁCH */}
      {editingMeal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-xl font-black text-slate-800 uppercase">Chọn món</p>
              <button onClick={() => setEditingMeal(null)} className="text-slate-400"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
              {Object.keys(menuSummary.dishCounts).filter(d => d !== 'CHƯA CHỌN MÓN').length === 0 ? (
                <div className="text-center py-10 opacity-40 italic font-bold text-xs uppercase">Chưa có thực đơn cho buổi này.</div>
              ) : (
                Object.keys(menuSummary.dishCounts).filter(d => d !== 'CHƯA CHỌN MÓN').map(dishName => (
                  <button
                    key={dishName}
                    onClick={() => handleAssignDishToGuest(editingMeal.txId, editingMeal.metaKey, dishName)}
                    className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-left hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                  >
                    <span className="text-sm font-black text-slate-700 uppercase">{dishName}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};
