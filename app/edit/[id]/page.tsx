"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function EditProduk() {
  const router = useRouter();
  const params = useParams(); 
  const id = params.id; // Mengambil ID dari URL

  const [namaProduct, setNamaProduct] = useState('');
  const [sku, setSku] = useState('');
  const [stokSystem, setStokSystem] = useState('');
  const [loading, setLoading] = useState(false);

  // Ambil data produk lama berdasarkan ID saat halaman dibuka
  useEffect(() => {
    if (id) {
      const fetchData = async () => {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (data) {
          setNamaProduct(data.nama_product);
          setSku(data.sku);
          setStokSystem(data.stok_system.toString());
        }
      };
      fetchData();
    }
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('products')
      .update({ 
        sku: sku, 
        nama_product: namaProduct, 
        stok_system: parseInt(stokSystem) 
      })
      .eq('id', id);

    setLoading(false);

    if (error) {
      alert('Error saat mengupdate data: ' + error.message);
    } else {
      alert('Produk berhasil diperbarui!');
      router.push('/');
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-8 flex flex-col items-center pt-20">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Edit Produk</h1>
          <Link href="/" className="text-sm font-semibold text-red-500 hover:text-red-700">
            ✕ Batal
          </Link>
        </div>
        
        <form onSubmit={handleUpdate} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nama Produk</label>
            <input 
              type="text" 
              value={namaProduct}
              onChange={(e) => setNamaProduct(e.target.value)}
              className="w-full border border-gray-300 bg-gray-50 text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">SKU / Barcode</label>
            <input 
              type="text" 
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full border border-gray-300 bg-gray-50 text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Stok Sistem</label>
            <input 
              type="number" 
              value={stokSystem}
              onChange={(e) => setStokSystem(e.target.value)}
              className="w-full border border-gray-300 bg-gray-50 text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-yellow-400 text-yellow-900 font-bold p-3 rounded-lg hover:bg-yellow-500 transition duration-200 mt-4 shadow-md disabled:opacity-50"
          >
            {loading ? 'Menyimpan Perubahan...' : 'Update Produk'}
          </button>
        </form>
      </div>
    </main>
  );
}