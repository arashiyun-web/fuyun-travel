"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { formatMoney, type Tour } from "@/lib/tours";
import { SITE } from "@/lib/site";

type Seat = {
  id: string;
  row: number;
  label: string;
  gridColumn: number;
};

const maxSelectedSeats = 4;
const bookedSeats = ["L2W", "R3A", "L5A", "R7W", "B11C"];

function buildSeats() {
  const seats: Seat[] = [];

  for (let row = 1; row <= 10; row += 1) {
    seats.push({ id: `L${row}W`, row, label: `左${row}窗`, gridColumn: 1 });
    seats.push({ id: `L${row}A`, row, label: `左${row}走道`, gridColumn: 2 });

    if (row >= 2) {
      seats.push({ id: `R${row}A`, row, label: `右${row}走道`, gridColumn: 4 });
      seats.push({ id: `R${row}W`, row, label: `右${row}窗`, gridColumn: 5 });
    }
  }

  ["A", "B", "C", "D", "E"].forEach((position, index) => {
    seats.push({ id: `B11${position}`, row: 11, label: `第11排${position}`, gridColumn: index + 1 });
  });

  return seats;
}

function getSeatClass(isBooked: boolean, isLocked: boolean, isSelected: boolean) {
  const baseClass = "min-h-[58px] rounded-md border px-2 py-2 text-xs font-bold leading-5 transition";

  if (isBooked) {
    return `${baseClass} cursor-not-allowed border-stone-300 bg-stone-300 text-stone-500`;
  }

  if (isLocked) {
    return `${baseClass} cursor-not-allowed border-amber-300 bg-amber-200 text-amber-900`;
  }

  if (isSelected) {
    return `${baseClass} border-[#2e6b57] bg-[#3f7f67] text-white shadow-sm`;
  }

  return `${baseClass} border-[#d8ccb2] bg-[#fffaf0] text-[#4a3a1d] hover:-translate-y-0.5 hover:bg-[#f1e7d1]`;
}

export default function SeatBooking({ tour }: { tour: Tour }) {
  const seats = useMemo(buildSeats, []);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [lockedSeats, setLockedSeats] = useState<string[]>([]);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });

  const selectedLabels = selectedSeats.map(
    (seatId) => seats.find((seat) => seat.id === seatId)?.label || seatId
  );
  const total = tour.price * selectedSeats.length;

  function toggleSeat(seatId: string) {
    setSelectedSeats((current) => {
      if (current.includes(seatId)) {
        return current.filter((id) => id !== seatId);
      }

      if (current.length >= maxSelectedSeats) {
        alert("同一筆報名最多只能選擇 4 個座位。");
        return current;
      }

      return [...current, seatId];
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedSeats.length === 0) {
      alert("請至少選擇 1 個座位。");
      return;
    }

    setLockedSeats(selectedSeats);
    setSelectedSeats([]);
    setLockSeconds(15 * 60);

    const timer = window.setInterval(() => {
      setLockSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setLockedSeats([]);
          return 0;
        }

        return seconds - 1;
      });
    }, 1000);
  }

  const lockTime =
    lockSeconds > 0
      ? `${String(Math.floor(lockSeconds / 60)).padStart(2, "0")}:${String(lockSeconds % 60).padStart(2, "0")}`
      : "";

  return (
    <main className="min-h-screen bg-[#f7f3ea] pb-16 pt-16 text-[#242424]">
      <section className="relative overflow-hidden bg-[#2f2f2f]">
        <img src="/hero-bus-sunny.png" alt={`${SITE.name}車輛`} className="h-[360px] w-full object-cover opacity-75" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 to-transparent" />
        <div className="absolute left-1/2 top-12 w-full max-w-7xl -translate-x-1/2 px-4 sm:px-6 lg:px-8">
          <Link href="/itineraries" className="text-sm font-bold text-[#ffe600] hover:text-white">
            返回行程列表
          </Link>
          <p className="mt-8 text-sm font-bold tracking-[0.25em] text-[#ffe600]">
            第三層｜報名選位
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white sm:text-6xl">
            {tour.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/85">
            {tour.summary}
          </p>
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_350px] lg:px-8">
        <div className="space-y-8">
          <form onSubmit={handleSubmit} className="rounded-md border border-[#d8ccb2] bg-white p-6 shadow-[0_18px_45px_rgba(48,39,24,0.12)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[#b89b5e]">BOOKING</p>
                <h2 className="mt-1 text-2xl font-black">{tour.title}</h2>
                <p className="mt-2 text-sm font-bold text-[#6d5c3b]">
                  {tour.departureDate}｜{tour.region}｜{tour.days}天｜{formatMoney(tour.price)} /人
                </p>
              </div>
              <div className="rounded-md bg-[#fffaf0] px-4 py-3 text-right ring-1 ring-[#d8ccb2]">
                <p className="text-xs font-bold text-[#8a7858]">單價</p>
                <p className="text-xl font-black text-[#b26b2f]">{formatMoney(tour.price)} /人</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-bold text-[#6d5c3b]">聯絡人姓名</span>
                <input
                  value={contact.name}
                  onChange={(event) => setContact({ ...contact, name: event.target.value })}
                  required
                  className="mt-2 h-11 w-full rounded-md border border-[#d8ccb2] px-3 outline-none focus:border-[#b89b5e]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-[#6d5c3b]">電話</span>
                <input
                  value={contact.phone}
                  onChange={(event) => setContact({ ...contact, phone: event.target.value })}
                  required
                  inputMode="tel"
                  className="mt-2 h-11 w-full rounded-md border border-[#d8ccb2] px-3 outline-none focus:border-[#b89b5e]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-[#6d5c3b]">Email</span>
                <input
                  value={contact.email}
                  onChange={(event) => setContact({ ...contact, email: event.target.value })}
                  required
                  type="email"
                  className="mt-2 h-11 w-full rounded-md border border-[#d8ccb2] px-3 outline-none focus:border-[#b89b5e]"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4 rounded-md bg-[#fffaf0] p-4 ring-1 ring-[#d8ccb2] sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-[#8a7858]">已選座位</p>
                <p className="mt-1 font-black">{selectedLabels.length ? selectedLabels.join("、") : "尚未選擇"}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-bold text-[#8a7858]">總金額</p>
                <p className="mt-1 text-2xl font-black text-[#b26b2f]">{formatMoney(total)}</p>
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-md bg-[#2f2f2f] px-5 py-3 font-black text-white transition hover:bg-[#b89b5e] hover:text-[#242424]"
            >
              前往付款並鎖定 15 分鐘
            </button>
          </form>

          <section className="rounded-md border border-[#d8ccb2] bg-white p-6 shadow-[0_18px_45px_rgba(48,39,24,0.12)]">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[#b89b5e]">BUS SEAT</p>
                <h2 className="text-2xl font-black">43 人座遊覽車座位表</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-bold">
                <span className="rounded-full bg-[#fffaf0] px-3 py-1 text-[#6d5c3b] ring-1 ring-[#d8ccb2]">可選</span>
                <span className="rounded-full bg-[#3f7f67] px-3 py-1 text-white">已選</span>
                <span className="rounded-full bg-stone-300 px-3 py-1 text-stone-600">已訂</span>
                <span className="rounded-full bg-amber-200 px-3 py-1 text-amber-900">鎖定</span>
              </div>
            </div>
            <div className="mb-4 rounded-md bg-[#2f2f2f] px-4 py-3 text-center font-black text-[#ffe600]">
              車頭（司機座）
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 11 }, (_, index) => index + 1).map((row) => (
                <div key={row} className="contents">
                  {seats
                    .filter((seat) => seat.row === row)
                    .map((seat) => {
                      const isBooked = bookedSeats.includes(seat.id);
                      const isLocked = lockedSeats.includes(seat.id);
                      const isSelected = selectedSeats.includes(seat.id);

                      return (
                        <button
                          key={seat.id}
                          type="button"
                          disabled={isBooked || isLocked}
                          onClick={() => toggleSeat(seat.id)}
                          className={getSeatClass(isBooked, isLocked, isSelected)}
                          style={{ gridColumn: seat.gridColumn }}
                        >
                          {seat.label}
                        </button>
                      );
                    })}
                  {row <= 10 ? (
                    <div
                      className="min-h-[58px] rounded-md border border-dashed border-[#d8ccb2] bg-white"
                      style={{ gridColumn: 3 }}
                    />
                  ) : null}
                  {row === 1 ? (
                    <>
                      <div
                        className="min-h-[58px] rounded-md border border-dashed border-[#d8ccb2] bg-[#fffaf0]"
                        style={{ gridColumn: 4 }}
                      />
                      <div
                        className="min-h-[58px] rounded-md border border-dashed border-[#d8ccb2] bg-[#fffaf0]"
                        style={{ gridColumn: 5 }}
                      />
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-md border border-[#d8ccb2] bg-white p-6 shadow-[0_18px_45px_rgba(48,39,24,0.12)]">
          <p className="text-sm font-bold text-[#b89b5e]">PREVIEW</p>
          <h2 className="mt-1 text-2xl font-black">報名預覽</h2>
          <div className="mt-5 overflow-hidden rounded-md border border-[#d8ccb2]">
            <img src="/hero-bus-sunny.png" alt="行程車輛預覽" className="h-36 w-full object-cover" />
          </div>
          <div className="mt-5 space-y-4 text-sm">
            <div>
              <p className="font-bold text-[#8a7858]">行程</p>
              <p className="mt-1 font-black">{tour.title}</p>
              <p className="mt-1 text-xs font-bold text-[#8a7858]">
                {tour.departureDate} 出發｜{tour.region}｜{tour.days}天
              </p>
            </div>
            <p className="leading-6 text-[#666]">{tour.summary}</p>
            <div className="grid grid-cols-2 gap-3 rounded-md bg-[#fffaf0] p-4 ring-1 ring-[#d8ccb2]">
              <div>
                <p className="text-xs font-bold text-[#8a7858]">姓名</p>
                <p className="font-bold">{contact.name || "尚未填寫"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#8a7858]">電話</p>
                <p className="font-bold">{contact.phone || "尚未填寫"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-bold text-[#8a7858]">Email</p>
                <p className="break-all font-bold">{contact.email || "尚未填寫"}</p>
              </div>
            </div>
            <div className="rounded-md border border-[#d8ccb2] p-4">
              <p className="text-xs font-bold text-[#8a7858]">座位</p>
              <p className="mt-1 font-black">{selectedLabels.length ? selectedLabels.join("、") : "尚未選擇"}</p>
              <p className="mt-4 text-xs font-bold text-[#8a7858]">總金額</p>
              <p className="text-2xl font-black text-[#b26b2f]">{formatMoney(total)}</p>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  lockSeconds > 0 ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-[#666]"
                }`}
              >
                {lockSeconds > 0 ? "座位鎖定中" : "尚未鎖定"}
              </span>
              {lockSeconds > 0 ? (
                <span className="text-xs font-black text-amber-700">鎖定倒數 {lockTime}</span>
              ) : null}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
