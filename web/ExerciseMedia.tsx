import React, { useState } from "react";
import { Dumbbell } from "lucide-react";
import type { Exercise } from "../mobile/nfc-task-tracker/lib/coaching-types";
import { imageFrames, positionLabel, thumbnail } from "../mobile/nfc-task-tracker/lib/exercise-media-presentation";
import "./exercise-media.css";

export function ExerciseThumbnail({ exercise }: { exercise: Exercise }) {
  const asset = thumbnail(exercise);
  const [failed, setFailed] = useState("");
  return <span className="exercise-thumbnail" aria-hidden="true">
    {asset && failed !== asset.url ? <img src={asset.url} alt="" width={64} height={64} loading="lazy" decoding="async" onError={() => setFailed(asset.url)} /> : <Dumbbell size={22} />}
  </span>;
}
export function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  return <ExercisePositions key={exercise.id} exercise={exercise} />;
}
function ExercisePositions({ exercise }: { exercise: Exercise }) {
  const frames = imageFrames(exercise);
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const current = frames[selected] ?? frames[0];
  const credits = [...new Map(frames.map((m) => [m.attribution + m.license_url, m])).values()];
  return <section className="exercise-media-view" aria-label={`${exercise.name} pozisyon gösterimi`}>
    {!current ? <p className="exercise-media-empty">Bu hareket için doğrulanmış görsel henüz eklenmedi.</p> : <>
      <div className="exercise-frame-grid">
        {frames.map((frame, i) => <figure key={frame.url} className="exercise-position" data-selected={selected === i}>
          {failed.includes(frame.url) ? <div className="exercise-media-empty" role="status">Görsel yüklenemedi. Egzersizi düzenlemeye devam edebilirsin.<button type="button" onClick={() => setFailed((urls) => urls.filter((url) => url !== frame.url))}>Yeniden dene</button></div> : <img src={frame.url} alt={frame.alt} width={640} height={640} decoding="async" onError={() => setFailed((urls) => [...urls, frame.url])} />}
          <figcaption>{positionLabel(frame, i)}</figcaption>
        </figure>)}
      </div>
      {frames.length > 1 && <div className="exercise-position-controls" role="group" aria-label="Hareket pozisyonu">
        {frames.map((m, i) => <button type="button" key={m.url} aria-pressed={selected === i} onClick={() => setSelected(i)}>{positionLabel(m, i)}</button>)}
      </div>}
      <p className="exercise-media-note">{current.role === "pose" ? "Sabit duruş görseli." : "Pozisyon gösterimi · hareket animasyonu değildir."}</p>
      {credits.map((m) => <p className="exercise-media-credit" key={m.url}><a href={m.source} target="_blank" rel="noreferrer">{m.attribution}</a> · <a href={m.license_url} target="_blank" rel="noreferrer">{m.license}</a></p>)}
    </>}
    {(exercise.media ?? []).filter((m) => ["animation", "video", "model3d"].includes(m.media_type) && m.url.startsWith("https://")).map((m) => <p key={m.url}><a href={m.url} target="_blank" rel="noreferrer">{m.media_type === "video" ? "Hareket videosunu aç" : m.media_type === "animation" ? "Hareket animasyonunu aç" : "3B hareket dosyasını aç"}</a> · {m.attribution} · <a href={m.license_url} target="_blank" rel="noreferrer">{m.license}</a></p>)}
  </section>;
}
