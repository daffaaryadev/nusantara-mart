
"use client";

import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type EditType = "so" | "ed";

export default function LaporanDashboard() {
  const [riwayatSO, setRiwayatSO] = useState<any[]>([]);
  const [listExpired, setListExpired] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [editType, setEditType] = useState<EditType | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [editStokFisik, setEditStokFisik] = useState("");
  const [editJumlah, setEditJumlah] = useState("");
  const [editTanggal, setEditTanggal] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Mengambil riwayat Stock Opname dan data Expired
  const fetchData = async () => {
    setLoading(true);

    try {
      const [{ data: soData, error: soError }, { data: edData, error: edError }] =
        await Promise.all([
          supabase
            .from("stock_opname")
            .select("*")
            .order("id", { ascending: false }),
          supabase
            .from("expired_dates")
            .select("*")
            .order("tanggal_expired", { ascending: true }),
        ]);

      if (soError) throw soError;
      if (edError) throw edError;

      setRiwayatSO(soData ?? []);
      setListExpired(edData ?? []);
    } catch (error: any) {
      console.error("Gagal mengambil laporan:", error);
      alert("Gagal memuat laporan: " + (error.message ?? "Kesalahan tidak diketahui"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  // Scanner barcode
  useEffect(() => {
    if (!scannerOpen) return;

    let scanner: Html5Qrcode | null = null;
    let cancelled = false;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode("laporan-barcode-reader");

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (cancelled) return;
            setSearchTerm(decodedText.trim());
            setScannerOpen(false);
          },
          () => {}
        );
      } catch (error) {
        console.error("Scanner gagal:", error);

        if (!cancelled) {
          alert(
            "Kamera gagal dibuka. Izinkan akses kamera dan gunakan HTTPS atau localhost."
          );
          setScannerOpen(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;

      if (scanner) {
        void scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            scanner?.clear();
          });
      }
    };
  }, [scannerOpen]);

  // Hapus riwayat SO
  const hapusSO = async (id: number) => {
    if (!confirm("Yakin ingin menghapus riwayat SO ini?")) return;

    const { error } = await supabase
      .from("stock_opname")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Gagal menghapus: " + error.message);
    } else {
      await fetchData();
    }
  };

  // Hapus data Expired
  const hapusED = async (id: number) => {
    if (!confirm("Yakin ingin menghapus data Expired ini?")) return;

    const { error } = await supabase
      .from("expired_dates")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Gagal menghapus: " + error.message);
    } else {
      await fetchData();
    }
  };

  // Buka popup edit Stock Opname
  const bukaEditSO = (item: any) => {
    setEditType("so");
    setEditItem(item);
    setEditStokFisik(String(item.stok_fisik ?? 0));
  };

  // Buka popup edit Expired
  const bukaEditED = (item: any) => {
    setEditType("ed");
    setEditItem(item);
    setEditJumlah(String(item.jumlah ?? 1));
    setEditTanggal(item.tanggal_expired ?? "");
  };

  const tutupEdit = () => {
    if (savingEdit) return;
    setEditType(null);
    setEditItem(null);
  };

  // Simpan edit ke Supabase
  const simpanEdit = async () => {
    if (!editItem || !editType || savingEdit) return;

    setSavingEdit(true);

    try {
      if (editType === "so") {
        const fisik = Number(editStokFisik);

        if (!Number.isInteger(fisik) || fisik < 0) {
          alert("Stok fisik harus bilangan bulat minimal 0.");
          return;
        }

        const selisihBaru = fisik - Number(editItem.stok_sistem);

        const { error } = await supabase
          .from("stock_opname")
          .update({
            stok_fisik: fisik,
            selisih: selisihBaru,
          })
          .eq("id", editItem.id);

        if (error) throw error;
      } else {
        const jumlah = Number(editJumlah);

        if (!Number.isInteger(jumlah) || jumlah <= 0) {
          alert("Jumlah harus bilangan bulat lebih dari 0.");
          return;
        }

        if (!editTanggal || !/^\d{4}-\d{2}-\d{2}$/.test(editTanggal)) {
          alert("Tanggal expired wajib diisi dengan format yang benar.");
          return;
        }

        const { error } = await supabase
          .from("expired_dates")
          .update({
            jumlah,
            tanggal_expired: editTanggal,
          })
          .eq("id", editItem.id);

        if (error) throw error;
      }

      setEditType(null);
      setEditItem(null);
      await fetchData();
    } catch (error: any) {
      alert("Gagal menyimpan: " + (error.message ?? "Kesalahan tidak diketahui"));
    } finally {
      setSavingEdit(false);
    }
  };

  // Hitung sisa hari sampai expired
  const getSisaHari = (tanggalStr: string) => {
    if (!tanggalStr) return 0;

    const [tahun, bulan, hari] = tanggalStr.split("-").map(Number);
    const tanggalExp = Date.UTC(tahun, bulan - 1, hari);
    const sekarang = new Date();
    const hariIni = Date.UTC(
      sekarang.getFullYear(),
      sekarang.getMonth(),
      sekarang.getDate()
    );

    return Math.round((tanggalExp - hariIni) / 86400000);
  };

  const getStatusExpired = (sisaHari: number) => {
    if (sisaHari < 0) {
      return {
        label: `LEWAT ${Math.abs(sisaHari)} HARI`,
        bg: "bg-rose-600 text-white font-bold",
      };
    }

    if (sisaHari === 0) {
      return {
        label: "EXPIRED HARI INI!",
        bg: "bg-rose-500 text-white font-bold animate-pulse",
      };
    }

    if (sisaHari <= 7) {
      return {
        label: `Sisa ${sisaHari} Hari lagi`,
        bg: "bg-amber-500 text-white font-bold",
      };
    }

    if (sisaHari <= 30) {
      return {
        label: `Sisa ${sisaHari} Hari`,
        bg: "bg-amber-100 text-amber-800 font-semibold",
      };
    }

    return {
      label: `Sisa ${sisaHari} Hari`,
      bg: "bg-emerald-100 text-emerald-800 font-medium",
    };
  };

  // Filter Stock Opname
  const filteredSO = riwayatSO.filter((item) => {
    const matchSKU = String(item.sku ?? "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const itemDate = item.created_at
      ? String(item.created_at).split("T")[0]
      : "";

    const matchStart = startDate ? itemDate >= startDate : true;
    const matchEnd = endDate ? itemDate <= endDate : true;

    return matchSKU && matchStart && matchEnd;
  });

  // Filter Expired berdasarkan tanggal expired
  const filteredED = listExpired
    .filter((item) => {
      const matchSKU = String(item.sku ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const itemDate = item.tanggal_expired ?? "";
      const matchStart = startDate ? itemDate >= startDate : true;
      const matchEnd = endDate ? itemDate <= endDate : true;

      return matchSKU && matchStart && matchEnd;
    })
    .sort(
      (a, b) =>
        new Date(a.tanggal_expired).getTime() -
        new Date(b.tanggal_expired).getTime()
    );

  const barangSudahExpired = filteredED.filter(
    (item) => getSisaHari(item.tanggal_expired) <= 0
  );

  const barangMendekatiExpired = filteredED.filter(
    (item) => getSisaHari(item.tanggal_expired) > 0
  );

  const resetFilter = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  const tombolEdit =
    "rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100";
  const tombolHapus =
    "rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100";

  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              📊 Dashboard Laporan Admin
            </h1>
            <p className="text-xs text-slate-500 sm:text-sm">
              Monitoring riwayat SO dan barang kedaluwarsa
            </p>
          </div>

          <Link
            href="/"
            className="shrink-0 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            Kembali ke Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:px-6">
        {/* FILTER */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-700">
            Filter Laporan
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Cari atau Scan SKU
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2M3 17v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2v-2M7 12h10M7 9v6m3-6v6m4-6v6"
                    />
                  </svg>
                  Scan
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Sampai Tanggal
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />

                {(searchTerm || startDate || endDate) && (
                  <button
                    onClick={resetFilter}
                    className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center font-semibold text-slate-500">
            Memuat laporan...
          </div>
        ) : (
          <div className="space-y-6">
            {/* BARANG SUDAH EXPIRED */}
            <section className="rounded-2xl border-2 border-rose-300 bg-rose-50/70 p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-rose-900">
                  🚨 Barang Sudah Kedaluwarsa
                </h2>
                <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
                  {barangSudahExpired.length} Data
                </span>
              </div>

              {barangSudahExpired.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-white/80 p-4 text-center text-sm font-medium text-emerald-700">
                  ✅ Tidak ada barang yang sudah kedaluwarsa sesuai filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {barangSudahExpired.map((item) => {
                    const status = getStatusExpired(
                      getSisaHari(item.tanggal_expired)
                    );

                    return (
                      <article
                        key={item.id}
                        className="flex flex-col justify-between rounded-xl border border-rose-200 bg-white p-4"
                      >
                        <div>
                          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900">
                              SKU: {item.sku}
                            </p>
                            <span
                              className={`rounded-md px-2 py-1 text-[10px] ${status.bg}`}
                            >
                              {status.label}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-rose-600">
                            Tanggal Exp: {item.tanggal_expired}
                          </p>
                          <p className="mt-2 text-sm font-bold text-slate-700">
                            {item.jumlah} Pcs
                          </p>
                        </div>

                        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                          <button
                            onClick={() => bukaEditED(item)}
                            className={tombolEdit}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => hapusED(item.id)}
                            className={tombolHapus}
                          >
                            Hapus
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* MENDEKATI EXPIRED DAN RIWAYAT SO */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 border-t-4 border-t-amber-500 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      ⏳ Mendekati Kedaluwarsa
                    </h2>
                    <p className="text-xs text-slate-400">
                      Barang yang akan kedaluwarsa
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {barangMendekatiExpired.length} Data
                  </span>
                </div>

                {barangMendekatiExpired.length === 0 ? (
                  <p className="py-6 text-center text-sm italic text-slate-400">
                    Tidak ada barang mendekati kedaluwarsa.
                  </p>
                ) : (
                  <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1">
                    {barangMendekatiExpired.map((item) => {
                      const status = getStatusExpired(
                        getSisaHari(item.tanggal_expired)
                      );

                      return (
                        <article
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                SKU: {item.sku}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Exp: {item.tanggal_expired}
                              </p>
                              <p className="mt-2 text-sm font-bold text-slate-700">
                                {item.jumlah} Pcs
                              </p>
                            </div>

                            <span
                              className={`rounded-md px-2 py-1 text-[10px] ${status.bg}`}
                            >
                              {status.label}
                            </span>
                          </div>

                          <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
                            <button
                              onClick={() => bukaEditED(item)}
                              className={tombolEdit}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => hapusED(item.id)}
                              className={tombolHapus}
                            >
                              Hapus
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* RIWAYAT STOCK OPNAME */}
              <section className="rounded-2xl border border-slate-200 border-t-4 border-t-blue-500 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      📋 Riwayat Stock Opname
                    </h2>
                    <p className="text-xs text-slate-400">
                      Selisih stok fisik dan sistem
                    </p>
                  </div>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {filteredSO.length} Data
                  </span>
                </div>

                {filteredSO.length === 0 ? (
                  <p className="py-6 text-center text-sm italic text-slate-400">
                    Tidak ada riwayat SO ditemukan.
                  </p>
                ) : (
                  <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1">
                    {filteredSO.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              SKU: {item.sku}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                              Sistem: {item.stok_sistem} | Fisik:{" "}
                              <strong className="text-slate-800">
                                {item.stok_fisik}
                              </strong>
                            </p>
                          </div>

                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                              item.selisih < 0
                                ? "bg-rose-100 text-rose-600"
                                : item.selisih > 0
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            Selisih: {item.selisih}
                          </span>
                        </div>

                        <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3">
                          <button
                            onClick={() => bukaEditSO(item)}
                            className={tombolEdit}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => hapusSO(item.id)}
                            className={tombolHapus}
                          >
                            Hapus
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      {/* MODAL SCANNER */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Scan Barcode
                </h2>
                <p className="text-xs text-slate-500">
                  Arahkan kamera ke barcode SKU produk
                </p>
              </div>
              <button
                onClick={() => setScannerOpen(false)}
                className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100"
                aria-label="Tutup scanner"
              >
                ×
              </button>
            </div>

            <div
              id="laporan-barcode-reader"
              className="min-h-48 w-full overflow-hidden rounded-xl bg-slate-100"
            />

            <button
              onClick={() => setScannerOpen(false)}
              className="mt-4 w-full rounded-xl bg-slate-100 py-3 font-semibold text-slate-700 hover:bg-slate-200"
            >
              Tutup Kamera
            </button>
          </section>
        </div>
      )}

      {/* MODAL EDIT */}
      {editType && editItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={tutupEdit}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2
                  id="edit-modal-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Edit{" "}
                  {editType === "so"
                    ? "Stock Opname"
                    : "Data Kedaluwarsa"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  SKU: {editItem.sku}
                </p>
              </div>

              <button
                onClick={tutupEdit}
                disabled={savingEdit}
                className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Tutup popup"
              >
                ×
              </button>
            </div>

            {editType === "so" ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-sm text-slate-500">Stok Sistem</p>
                  <p className="mt-1 text-2xl font-extrabold text-blue-700">
                    {editItem.stok_sistem} Pcs
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Stok Fisik
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editStokFisik}
                    onChange={(e) => setEditStokFisik(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-sm text-slate-500">
                    Selisih setelah disimpan
                  </p>
                  <p className="mt-1 text-2xl font-bold text-blue-700">
                    {(Number(editStokFisik) || 0) -
                      Number(editItem.stok_sistem)}{" "}
                    Pcs
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Jumlah Barang (Pcs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editJumlah}
                    onChange={(e) => setEditJumlah(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Tanggal Kedaluwarsa
                  </label>
                  <input
                    type="date"
                    value={editTanggal}
                    onChange={(e) => setEditTanggal(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </div>
              </div>
            )}

            <div className="mt-7 flex gap-3">
              <button
                disabled={savingEdit}
                onClick={tutupEdit}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                disabled={savingEdit}
                onClick={simpanEdit}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
