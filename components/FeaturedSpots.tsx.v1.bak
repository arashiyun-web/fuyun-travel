import { prisma } from "@/lib/prisma";

export default async function FeaturedSpots() {
  const spots = await prisma.featuredSpot.findMany({
    where: { status: "published" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="page" aria-label="這裡真好玩">
      <h2>這裡真好玩</h2>
      <p className="lead">浮雲輕鬆遊真實走過的行程分享。</p>

      {spots.length === 0 ? (
        <p className="lead" style={{ padding: "24px 0" }}>
          這裡真好玩專區準備中，敬請期待。
        </p>
      ) : (
        <div className="card-grid">
          {spots.map((spot) => (
            <div className="card" key={spot.id}>
              {spot.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={spot.photoUrl}
                  alt={spot.title}
                  style={{ width: "100%", borderRadius: 8, marginBottom: 12, display: "block" }}
                />
              ) : null}
              <h3>{spot.title}</h3>
              <p>{spot.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
