"use client";

import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fungsi mengambil seluruh data produk dari Supabase (Batch Loop 1000 Data)
  const fetchProducts = async () => {
    setLoading(true);

    try {
      const semuaProduk: any[] = [];
      const ukuranHalaman = 1000;

      for (let mulai = 0; ; mulai += ukuranHalaman) {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("id", { ascending: false })
          .range(mulai, mulai + ukuranHalaman - 1);

        if (error) {
          throw error;
        }

        semuaProduk.push(...(data ?? []));

        if (!data || data.length < ukuranHalaman) {
          break;
        }
      }

      setProducts(semuaProduk);
      console.log("Total produk berhasil dimuat:", semuaProduk.length);
    } catch (error) {
      console.error("Gagal mengambil produk:", error);
      alert("Gagal mengambil data produk. Periksa koneksi Supabase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Fungsi untuk menghapus produk
  const hapusProduk = async (id: number, nama: string) => {
    const konfirmasi = confirm(`Yakin ingin menghapus produk "${nama}"?`);
    if (!konfirmasi) return;

    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      alert('Gagal menghapus data: ' + error.message);
    } else {
      fetchProducts();
    }
  };

  // Filter produk berdasarkan pencarian SKU / Nama
  const filteredProducts = products.filter(item =>
    item.nama_product?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Hitung total stok
  const totalStok = products.reduce((acc, curr) => acc + (Number(curr.stok_system) || 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 pb-12">
      {/* Header Bar dengan Branding NUSANTARA MART */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">

          {/* Logo & Info Toko */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-1 shadow-md shrink-0 overflow-hidden">
              <img
                src="logo.png"
                alt="Nusantara Mart Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide uppercase">
                  Nusantara Mart
                </h1>
                <span className="text-[11px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md">
                  Master Produk
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Kelola inventaris dan stok barang retail NUSANTARA MART
              </p>
            </div>
          </div>

          {/* Indikator Database Active */}
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Database Active
          </div>

        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Ringkasan Statistik */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs sm:text-sm font-medium text-slate-500">Total Jenis Produk</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {products.length} <span className="text-xs font-normal text-slate-400">SKU</span>
            </p>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs sm:text-sm font-medium text-slate-500">Total Stok Sistem</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-blue-600 mt-1">
              {totalStok} <span className="text-xs font-normal text-slate-400">Pcs</span>
            </p>
          </div>
        </div>

        {/* Menu Navigasi & Input Pencarian */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <Link
              href="/tambah"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Tambah Produk
            </Link>
            <Link
              href="/so"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Mulai SO
            </Link>
            <Link
              href="/ed"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Catat Expired
            </Link>
            <Link
              href="/laporan"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Dashboard
            </Link>
          </div>

          {/* Form Pencarian Realtime */}
          <div className="relative w-full md:w-64">
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Cari nama atau SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Loading State Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/80 animate-pulse space-y-3">
                <div className="h-5 bg-slate-200 rounded-md w-3/4"></div>
                <div className="h-4 bg-slate-100 rounded-md w-1/2"></div>
                <div className="h-8 bg-slate-100 rounded-lg w-full pt-2"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center max-w-md mx-auto my-8">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Produk tidak ditemukan</h3>
            <p className="text-sm text-slate-500 mb-4">
              {searchTerm ? `Tidak ada hasil untuk "${searchTerm}"` : 'Belum ada produk tersimpan di database.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-xs text-blue-600 font-semibold hover:underline"
              >
                Bersihkan Pencarian
              </button>
            )}
          </div>
        ) : (
          /* Grid Kartu Produk */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((item) => (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="font-bold text-slate-800 text-base leading-snug group-hover:text-blue-600 transition-colors">
                      {item.nama_product}
                    </h2>
                    <span className="shrink-0 bg-slate-100 text-slate-600 text-[11px] font-mono px-2 py-0.5 rounded-md border border-slate-200">
                      {item.sku}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 my-3">
                    <span className="text-xs text-slate-500 font-medium">Stok Sistem</span>
                    <span className={`text-sm font-bold ${Number(item.stok_system) <= 5 ? 'text-amber-600' : 'text-blue-600'}`}>
                      {item.stok_system} <span className="text-[10px] font-normal text-slate-400">Pcs</span>
                    </span>
                  </div>
                </div>

                {/* Tombol Aksi Edit & Hapus */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Link
                    href={`/edit/${item.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit
                  </Link>
                  <button
                    onClick={() => hapusProduk(item.id, item.nama_product)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}