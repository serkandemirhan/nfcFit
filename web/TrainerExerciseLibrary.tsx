import React, { useMemo, useState, useRef } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { ExerciseMedia, ExerciseThumbnail } from "./ExerciseMedia";
import type { Exercise } from "../mobile/nfc-task-tracker/lib/coaching-types";
import { exerciseSearchText } from "./lib/trainer-planning";
import {
  Button,
  Input,
  Badge,
  Label,
  NativeSelect,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "./components/trainer-ui/primitives";
import { DataTable } from "./components/trainer-ui/data-table";
export default function TrainerExerciseLibrary({
  catalog,
  onWorkouts,
}: {
  catalog: Exercise[];
  onWorkouts: (exerciseId?: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [muscle, setMuscle] = useState(""),
    [equipment, setEquipment] = useState(""),
    [selected, setSelected] = useState<Exercise | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openExercise = (exercise: Exercise) => {
    opener.current = document.activeElement as HTMLElement;
    setSelected(exercise);
  };
  const filtered = catalog.filter(
    (e) =>
      exerciseSearchText(e.name + " " + e.name_en).includes(
        exerciseSearchText(query),
      ) &&
      (!muscle || e.muscle === muscle) &&
      (!equipment || e.equipment === equipment),
  );
  const columns = useMemo<ColumnDef<Exercise>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Egzersiz",
        cell: ({ row }) => (
          <div className="nfc-exercise-name">
            <ExerciseThumbnail exercise={row.original} />
            <div>
              <strong>{row.original.name}</strong>
              <small>{row.original.name_en}</small>
            </div>
          </div>
        ),
      },
      { accessorKey: "muscle", header: "Kas grubu" },
      { accessorKey: "equipment", header: "Ekipman" },
      {
        id: "action",
        header: "İşlem",
        cell: ({ row }) => (
          <Button
            variant="outline"
            onClick={() => openExercise(row.original)}
            aria-label={row.original.name + " detayları"}
          >
            İncele
          </Button>
        ),
      },
    ],
    [],
  );
  return (
    <section className="nfc-library" aria-label="Egzersiz kataloğu">
      <div className="nfc-section-toolbar">
        <div>
          <Badge>{catalog.length} egzersiz</Badge>
          <p>Kulübünün erişebildiği hareket kataloğu</p>
        </div>
        <Button onClick={() => onWorkouts()}>Antrenman oluştur</Button>
      </div>
      <div className="nfc-filter-bar">
        <div>
          <Label htmlFor="catalog-query">Egzersiz ara</Label>
          <div className="nfc-search-input">
            <Search size={18} />
            <Input
              id="catalog-query"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ad veya hareket ara…"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="catalog-muscle">Kas grubu</Label>
          <NativeSelect
            id="catalog-muscle"
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
          >
            <option value="">Tümü</option>
            {[...new Set(catalog.map((e) => e.muscle))].sort().map((v) => (
              <option key={v}>{v}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="catalog-equipment">Ekipman</Label>
          <NativeSelect
            id="catalog-equipment"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          >
            <option value="">Tümü</option>
            {[...new Set(catalog.map((e) => e.equipment))].sort().map((v) => (
              <option key={v}>{v}</option>
            ))}
          </NativeSelect>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setQuery("");
            setMuscle("");
            setEquipment("");
          }}
        >
          Temizle
        </Button>
      </div>
      <DataTable columns={columns} data={filtered} label="Egzersiz listesi" />
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="nfc-exercise-detail"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          {selected && (
            <>
              <header>
                <div>
                  <DialogTitle>{selected.name}</DialogTitle>
                  <DialogDescription>
                    {selected.name_en} · {selected.muscle} ·{" "}
                    {selected.equipment}
                  </DialogDescription>
                </div>
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Detayları kapat"
                  >
                    <X size={20} />
                  </Button>
                </DialogClose>
              </header>
              <div className="nfc-detail-body">
                <ExerciseMedia exercise={selected} />
                <p>{selected.description}</p>
                <h3>Uygulama adımları</h3>
                {selected.instructions.length ? (
                  <ol>
                    {selected.instructions.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ol>
                ) : (
                  <p>Bu hareket için henüz uygulama adımı eklenmemiş.</p>
                )}
                {selected.safety.length > 0 && (
                  <>
                    <h3>Dikkat edilmesi gerekenler</h3>
                    <ul>
                      {selected.safety.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <footer>
                <Button
                  onClick={() => {
                    setSelected(null);
                    onWorkouts(selected.id);
                  }}
                >
                  Antrenmanda kullan
                </Button>
              </footer>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
