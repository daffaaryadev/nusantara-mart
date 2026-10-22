
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

export default function TambahProduk() {
  const [namaProduct, setNamaProduct] = useState("");
  const [sku, setSku] = useState("");
  const [stokSystem, setStokSystem] = useState("");
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);

  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Siapkan audio saat tombol Scan ditekan.
  // Ini membantu browser mengizinkan suara ketika barcode terbaca.
  const prepareAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
    } catch (error) {
      console.warn("Audio tidak dapat diaktifkan:", error);
    }
  };

  // Bunyi bip ketika barcode berhasil dibaca.
  const playBeep = () => {
    try {
      const audioContext = audioContextRef.current;

      if (!audioContext || audioContext.state !== "running") {
        return;
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        1200,
        audioContext.currentTime
      );

      gainNode.gain.setValueAtTime(
        0.15,
        audioContext.currentTime
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.15
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (error) {
      console.warn("Gagal memutar suara bip:", error);
    }
  };

  // Scanner barcode.
  useEffect(() => {
    if (!isScanning) return;

    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        setScanError("");
        setScanSuccess(false);
        hasScanned.current = false;

        const reader = document.getElementById("reader");

        if (!reader) {
          throw new Error("Area kamera tidak ditemukan.");
        }

        scanner = new Html5Qrcode("reader", {
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

        const cameras = await Html5Qrcode.getCameras();

        if (cancelled) return;

        if (cameras.length === 0) {
          throw new Error(
            "Kamera tidak ditemukan. Periksa izin kamera."
          );
        }

        // Utamakan kamera belakang jika tersedia.
        const camera =
          cameras.find((item) =>
            /back|rear|environment|belakang/i.test(item.label)
          ) ?? cameras[0];

        await scanner.start(
          camera.id,
          {
            fps: 15,
            qrbox: (viewWidth, viewHeight) => ({
              width: Math.floor(viewWidth * 0.9),
              height: Math.min(
                180,
                Math.floor(viewHeight * 0.6)
              ),
            }),
            aspectRatio: 2.5,
          },
          (decodedText) => {
            if (cancelled || hasScanned.current) return;

            hasScanned.current = true;

            // Bunyi bip satu kali.
            playBeep();

            // Masukkan hasil scan ke SKU.
            setSku(decodedText.trim());
            setScanSuccess(true);
            setIsScanning(false);
          },
          () => {
            // Barcode belum terbaca pada frame ini.
            // Scanner terus mencoba membaca frame berikutnya.
          }
        );

        // Jika kamera baru selesai aktif setelah scanner ditutup.
        if (cancelled && scanner.isScanning) {
          await scanner.stop();
          await scanner.clear();
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Gagal menjalankan scanner:", error);

          setScanError(
            error instanceof Error
              ? error.message
              : "Scanner gagal dijalankan."
          );

          setIsScanning(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;

      const activeScanner = scanner;

      const cleanup = async () => {
        if (!activeScanner) return;

        try {
          if (activeScanner.isScanning) {
            await activeScanner.stop();
          }
        } catch (error) {
          console.warn("Gagal menghentikan kamera:", error);
        }

        try {
          await activeScanner.clear();
        } catch (error) {
          console.warn("Gagal membersihkan scanner:", error);
        }

        if (scannerRef.current === activeScanner) {
          scannerRef.current = null;
        }
      };

      void cleanup();
    };
  }, [isScanning]);

  // Tutup AudioContext ketika komponen dilepas.
  useEffect(() => {
    return () => {
      const audioContext = audioContextRef.current;
      audioContextRef.current = null;

      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, []);

  // Simpan produk ke Supabase.
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!sku.trim()) {
      alert("SKU atau barcode wajib diisi.");
      return;
    }

    if (!namaProduct.trim()) {
      alert("Nama produk wajib diisi.");
      return;
    }

    const stok = Number(stokSystem);

    if (!Number.isInteger(stok) || stok < 0) {
      alert("Stok harus berupa bilangan bulat minimal 0.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("products")
        .insert([
          {
            sku: sku.trim(),
            nama_product: namaProduct.trim(),
            stok_system: stok,
          },
        ]);

      if (error) {
        console.error("Supabase error:", error);
        alert("Gagal menyimpan produk: " + error.message);
        return;
      }

      alert("Produk berhasil ditambahkan!");
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Gagal menyimpan produk:", error);
      alert("Terjadi kesalahan saat menyimpan produk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-8 flex flex-col items-center pt-20">
      <style jsx global>{`
        #reader {
          width: 100%;
          border: 2px dashed #3b82f6 !important;
          border-radius: 0.5rem;
          background: #f8fafc;
          overflow: hidden;
        }

        #reader video {
          width: 100% !important;
          object-fit: cover;
        }

        #reader select {
          padding: 0.5rem;
          margin-bottom: 1rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.25rem;
          color: #0f172a !important;
          background: white !important;
          width: 100%;
        }

        #reader button {
          background: #2563eb !important;
          color: white !important;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-weight: bold;
          cursor: pointer;
          border: none;
          margin: 0.5rem 0;
        }
      `}</style>

      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Tambah Produk
          </h1>

          <Link
            href="/"
            className="text-sm font-semibold text-red-500 hover:text-red-700"
          >
            ✕ Batal
          </Link>
        </div>

        {isScanning && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Arahkan kamera ke garis barcode produk.
            </p>

            <div
              id="reader"
              className="w-full overflow-hidden rounded-lg"
            />

            <button
              type="button"
              onClick={() => setIsScanning(false)}
              className="mt-3 w-full text-red-500 font-bold p-2 text-sm bg-red-50 rounded-lg"
            >
              Tutup Kamera
            </button>
          </div>
        )}

        {scanError && (
          <p className="mb-4 text-sm text-red-600">
            {scanError}
          </p>
        )}

        {scanSuccess && sku && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            <strong>✓ Barcode berhasil dibaca!</strong>
            <p>SKU: {sku}</p>
            <p>Suara bip telah dipanggil.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              SKU / Barcode
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Scan atau ketik SKU..."
                value={sku}
                onChange={(e) => {
                  setSku(e.target.value);
                  setScanSuccess(false);
                }}
                className="w-full min-w-0 border border-gray-300 bg-gray-50 text-black p-3 rounded-lg"
                required
              />

              <button
                type="button"
                disabled={isScanning}
                onClick={() => {
                  setScanError("");
                  setScanSuccess(false);

                  // Siapkan audio melalui interaksi pengguna.
                  void prepareAudio();

                  setIsScanning(true);
                }}
                className="bg-gray-800 text-white px-4 rounded-lg font-bold disabled:opacity-50"
              >
                📷 Scan
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Tekan Scan, lalu arahkan kamera ke barcode produk.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Nama Produk
            </label>

            <input
              type="text"
              value={namaProduct}
              onChange={(e) => setNamaProduct(e.target.value)}
              placeholder="Contoh: Indomie Goreng Spesial"
              className="w-full border border-gray-300 bg-gray-50 text-black p-3 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Stok Awal (Sistem)
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={stokSystem}
              onChange={(e) => setStokSystem(e.target.value)}
              placeholder="Contoh: 100"
              className="w-full border border-gray-300 bg-gray-50 text-black p-3 rounded-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold p-3 rounded-lg disabled:bg-gray-400"
          >
            {loading ? "Menyimpan Data..." : "Simpan Produk"}
          </button>
        </form>
      </div>
    </main>
  );
}
