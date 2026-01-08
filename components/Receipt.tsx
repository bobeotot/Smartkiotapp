
import React from 'react';
import { Transaction, Category } from '../types';
import { CATEGORY_CONFIG } from '../constants';

interface ReceiptProps {
  transaction: Transaction;
}

export const Receipt: React.FC<ReceiptProps> = ({ transaction }) => {
  return (
    <div id="receipt-print" className="bg-white text-black p-8 w-[80mm] mx-auto font-mono text-sm leading-tight print:block hidden">
      <div className="text-center mb-6">
        <h1 className="text-xl font-black uppercase tracking-tighter">SMART KIOT</h1>
        <p className="text-[10px] mt-1">Dịch vụ Giặt sấy - Homestay - Food - Xe đạp</p>
        <p className="text-[10px]">Đ/c: 123 Đường ABC, Phường XYZ, Đà Lạt</p>
        <p className="text-[10px]">SĐT: 090.xxx.xxxx</p>
      </div>

      <div className="border-t border-dashed border-black my-4"></div>

      <div className="space-y-1 mb-4">
        <div className="flex justify-between text-[10px]">
          <span>Số HĐ:</span>
          <span className="font-bold">#{transaction.id.slice(-6).toUpperCase()}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Ngày in:</span>
          <span>{new Date().toLocaleString('vi-VN')}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Loại:</span>
          <span className="font-bold">{transaction.category}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Trạng thái:</span>
          <span className="font-bold underline uppercase">{transaction.isPaid ? 'Đã thanh toán' : 'CHƯA THANH TOÁN'}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-4"></div>

      <table className="w-full text-[11px] mb-4">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-2">Dịch vụ</th>
            <th className="text-center py-2">SL</th>
            <th className="text-right py-2">T.Tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-3 pr-2">
              <div className="font-bold uppercase">{transaction.description}</div>
              {transaction.room && <div className="text-[9px]">Phòng: {transaction.room}</div>}
              {transaction.guestName && <div className="text-[9px]">Khách: {transaction.guestName}</div>}
            </td>
            <td className="text-center py-3">{transaction.quantity}</td>
            <td className="text-right py-3">{transaction.originalAmount.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div className="border-t border-dashed border-black my-4"></div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span>Tổng tiền hàng:</span>
          <span>{transaction.originalAmount.toLocaleString()} đ</span>
        </div>
        {transaction.discount > 0 && (
          <div className="flex justify-between text-xs italic">
            <span>Giảm giá ({transaction.discount}%):</span>
            <span>- {((transaction.originalAmount * transaction.discount) / 100).toLocaleString()} đ</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black border-t border-black pt-2">
          <span>KHÁCH TRẢ:</span>
          <span>{transaction.amount.toLocaleString()} đ</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-6"></div>

      <div className="text-center space-y-1">
        <p className="font-bold text-[10px]">CẢM ƠN QUÝ KHÁCH!</p>
        <p className="text-[9px] italic">Hẹn gặp lại quý khách lần sau</p>
        <p className="text-[8px] mt-4 text-slate-400">Powered by Smart Kiot App</p>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          #receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 10mm;
            margin: 0;
            background: white;
          }
        }
      `}} />
    </div>
  );
};
