import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BusFront, Images } from "lucide-react";
import { pageMeta } from "@/lib/site";
import { fleetItems } from "@/lib/siteContent";
import styles from "./Fleet.module.css";

export const metadata: Metadata = pageMeta({
  title: "車隊介紹",
  description: "MAN、Scania K400、Scania K380、Hino、Daewoo 等車型介紹，支援遊覽車包車、企業旅遊與校外教學。",
  path: "/fleet",
});

export default function FleetPage() {
  const photographed = fleetItems.find((vehicle) => vehicle.slug === "coach-42");
  const otherVehicles = fleetItems.filter((vehicle) => vehicle.slug !== "coach-42");

  return (
    <div className={styles.fleet}>
      <header className={styles.heading}>
        <span className={styles.eyebrow}>雲陞通運 · 車隊介紹</span>
        <h1>好旅程，從坐得舒服開始。</h1>
        <p>從團體規模、路線到行李需求，找適合這趟旅程的車。想看實車細節，先從我們的 42 人座遊覽車認識起。</p>
      </header>

      {photographed ? (
        <section className={styles.feature} aria-labelledby="fleet-feature-title">
          <div className={styles.featureMedia}>
            <img
              className={styles.featurePhoto}
              src={photographed.photos?.[0]}
              alt="雲陞通運 42 人座遊覽車實車外觀"
            />
            <span className={styles.photoTag}><Images size={15} aria-hidden="true" /> 實車照片</span>
          </div>
          <div className={styles.featureContent}>
            <span className={styles.sectionLabel}>認識我們的遊覽車</span>
            <h2 id="fleet-feature-title">{photographed.title}</h2>
            <p>{photographed.summary}</p>
            <div className={styles.interiorPhotos}>
              {photographed.photos?.slice(1).map((photo, index) => (
                <img
                  key={photo}
                  src={photo}
                  alt={`雲陞通運 42 人座遊覽車車內實景 ${index + 1}`}
                  loading="lazy"
                />
              ))}
            </div>
            <Link className={styles.featureLink} href={`/fleet/${photographed.slug}`}>
              查看車輛照片與介紹 <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className={styles.collection} aria-labelledby="fleet-collection-title">
        <div className={styles.collectionHeading}>
          <div>
            <span className={styles.sectionLabel}>依行程挑選</span>
            <h2 id="fleet-collection-title">更多車型</h2>
          </div>
          <p>告訴我們出發日期、人數與行程，由專人確認實際可安排的車輛。</p>
        </div>
        <div className={styles.vehicleGrid}>
          {otherVehicles.map((vehicle) => {
            const Icon = vehicle.icon;
            return (
              <Link className={styles.vehicle} href={`/fleet/${vehicle.slug}`} key={vehicle.slug}>
                <span className={styles.vehicleIcon}><Icon size={26} strokeWidth={1.6} aria-hidden="true" /></span>
                <span className={styles.vehicleBody}>
                  <strong>{vehicle.title}</strong>
                  <span>{vehicle.summary}</span>
                  <span className={styles.vehicleAction}>了解車型 <ArrowRight size={16} aria-hidden="true" /></span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <aside className={styles.cta}>
        <BusFront size={29} strokeWidth={1.5} aria-hidden="true" />
        <div><strong>需要安排團體用車？</strong><span>提供人數與路線，我們協助確認車型及報價。</span></div>
        <Link href="/contact/inquiry">詢問適合車型 <ArrowRight size={17} aria-hidden="true" /></Link>
      </aside>
    </div>
  );
}
