
"use client";


import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

export default function ExpiredDate() {
  const [sku, setSku] = useState("");
  const [produk, setProduk] = useState<any>(null);
  const [tanggalExpired, setTanggalExpired] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [loadingCari, setLoadingCari] = useState(false);
  const [loadingSimpan, setLoadingSimpan] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedProductName, setSavedProductName] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
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

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, nama_product, stok_system")
        .eq("sku", targetSKU)
        .limit(2);

      if (error) {
        console.error("Detail error pencarian produk:", error);
        alert(`Gagal mencari produk: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        setSku(targetSKU);
        alert(`SKU "${targetSKU}" tidak ditemukan di tabel products.`);
        return;
      }

      if (data.length > 1) {
        alert(
          `SKU "${targetSKU}" terdaftar lebih dari satu kali. ` +
          "Periksa duplikasi SKU di Supabase."
        );
        console.error("SKU duplikat:", data);
        return;
      }

      setSku(targetSKU);
      setProduk(data[0]);
      setTanggalExpired("");
      setJumlah("");
    } catch (error) {
      console.error("Kesalahan pencarian produk:", error);
      alert("Terjadi kesalahan saat mencari produk.");
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

  // Mulai scanner barcode
  const mulaiScanner = async () => {
    if (startingRef.current || scannerRef.current) return;

    setScanError("");

    if (!window.isSecureContext) {
      setScanError(
        "Kamera membutuhkan HTTPS atau localhost. Buka aplikasi melalui alamat HTTPS."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Browser tidak mendukung akses kamera.");
      return;
    }

    startingRef.current = true;

    try {
      const scanner = new Html5Qrcode("ed-reader", {
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
          const barcode = decodedText.trim();

          if (!barcode) return;

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
        scannerRef.current?.clear();
      } catch {
        // Tidak perlu tindakan tambahan.
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
  
  // Simpan data expired date
  const simpanED = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loadingSimpan) return;

    if (!produk || !tanggalExpired || jumlah.trim() === "") {
      alert("Lengkapi tanggal kedaluwarsa dan jumlah barang.");
      return;
    }

    const jumlahAngka = Number(jumlah);

    if (!Number.isInteger(jumlahAngka) || jumlahAngka <= 0) {
      alert("Jumlah barang harus berupa bilangan bulat lebih dari 0.");
      return;
    }

    setLoadingSimpan(true);

    try {
      const { error } = await supabase
        .from("expired_dates")
        .insert({
          sku: produk.sku,
          tanggal_expired: tanggalExpired,
          jumlah: jumlahAngka,
        });

      if (error) throw error;

      setSavedProductName(produk.nama_product ?? produk.sku);
      setShowSuccess(true);
    } catch (error: unknown) {
      console.error("Gagal menyimpan data ED:", error);

      const pesan =
        error instanceof Error
          ? error.message
          : "Kesalahan tidak diketahui.";

      alert(`Gagal menyimpan data Expired Date: ${pesan}`);
    } finally {
      setLoadingSimpan(false);
    }
  };


  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-8 flex flex-col items-center pt-10">
      <div className="bg-white p-5 sm:p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
        <div className="flex justify-between items-center mb-6 gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            Catat Expired Date
          </h1>

          <Link
            href="/"
            className="text-sm font-semibold text-red-500 hover:text-red-700"
          >
            ✕ Kembali
          </Link>
        </div>

        {/* Pencarian SKU dan scanner */}
        <div className="space-y-3 mb-6">
          <input
            type="text"
            placeholder="Scan / ketik SKU..."
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void cariProduk();
              }
            }}
            className="w-full border border-gray-300 bg-gray-50 text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void cariProduk()}
              disabled={loadingCari || isScanning}
              className="bg-gray-800 text-white p-3 rounded-lg hover:bg-gray-900 disabled:opacity-50"
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
              className="bg-orange-500 text-white p-3 rounded-lg hover:bg-orange-600"
            >
              {isScanning ? "Tutup Kamera" : "📷 Scan Barcode"}
            </button>
          </div>

          {scanError && (
            <p className="text-sm text-red-600" role="alert">
              {scanError}
            </p>
          )}

          <div
            id="ed-reader"
            className="w-full overflow-hidden rounded-lg"
          />

          {isScanning && (
            <p className="text-xs text-gray-500 text-center">
              Arahkan barcode ke kamera. Pemindaian akan berhenti otomatis
              setelah barcode terbaca.
            </p>
          )}
        </div>

        {/* Form ED setelah produk ditemukan */}
        {produk && (
          <form
            onSubmit={simpanED}
            className="space-y-4 bg-orange-50 p-4 rounded-lg border border-orange-200"
          >
            <div>
              <p className="text-sm text-gray-500">Nama Produk</p>
              <p className="font-bold text-lg text-black">
                {produk.nama_product}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">SKU / Barcode</p>
              <p className="font-medium text-black break-all">
                {produk.sku}
              </p>
            </div>

            <div>
              <label
                htmlFor="tanggal-expired"
                className="block text-sm font-bold text-gray-700 mb-1"
              >
                Tanggal Kedaluwarsa
              </label>
              <input
                id="tanggal-expired"
                type="date"
                value={tanggalExpired}
                onChange={(e) => setTanggalExpired(e.target.value)}
                className="w-full border border-gray-300 text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label
                htmlFor="jumlah-ed"
                className="block text-sm font-bold text-gray-700 mb-1"
              >
                Jumlah Barang (Pcs)
              </label>
              <input
                id="jumlah-ed"
                type="number"
                min="1"
                step="1"
                placeholder="Ada berapa barang?"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                className="w-full border border-gray-300 text-black p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loadingSimpan}
              className="w-full bg-orange-500 text-white font-bold p-3 rounded-lg hover:bg-orange-600 transition mt-4 disabled:opacity-50"
            >
              {loadingSimpan ? "Menyimpan..." : "Simpan Expired Date"}
            </button>
          </form>
        )}
      </div>


      {/* POPUP BERHASIL MENYIMPAN */}
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
              Berhasil Disimpan!
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Data expired date berhasil dicatat untuk:
            </p>

            <p className="mt-2 break-words font-bold text-slate-800">
              {savedProductName}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Silakan pilih tindakan selanjutnya.
            </p>

            <div className="mt-6 space-y-3">
              {/* Kembali ke Home */}
              <button
                type="button"
                onClick={() => {
                  setShowSuccess(false);
                  router.push("/");
                }}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white transition hover:bg-emerald-700"
              >
                ← Kembali ke Home
              </button>

              {/* Input barang lagi */}
              <button
                type="button"
                onClick={() => {
                  setShowSuccess(false);
                  setSku("");
                  setProduk(null);
                  setTanggalExpired("");
                  setJumlah("");
                  setScanError("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full rounded-xl border-2 border-orange-500 px-4 py-3 font-bold text-orange-600 transition hover:bg-orange-50"
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
