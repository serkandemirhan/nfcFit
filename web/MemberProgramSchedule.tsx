import React, { useEffect, useState } from "react";
import type {
  CoachingOverview,
  Exercise,
} from "../mobile/nfc-task-tracker/lib/coaching-types";
import { zonedDate } from "../mobile/nfc-task-tracker/lib/coaching-performance";
import "./trainer-planning.css";
export default function MemberProgramSchedule({ token }: { token: string }) {
  const [data, setData] = useState<CoachingOverview | null>(null),
    [catalog, setCatalog] = useState<Exercise[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("");
  useEffect(() => {
    let live = true;
    const base =
      (import.meta.env.VITE_CONSOLE_API_URL ?? "").replace(/\/+$/, "") +
      "/api/console/coaching";
    Promise.all(
      ["/overview", "/library"].map((path) =>
        fetch(base + path, {
          headers: { Authorization: "Bearer " + token },
        }).then(async (r) => {
          if (!r.ok)
            throw new Error(
              "Program alınamadı. Sayfayı yenileyerek tekrar dene.",
            );
          return r.json();
        }),
      ),
    )
      .then(([d, c]) => {
        if (live) {
          setData(d);
          setCatalog(c);
          setSelected(zonedDate(new Date(), d.timezone));
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Programın yükleniyor…</p>;
  const plans = data.plans.filter(
    (p) =>
      p.athlete_id === data.account_id &&
      (p.content.planning_status ?? "published") === "published",
  );
  return (
    <section className="tp lg:col-span-2">
      <header className="tp-heading">
        <div>
          <p className="tp-eyebrow">ÜYE · ANTRENMAN TAKVİMİ</p>
          <h2>Programım</h2>
          <p>Antrenörünün sana atadığı kişisel program ve günlük hedefler.</p>
        </div>
        <label className="tp-field">
          Günü seç
          <input
            type="date"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          />
        </label>
      </header>
      {!plans.length && <p>Henüz atanmış programın yok.</p>}
      {plans.map((p) => (
        <article className="tp-panel" key={p.id}>
          <div className="tp-inline">
            <h3>{p.content.name}</h3>
            <span className="tp-badge">
              {p.content.weeks} hafta · {p.content.start_date}
            </span>
          </div>
          <p>{p.content.goal}</p>
          <h3>
            {selected === zonedDate(new Date(), data.timezone)
              ? "Bugün"
              : selected}
          </h3>
          {p.content.days
            .filter((d) => d.dates.includes(selected))
            .map((d) => (
              <div className="tp-scheduled" key={d.id}>
                <h3>{d.name}</h3>
                {d.exercises.map((e) => (
                  <div key={e.id}>
                    <strong>
                      {catalog.find((x) => x.id === e.exercise_id)?.name ??
                        e.exercise_id}
                    </strong>
                    <p>
                      {e.sets} × {e.reps ?? e.seconds ?? e.meters}{" "}
                      {e.reps ? "tekrar" : e.seconds ? "sn" : "m"} ·{" "}
                      {e.rest_seconds} sn dinlenme
                      {e.kg != null ? " · " + e.kg + " kg" : ""}
                    </p>
                    {e.notes && <small>{e.notes}</small>}
                  </div>
                ))}
              </div>
            ))}
          {!p.content.days.some((d) => d.dates.includes(selected)) && (
            <p className="tp-muted">
              {p.content.rest_dates?.includes(selected)
                ? "Dinlenme günü"
                : "Bu tarihte planlanmış antrenman yok."}
            </p>
          )}
          <details>
            <summary>Program takvimini göster</summary>
            {p.content.days.flatMap((d) =>
              d.dates.map((dt) => (
                <button
                  key={d.id + dt}
                  style={{ margin: "8px" }}
                  onClick={() => setSelected(dt)}
                >
                  {dt} · {d.name}
                </button>
              )),
            )}
          </details>
          <small>
            Set kaydı ve NFC ile antrenman için NFCFit mobil uygulamasını
            kullan.
          </small>
        </article>
      ))}
    </section>
  );
}
