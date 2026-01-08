
import React from 'react';
import { Category } from './types';

export const CATEGORY_CONFIG = {
  [Category.LAUNDRY]: {
    icon: <i className="fas fa-tshirt"></i>,
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    unit: 'kg'
  },
  [Category.HOMESTAY]: {
    icon: <i className="fas fa-home"></i>,
    color: 'bg-indigo-500',
    borderColor: 'border-indigo-500',
    textColor: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    unit: 'đêm'
  },
  [Category.FOOD]: {
    icon: <i className="fas fa-utensils"></i>,
    color: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    textColor: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    unit: 'phần'
  },
  [Category.BIKE]: {
    icon: <i className="fas fa-bicycle"></i>,
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-50',
    unit: 'giờ'
  }
};

// Cấu hình Link iCal cho từng phòng từ Booking.com
export const ROOM_ICAL_CONFIG: Record<string, { icalUrl: string, price: number }> = {
  '101': {
    icalUrl: "https://ical.booking.com/v1/export?t=eb1ec19f-1889-4f4b-ad08-5d578c6e157c",
    price: 600000
  },
  '201': {
    icalUrl: "",
    price: 350000
  },
  '202': {
    icalUrl: "https://ical.booking.com/v1/export?t=75c9f7f8-2481-49da-a43f-32cc432d2f1b",
    price: 350000
  },
  '203': {
    icalUrl: "",
    price: 300000
  },
  'List Tổng': {
    icalUrl: "", 
    price: 900000
  }
};

// Định nghĩa quan hệ: List Tổng bao gồm các phòng nào
export const ROOM_DEPENDENCIES: Record<string, string[]> = {
  'List Tổng': ['201', '202', '203']
};

export const MOCK_TRANSACTIONS = [
  { id: '1', category: Category.LAUNDRY, amount: 50000, date: new Date().toISOString(), description: 'Khách lẻ - 5kg', quantity: 5, unit: 'kg', source: 'manual' as const, isPaid: true },
  { id: '2', category: Category.FOOD, amount: 120000, date: new Date().toISOString(), description: 'Salad ức gà x2', quantity: 2, unit: 'phần', source: 'manual' as const, isPaid: true },
  { id: '3', category: Category.HOMESTAY, amount: 450000, date: new Date().toISOString(), description: 'Phòng 201 - 1 đêm', quantity: 1, unit: 'đêm', room: '201', source: 'manual' as const, isPaid: true },
];
