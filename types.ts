
export enum Category {
  LAUNDRY = 'Giặt Sấy',
  HOMESTAY = 'Homestay',
  FOOD = 'Healthy Food',
  BIKE = 'Thuê Xe Đạp'
}

export interface RoomConfig {
  icalUrl: string;
  price: number;
}

export interface FoodDayMetadata {
  dish?: string;
  delivered?: boolean;
}

export interface Transaction {
  id: string;
  category: Category;
  amount: number;
  originalAmount: number;
  discount: number;
  date: string;
  description: string;
  guestName?: string; 
  guestPhone?: string;
  guestAddress?: string;
  quantity: number;
  unit: string;
  source?: 'manual' | 'booking.com';
  externalId?: string; 
  room?: string; 
  checkIn?: string; 
  checkOut?: string;
  // Metadata cho Healthy Food: Key là định dạng "YYYY-MM-DD:index" (với index là thứ tự buổi trong ngày)
  foodMetadata?: Record<string, FoodDayMetadata>;
}

export interface DailyStats {
  date: string;
  total: number;
  byCategory: Record<Category, number>;
}

export type TimeFilter = 'day' | 'week' | 'month' | 'year';
