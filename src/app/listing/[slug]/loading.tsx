// Instant navigation shell. With this boundary in place, Next can prefetch the
// product route cheaply (the shell is static), so clicking a card paints the layout
// immediately instead of leaving the previous page on screen while the server renders.
export default function ListingLoading() {
  const bar = (w: string, h: number, mt = 0) => (
    <div className="dm-skel" style={{ width: w, height: h, marginTop: mt, borderRadius: 8 }} />
  );

  return (
    <div>
      <div className="container-wide" style={{ paddingTop: 32, paddingBottom: 16 }}>
        {bar("280px", 12)}
      </div>
      <section>
        <div
          className="container-wide"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.1fr) minmax(0,0.9fr)",
            gap: "clamp(28px,4vw,64px)",
            paddingBottom: "clamp(48px,6vw,80px)",
          }}
        >
          <div>
            <div className="dm-skel" style={{ aspectRatio: "1", width: "100%", borderRadius: 2 }} />
            <div className="row gap-3 mt-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="dm-skel" style={{ width: 80, height: 80, borderRadius: 14 }} />
              ))}
            </div>
          </div>
          <div>
            {bar("140px", 22)}
            {bar("85%", 40, 16)}
            {bar("55%", 40, 8)}
            {bar("180px", 18, 24)}
            {bar("120px", 30, 16)}
            {bar("100%", 16, 20)}
            <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginTop: 28 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="dm-skel" style={{ height: 62, borderRadius: 12 }} />
              ))}
            </div>
            {bar("100%", 52, 28)}
            {bar("100%", 14, 24)}
            {bar("90%", 14, 8)}
          </div>
        </div>
      </section>
    </div>
  );
}
