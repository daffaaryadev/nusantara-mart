
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

type Produk = {
  id: number | string;
  sku: string;
  nama_product: string;
  stok_system: number;
};

export default function StockOpname() {
  const [sku, setSku] = useState("");
  const [produk, setProduk] = useState<Produk | null>(null);
  const [stokFisik, setStokFisik] = useState("");

  const [loadingCari, setLoadingCari] = useState(false);
  const [loadingSimpan, setLoadingSimpan] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  const [showSuccess, setShowSuccess] = useState(false);
  const [savedProductName, setSavedProductName] = useState("");
  const [savedSku, setSavedSku] = useState("");
  const [savedStokSistem, setSavedStokSistem] = useState(0);
  const [savedStokFisik, setSavedStokFisik] = useState(0);
  const [savedSelisih, setSavedSelisih] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const hasScannedRef = useRef(false);

  const router = useRouter();

  // Cari produk berdasarkan SKU atau barcode
  const cariProduk = async (nilaiSKU?: string) => {
    const targetSKU = (nilaiSKU ?? sku).trim();

    if (!targetSKU) {
      alert("Masukkan atau scan barcode terlebih dahulu.");
      return;
    }

    setLoadingCari(true);
    setProduk(null);
    setScanError("");

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, nama_product, stok_system")
        .eq("sku", targetSKU)
        .limit(2);

      if (error) throw error;

      if (!data || data.length === 0) {
        setSku(targetSKU);
        alert(`Produk dengan SKU ${targetSKU} tidak ditemukan.`);
        return;
      }

      if (data.length > 1) {
        alert(
          `SKU "${targetSKU}" terdaftar lebih dari satu kali. ` +
            "Periksa duplikasi SKU di Supabase."
        );
        return;
      }

      setSku(targetSKU);
      setProduk(data[0] as Produk);
      setStokFisik("");
    } catch (error) {
      console.error("Gagal mencari produk:", error);

      alert(
        error instanceof Error
          ? `Gagal mencari produk: ${error.message}`
          : "Gagal mencari produk. Periksa koneksi Supabase."
      );
    } finally {
      setLoadingCari(false);
    }
  };

  // Hentikan kamera dan bersihkan scanner
  const hentikanScanner = async () => {
    const scanner = scannerRef.current;

    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (error) {
        console.warn("Gagal menghentikan scanner:", error);
      }

      try {
        scanner.clear();
      } catch (error) {
        console.warn("Scanner sudah dibersihkan:", error);
      }

      scannerRef.current = null;
    }

    setIsScanning(false);
    startingRef.current = false;
  };

  // Mulai kamera dan scan barcode
  const mulaiScanner = async () => {
    if (startingRef.current || scannerRef.current) return;

    setScanError("");
    hasScannedRef.current = false;

    if (!window.isSecureContext) {
      setScanError(
        "Kamera membutuhkan HTTPS atau localhost. Buka aplikasi melalui alamat HTTPS."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Browser ini tidak mendukung akses kamera.");
      return;
    }

    startingRef.current = true;

    try {
      const scanner = new Html5Qrcode("so-reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });

      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (viewWidth, viewHeight) => ({
            width: Math.min(320, Math.floor(viewWidth * 0.9)),
            height: Math.min(130, Math.floor(viewHeight * 0.55)),
          }),
          aspectRatio: 1.777778,
        },
        async (decodedText) => {
          if (hasScannedRef.current) return;

          const barcode = decodedText.trim();
          if (!barcode) return;

          hasScannedRef.current = true;

          await hentikanScanner();
          setSku(barcode);
          await cariProduk(barcode);
        },
        () => {
          // Abaikan frame yang belum berhasil dibaca.
        }
      );

      setIsScanning(true);
    } catch (error) {
      console.error("Gagal menjalankan scanner:", error);

      try {
        if (scannerRef.current?.isScanning) {
          await scannerRef.current.stop();
        }
      } catch {
        // Kamera mungkin belum berhasil aktif.
      }

      try {
        scannerRef.current?.clear();
      } catch {
        // Scanner mungkin sudah dibersihkan.
      }

      scannerRef.current = null;
      setIsScanning(false);

      setScanError(
        error instanceof Error
          ? error.message
          : "Kamera gagal dibuka. Periksa izin kamera browser."
      );
    } finally {
      startingRef.current = false;
    }
  };

  // Bersihkan kamera ketika halaman ditutup
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;

      if (scanner?.isScanning) {
        void scanner.stop().catch(console.error);
      }
    };
  }, []);

  // Simpan hasil SO dan update stok sistem
  const simpanSO = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loadingSimpan) return;

    if (!produk) {
      alert("Cari produk terlebih dahulu.");
      return;
    }

    if (stokFisik.trim() === "") {
      alert("Masukkan jumlah stok fisik.");
      return;
    }

    const fisik = Number(stokFisik);

    if (!Number.isInteger(fisik) || fisik < 0) {
      alert("Stok fisik harus berupa bilangan bulat minimal 0.");
      return;
    }

    setLoadingSimpan(true);

    try {
      const stokSistem = Number(produk.stok_system);

      if (!Number.isFinite(stokSistem)) {
        throw new Error("Nilai stok sistem produk tidak valid.");
      }

      const selisih = fisik - stokSistem;

      // Simpan riwayat stock opname
      const { error: errorSO } = await supabase
        .from("stock_opname")
        .insert({
          sku: produk.sku,
          stok_sistem: stokSistem,
          stok_fisik: fisik,
          selisih,
        });

      if (errorSO) throw errorSO;

      // Update stok sistem berdasarkan hasil hitung fisik
      const { error: errorUpdate } = await supabase
        .from("products")
        .update({ stok_system: fisik })
        .eq("sku", produk.sku);

      if (errorUpdate) {
        throw new Error(
          "Riwayat SO sudah tersimpan, tetapi stok produk gagal " +
            `diperbarui: ${errorUpdate.message}. ` +
            "Periksa stok sistem sebelum mencoba menyimpan ulang."
        );
      }

      // Simpan ringkasan untuk popup
      setSavedProductName(produk.nama_product || produk.sku);
      setSavedSku(produk.sku);
      setSavedStokSistem(stokSistem);
      setSavedStokFisik(fisik);
      setSavedSelisih(selisih);

      // Tampilkan popup, tidak langsung kembali ke Home
      setShowSuccess(true);
    } catch (error) {
      console.error("Gagal menyimpan SO:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan Stock Opname."
      );
    } finally {
      setLoadingSimpan(false);
    }
  };

  // Kembali ke halaman Home
  const kembaliKeHome = () => {
    setShowSuccess(false);
    router.push("/");
  };

  // Input barang berikutnya
  const inputBarangLagi = () => {
    setShowSuccess(false);
    setSku("");
    setProduk(null);
    setStokFisik("");
    setScanError("");
    hasScannedRef.current = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatSelisih = (nilai: number) => {
    if (nilai > 0) return `+${nilai}`;
    return String(nilai);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 pt-10 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-lg sm:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">
            Form Stock Opname
          </h1>

          <Link
            href="/"
            className="text-sm font-semibold text-red-500 hover:text-red-700"
          >
            ✕ Kembali
          </Link>
        </div>

        {/* Input SKU dan tombol scanner */}
        <div className="mb-6 space-y-3">
          <label
            htmlFor="sku-so"
            className="block text-sm font-semibold text-gray-700"
          >
            SKU / Barcode Produk
          </label>

          <input
            id="sku-so"
            type="text"
            placeholder="Scan / ketik SKU produk..."
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void cariProduk();
              }
            }}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void cariProduk()}
              disabled={loadingCari || isScanning}
              className="rounded-lg bg-gray-800 p-3 text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {loadingCari ? "Mencari..." : "Cari Produk"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (isScanning) {
                  void hentikanScanner();
                } else {
                  void mulaiScanner();
                }
              }}
              disabled={loadingCari}
              className="rounded-lg bg-blue-600 p-3 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isScanning ? "Tutup Kamera" : "📷 Scan Barcode"}
            </button>
          </div>

          {scanError && (
            <p className="text-sm text-red-600" role="alert">
              {scanError}
            </p>
          )}

          {/* Tempat tampilan kamera */}
          <div
            id="so-reader"
            className="w-full overflow-hidden rounded-lg"
          />

          {isScanning && (
            <p className="text-center text-xs text-gray-500">
              Arahkan barcode ke kotak kamera. Kamera akan berhenti
              setelah barcode berhasil terbaca.
            </p>
          )}
        </div>

        {/* Form hasil pencarian produk */}
        {produk && (
          <form
            onSubmit={simpanSO}
            className="space-y-4 rounded-lg border border-blue-100 bg-blue-50 p-4"
          >
            <div>
              <p className="text-sm text-gray-500">Nama Produk</p>
              <p className="text-lg font-bold text-black">
                {produk.nama_product}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">SKU / Barcode</p>
              <p className="break-all font-medium text-black">
                {produk.sku}
              </p>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Stok Sistem</p>
                <p className="text-xl font-bold text-blue-600">
                  {produk.stok_system}
                </p>
              </div>

              <div className="text-right">
                <label
                  htmlFor="stok-fisik"
                  className="mb-1 block text-sm font-bold text-gray-700"
                >
                  Stok Fisik
                </label>

                <input
                  id="stok-fisik"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Jumlah..."
                  value={stokFisik}
                  onChange={(e) => setStokFisik(e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 bg-white p-2 text-right text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Perhitungan selisih secara langsung */}
            {stokFisik !== "" &&
              Number.isInteger(Number(stokFisik)) &&
              Number(stokFisik) >= 0 && (
                <div className="border-t border-blue-200 pt-3">
                  <p className="text-sm text-gray-600">Selisih Stok</p>

                  <p
                    className={`text-lg font-bold ${
                      Number(stokFisik) -
                        Number(produk.stok_system) <
                      0
                        ? "text-red-600"
                        : Number(stokFisik) -
                            Number(produk.stok_system) >
                          0
                        ? "text-green-600"
                        : "text-gray-800"
                    }`}
                  >
                    {formatSelisih(
                      Number(stokFisik) -
                        Number(produk.stok_system)
                    )}
                  </p>
                </div>
              )}

            <button
              type="submit"
              disabled={loadingSimpan}
              className="w-full rounded-lg bg-blue-600 p-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingSimpan
                ? "Menyimpan..."
                : "Simpan SO & Update Stok"}
            </button>
          </form>
        )}
      </div>

      {/* POPUP BERHASIL STOCK OPNAME */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
          >
            {/* Ikon sukses */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-9 w-9 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2
              id="success-title"
              className="text-xl font-extrabold text-slate-900"
            >
              Stock Opname Berhasil!
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Riwayat SO tersimpan dan stok sistem berhasil diperbarui
              untuk:
            </p>

            <p className="mt-2 break-words font-bold text-slate-800">
              {savedProductName}
            </p>

            <p className="mt-1 break-all text-xs text-slate-500">
              SKU: {savedSku}
            </p>

            {/* Ringkasan hasil SO */}
            <div className="mt-5 space-y-2 rounded-xl bg-blue-50 p-4 text-left">
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-slate-600">Stok sistem sebelumnya</span>
                <span className="font-semibold text-slate-900">
                  {savedStokSistem}
                </span>
              </div>

              <div className="flex justify-between gap-3 text-sm">
                <span className="text-slate-600">Stok fisik</span>
                <span className="font-semibold text-slate-900">
                  {savedStokFisik}
                </span>
              </div>

              <div className="flex justify-between gap-3 border-t border-blue-200 pt-2 text-sm">
                <span className="font-semibold text-slate-700">
                  Selisih
                </span>
                <span
                  className={`font-extrabold ${
                    savedSelisih < 0
                      ? "text-red-600"
                      : savedSelisih > 0
                      ? "text-emerald-600"
                      : "text-slate-900"
                  }`}
                >
                  {formatSelisih(savedSelisih)}
                </span>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              Silakan pilih tindakan selanjutnya.
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={kembaliKeHome}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white transition hover:bg-emerald-700"
              >
                ← Kembali ke Home
              </button>

              <button
                type="button"
                onClick={inputBarangLagi}
                className="w-full rounded-xl border-2 border-blue-500 px-4 py-3 font-bold text-blue-600 transition hover:bg-blue-50"
              >
                + Input Barang Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
