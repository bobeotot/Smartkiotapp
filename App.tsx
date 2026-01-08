
import React, { useState, useEffect, useMemo } from 'react';
import { Category, Transaction, TimeFilter, RoomConfig } from './types';
import { CATEGORY_CONFIG, ROOM_ICAL_CONFIG } from './constants';
import { StatCard } from './components/StatCard';
import { TransactionForm } from './components/TransactionForm';
import { Receipt } from './components/Receipt';
import { Login } from './components/Login';
import { CalendarView } from './components/CalendarView';
import { FoodScheduleView } from './components/FoodScheduleView';
import { syncBookingCom } from './services/bookingService';
import { dbService } from './services/dbService';

type ViewState = 'dashboard' | 'calendar' | 'food-schedule';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('smart_kiot_auth') === 'true';
  });

  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error' | 'not_created' | 'offline_mode'>('checking');
  const [filter, setFilter] = useState<TimeFilter>('day');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [printTx, setPrintTx] = useState<Transaction | null>(null);

  // Lấy cấu hình phòng từ LocalStorage (để link iCal không bị mất)
  const roomConfigs = useMemo(() => {
    const saved = localStorage.getItem('smart_kiot_room_configs');
    if (saved) {
      return JSON.parse(saved) as Record<string, RoomConfig>;
    }
    return ROOM_ICAL_CONFIG;
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    let unsubscribe: (() => void) | undefined;

    const initApp = async () => {
      setIsLoading(true);
      
      if (dbService.isOfflineMode) {
        setDbStatus('offline_mode');
        unsubscribe = dbService.subscribeTransactions((data) => {
          setTransactions(data);
          setIsLoading(false);
        });
        return;
      }

      try {
        await dbService.testConnection();
        setDbStatus('connected');
        unsubscribe = dbService.subscribeTransactions((data) => {
          setTransactions(data);
          setIsLoading(false);
        });
      } catch (e: any) {
        console.warn("Database initialization failed:", e.message);
        if (e.message === "DATABASE_NOT_CREATED") {
          setDbStatus('not_created');
        } else {
          setDbStatus('error');
        }
        setIsLoading(false);
      }
    };

    initApp();
    return () => unsubscribe?.();
  }, [isLoggedIn]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    sessionStorage.setItem('smart_kiot_auth', 'true');
  };

  const handleLogout = () => {
    if (confirm('Đăng xuất hệ thống?')) {
      setIsLoggedIn(false);
      sessionStorage.removeItem('smart_kiot_auth');
    }
  };

  const handleSyncBooking = async () => {
    setIsSyncing(true);
    try {
      // Sử dụng cấu hình từ LocalStorage để đồng bộ
      const currentConfigs = JSON.parse(localStorage.getItem('smart_kiot_room_configs') || JSON.stringify(ROOM_ICAL_CONFIG));
      const updated = await syncBookingCom(transactions, currentConfigs);
      
      const newOnes = updated.filter(u => !transactions.find(t => (t.id === u.id || (t.externalId && t.externalId === u.externalId))));
      
      if (newOnes.length > 0) {
        await dbService.syncTransactions(newOnes);
        if (dbService.isOfflineMode) {
           setTransactions(prev => [...newOnes, ...prev]);
        }
        alert(`Đã cập nhật ${newOnes.length} đơn hàng mới từ Booking.com`);
      } else {
        alert("Lịch đã được cập nhật mới nhất (Không có đơn mới).");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi đồng bộ: Vui lòng kiểm tra lại đường dẫn iCal trong phần 'Đồng bộ 2 chiều'.");
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((t) => {
      const tDate = new Date(t.date);
      if (filter === 'day') return tDate.toDateString() === now.toDateString();
      if (filter === 'week') {
        const start = new Date();
        start.setDate(now.getDate() - now.getDay());
        return tDate >= start;
      }
      if (filter === 'month') return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      if (filter === 'year') return tDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, filter]);

  const stats = useMemo(() => {
    const totals: any = { [Category.LAUNDRY]: 0, [Category.HOMESTAY]: 0, [Category.FOOD]: 0, [Category.BIKE]: 0 };
    let grand = 0;
    filteredTransactions.forEach(t => {
      if (totals[t.category] !== undefined) totals[t.category] += t.amount;
      grand += t.amount;
    });
    return { totals, grand };
  }, [filteredTransactions]);

  if (!isLoggedIn) return <Login onLogin={handleLoginSuccess} />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 rounded-lg text-white"><i className="fas fa-cash-register"></i></div>
            <h1 className="font-black text-slate-800 uppercase hidden md:block text-sm tracking-tighter">Smart Kiot</h1>
            <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl ml-4 overflow-x-auto no-scrollbar">
              <button onClick={() => setCurrentView('dashboard')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all ${currentView === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Dashboard</button>
              <button onClick={() => setCurrentView('calendar')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all ${currentView === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Lịch Phòng</button>
              <button onClick={() => setCurrentView('food-schedule')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all ${currentView === 'food-schedule' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Giao Cơm</button>
            </nav>
          </div>
          
          <div className="flex gap-3 items-center">
            <button 
              onClick={handleSyncBooking} 
              disabled={isSyncing}
              className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${isSyncing ? 'bg-slate-50 text-slate-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'}`}
            >
              <i className={`fas fa-sync-alt text-xs ${isSyncing ? 'animate-spin' : ''}`}></i>
              <span className="text-[8px] font-black uppercase hidden sm:block">Đồng bộ</span>
            </button>
            <button onClick={() => setIsFormOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 whitespace-nowrap">+ ĐƠN MỚI</button>
            <button onClick={handleLogout} className="p-2 text-slate-300 hover:text-red-500"><i className="fas fa-sign-out-alt"></i></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 print:hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400 text-[10px] font-black uppercase">Đang tải dữ liệu...</p>
          </div>
        ) : currentView === 'calendar' ? (
          <CalendarView transactions={transactions} />
        ) : currentView === 'food-schedule' ? (
          <FoodScheduleView transactions={transactions} />
        ) : (
          <div className="space-y-6">
            <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
              {(['day', 'week', 'month', 'year'] as TimeFilter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 uppercase'}`}>{f === 'day' ? 'Ngày' : f === 'week' ? 'Tuần' : f === 'month' ? 'Tháng' : 'Năm'}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Doanh Thu" value={stats.grand.toLocaleString()} icon={<i className="fas fa-wallet"></i>} colorClass="bg-blue-600" />
              <StatCard label="Giặt Sấy" value={stats.totals[Category.LAUNDRY].toLocaleString()} icon={<i className="fas fa-tshirt"></i>} colorClass="bg-sky-500" />
              <StatCard label="Homestay" value={stats.totals[Category.HOMESTAY].toLocaleString()} icon={<i className="fas fa-bed"></i>} colorClass="bg-indigo-600" />
              <StatCard label="Cơm / Xe" value={(stats.totals[Category.FOOD] + stats.totals[Category.BIKE]).toLocaleString()} icon={<i className="fas fa-plus"></i>} colorClass="bg-emerald-500" />
            </div>
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b font-black text-slate-400 text-[9px] uppercase tracking-widest bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <i className="fas fa-history text-xs"></i>
                  <span>Lịch sử giao dịch ({filteredTransactions.length})</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.length === 0 ? (
                      <tr><td className="p-20 text-center text-slate-300 font-black italic text-[10px] uppercase tracking-widest">Chưa có giao dịch.</td></tr>
                    ) : (
                      filteredTransactions.map(tx => (
                        <tr key={tx.id} className="group hover:bg-slate-50 transition-all border-l-4 border-transparent hover:border-blue-500">
                          <td className="px-6 py-5">
                            <div className="font-black text-slate-800 text-sm uppercase tracking-tight">{tx.description}</div>
                            <div className="text-[10px] text-slate-400 mt-1.5 uppercase font-black flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded ${tx.isPaid ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{tx.isPaid ? 'Đã thu' : 'Chưa thu'}</span>
                              <span className="opacity-20">•</span>
                              <span>{tx.category}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right font-black text-slate-900 text-base">{tx.amount.toLocaleString()}đ</td>
                          <td className="px-6 py-5 text-center w-32">
                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setPrintTx(tx); setTimeout(() => window.print(), 300); }} className="w-9 h-9 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"><i className="fas fa-print text-xs"></i></button>
                              <button onClick={() => confirm('Xóa giao dịch này?') && dbService.deleteTransaction(tx.id).then(() => setTransactions(prev => prev.filter(t => t.id !== tx.id)))} className="w-9 h-9 flex items-center justify-center text-red-400 bg-red-50 hover:bg-red-100 rounded-xl transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      {isFormOpen && <TransactionForm transactions={transactions} onAdd={(tx, print) => dbService.addTransaction(tx).then(id => { 
        const added = { ...tx, id }; 
        setTransactions(prev => [added, ...prev]); 
        if (print) { setPrintTx(added); setTimeout(() => window.print(), 300); }
        setIsFormOpen(false);
      })} onClose={() => setIsFormOpen(false)} />}
      {printTx && <Receipt transaction={printTx} />}
    </div>
  );
};

export default App;
