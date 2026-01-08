
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  doc, 
  query, 
  orderBy,
  limit,
  setDoc,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { Transaction } from "../types";

const COLLECTION_NAME = "transactions";

const cleanData = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

const getSafeError = (e: any): string => {
  if (!e) return "Unknown Error";
  return e.message || e.code || String(e);
};

const getLocalTransactions = (): Transaction[] => {
  try {
    const data = localStorage.getItem('kiot_fallback_data');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalTransactions = (txs: Transaction[]) => {
  try {
    localStorage.setItem('kiot_fallback_data', JSON.stringify(txs));
  } catch (e) {}
};

export const dbService = {
  // Kiểm tra cờ offline trong localStorage để bỏ qua kết nối Firebase ngay từ đầu
  isOfflineMode: localStorage.getItem('kiot_force_offline') === 'true',
  listeners: [] as Array<(txs: Transaction[]) => void>,

  notifyListeners() {
    const data = getLocalTransactions();
    this.listeners.forEach(cb => cb(data));
  },

  setOffline(status: boolean) {
    this.isOfflineMode = status;
    if (status) {
      localStorage.setItem('kiot_force_offline', 'true');
    } else {
      localStorage.removeItem('kiot_force_offline');
    }
  },

  async testConnection(): Promise<boolean> {
    if (this.isOfflineMode) return true;
    try {
      const q = query(collection(db, COLLECTION_NAME), limit(1));
      await getDocs(q);
      return true;
    } catch (e: any) {
      const msg = getSafeError(e).toLowerCase();
      // Bắt lỗi 'not-found' (Project có nhưng chưa tạo Database Firestore)
      if (e.code === 'not-found' || msg.includes('not-found') || msg.includes('does not exist')) {
        this.setOffline(true);
        throw new Error("DATABASE_NOT_CREATED");
      }
      throw e;
    }
  },

  subscribeTransactions(callback: (transactions: Transaction[]) => void) {
    this.listeners.push(callback);
    
    if (this.isOfflineMode) {
      callback(getLocalTransactions());
      return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
      };
    }

    const q = query(collection(db, COLLECTION_NAME), orderBy("date", "desc"));
    
    try {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const txs: Transaction[] = [];
        snapshot.forEach((doc) => {
          txs.push({ ...doc.data(), id: doc.id } as Transaction);
        });
        saveLocalTransactions(txs);
        callback(txs);
      }, (error) => {
        const msg = getSafeError(error).toLowerCase();
        // Tự động chuyển offline nếu phát hiện database bị xóa hoặc chưa tạo trong lúc đang chạy
        if (msg.includes('not-found') || msg.includes('does not exist')) {
          this.setOffline(true);
          callback(getLocalTransactions());
        }
      });

      return () => {
        unsubscribe();
        this.listeners = this.listeners.filter(l => l !== callback);
      };
    } catch (e) {
      this.setOffline(true);
      callback(getLocalTransactions());
      return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
      };
    }
  },

  async addTransaction(tx: Transaction): Promise<string> {
    if (this.isOfflineMode) {
      const current = getLocalTransactions();
      const newTx = { ...tx, id: `local-${Date.now()}` };
      saveLocalTransactions([newTx, ...current]);
      this.notifyListeners();
      return newTx.id;
    }

    try {
      const { id, ...data } = tx;
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanData(data));
      return docRef.id;
    } catch (e: any) {
      const msg = getSafeError(e).toLowerCase();
      if (msg.includes('not-found') || msg.includes('does not exist')) {
        this.setOffline(true);
        return this.addTransaction(tx);
      }
      throw e;
    }
  },

  async deleteTransaction(id: string): Promise<void> {
    if (this.isOfflineMode || id.startsWith('local-')) {
      const current = getLocalTransactions();
      saveLocalTransactions(current.filter(t => t.id !== id));
      this.notifyListeners();
      return;
    }
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (e: any) {
      const msg = getSafeError(e).toLowerCase();
      if (msg.includes('not-found')) {
        this.setOffline(true);
        return this.deleteTransaction(id);
      }
    }
  },

  async syncTransactions(transactions: Transaction[]): Promise<void> {
    if (this.isOfflineMode) {
      const current = getLocalTransactions();
      const merged = [...current];
      transactions.forEach(t => {
        const idx = merged.findIndex(m => m.id === t.id);
        if (idx >= 0) merged[idx] = t;
        else merged.unshift(t);
      });
      saveLocalTransactions(merged);
      this.notifyListeners();
      return;
    }
    
    try {
      for (const tx of transactions) {
        const { id, ...data } = tx;
        await setDoc(doc(db, COLLECTION_NAME, id), cleanData(data), { merge: true });
      }
    } catch (e: any) {
      const msg = getSafeError(e).toLowerCase();
      if (msg.includes('not-found')) {
        this.setOffline(true);
        await this.syncTransactions(transactions);
      }
    }
  }
};
