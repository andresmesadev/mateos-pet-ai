"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PetTimeline } from "@/components/dashboard/pet-timeline";
import { VetConsultationDialog } from "@/components/dashboard/vet-consultation-dialog";
import { proxyUrl } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import {
  type DashboardPet,
  type MedicalRecordType,
  type PetTimeline as PetTimelineData,
  formatPetType,
  getPetEmoji,
} from "@/lib/pets";

type PetMedicalSheetProps = {
  pet: DashboardPet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecordAdded?: () => void;
};

type AddRecordForm = {
  type: MedicalRecordType;
  title: string;
  detail: string;
  date: string;
};

const INITIAL_FORM: AddRecordForm = {
  type: "note",
  title: "",
  detail: "",
  date: "",
};

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

type PetProfileForm = {
  breed: string;
  gender: string;
  birthDate: string;
  weight: string;
  sterilized: string;
  notes: string;
};

type PetMedicalSheetContentProps = {
  pet: DashboardPet;
  onRecordAdded?: () => void;
};

function PetMedicalSheetContent({ pet, onRecordAdded }: PetMedicalSheetContentProps) {
  const { toast } = useToast();
  const [timeline, setTimeline] = useState<PetTimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<"vaccine" | "deworming" | "grooming" | "allergy" | "note" | null>(null);
  const [showConsultation, setShowConsultation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AddRecordForm>(INITIAL_FORM);
  const [vaccineNextDate, setVaccineNextDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState<Partial<DashboardPet>>({
    breed: pet.breed,
    gender: pet.gender,
    birthDate: pet.birthDate,
    weight: pet.weight,
    sterilized: pet.sterilized,
    notes: pet.notes,
  });
  const [profileForm, setProfileForm] = useState<PetProfileForm>({
    breed: pet.breed ?? "",
    gender: pet.gender ?? "",
    birthDate: pet.birthDate ? pet.birthDate.slice(0, 10) : "",
    weight: pet.weight != null ? String(pet.weight) : "",
    sterilized: pet.sterilized != null ? String(pet.sterilized) : "",
    notes: pet.notes ?? "",
  });

  const reloadTimeline = useCallback(async () => {
    const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}/timeline`), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("No se pudo cargar el historial");
    return (await res.json()) as PetTimelineData;
  }, [pet.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setLoading(true);
      try {
        const data = await reloadTimeline();
        if (!cancelled) { setTimeline(data); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar historial");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTimeline]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          breed: profileForm.breed || null,
          gender: profileForm.gender || null,
          birthDate: profileForm.birthDate || null,
          weight: profileForm.weight ? Number(profileForm.weight) : null,
          sterilized:
            profileForm.sterilized === "true"
              ? true
              : profileForm.sterilized === "false"
                ? false
                : null,
          notes: profileForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const updated = await res.json();
      setProfile(updated);
      setEditingProfile(false);
      toast("Ficha guardada.", "success");
    } catch (err) {
      console.error(err);
      toast("No se guardó. Intenta de nuevo.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) { setFormError("El título es obligatorio"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}/records`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          title,
          detail: form.detail.trim() || null,
          date: form.date || null,
          nextControlAt: (form.type === "vaccine" || form.type === "deworming" || form.type === "grooming") && vaccineNextDate ? vaccineNextDate : null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo guardar el registro");
      }
      setForm(INITIAL_FORM);
      setVaccineNextDate("");
      setActiveForm(null);
      const data = await reloadTimeline();
      setTimeline(data);
      onRecordAdded?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar registro");
    } finally {
      setSaving(false);
    }
  };

  const totalItems = (timeline?.items.length ?? 0);

  return (
    <>
      <DialogHeader className="shrink-0 border-b px-4 py-4">
        <DialogTitle className="flex items-center gap-2 text-xl">
          <span>{getPetEmoji(pet.type)}</span>
          <span>{pet.name}</span>
        </DialogTitle>
        <DialogDescription>
          {formatPetType(pet.type)} · Dueño: {pet.owner.phone}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{totalItems} eventos en historial</Badge>
          <Badge variant="outline">{pet._count.appointments} citas</Badge>
          <a
            href={`/print/pets/${pet.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto"
          >
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Exportar ficha PDF
            </Button>
          </a>
        </div>

        {/* Ficha de la mascota */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Ficha</p>
            {!editingProfile && (
              <Button size="sm" variant="outline" onClick={() => setEditingProfile(true)}>
                Editar
              </Button>
            )}
          </div>
          {editingProfile ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Input
                placeholder="Raza"
                value={profileForm.breed}
                onChange={(e) => setProfileForm((f) => ({ ...f, breed: e.target.value }))}
              />
              <select
                value={profileForm.gender}
                onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Sexo</option>
                <option value="male">Macho</option>
                <option value="female">Hembra</option>
              </select>
              <Input
                type="date"
                value={profileForm.birthDate}
                onChange={(e) => setProfileForm((f) => ({ ...f, birthDate: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Peso (kg)"
                value={profileForm.weight}
                onChange={(e) => setProfileForm((f) => ({ ...f, weight: e.target.value }))}
              />
              <select
                value={profileForm.sterilized}
                onChange={(e) => setProfileForm((f) => ({ ...f, sterilized: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Esterilizado/a</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
              <Input
                placeholder="Notas"
                value={profileForm.notes}
                onChange={(e) => setProfileForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? "Guardando…" : "Guardar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingProfile(false)}
                  disabled={savingProfile}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-1">
              {profile.breed && (
                <p><span className="text-muted-foreground">Raza: </span>{profile.breed}</p>
              )}
              {profile.gender && (
                <p>
                  <span className="text-muted-foreground">Sexo: </span>
                  {profile.gender === "male" ? "Macho" : "Hembra"}
                </p>
              )}
              {profile.birthDate && (
                <p>
                  <span className="text-muted-foreground">Nacimiento: </span>
                  {new Date(profile.birthDate).toLocaleDateString("es-CO")}
                </p>
              )}
              {profile.weight != null && (
                <p><span className="text-muted-foreground">Peso: </span>{profile.weight} kg</p>
              )}
              {profile.sterilized != null && (
                <p>
                  <span className="text-muted-foreground">Esterilizado/a: </span>
                  {profile.sterilized ? "Sí" : "No"}
                </p>
              )}
              {profile.notes && (
                <p><span className="text-muted-foreground">Notas: </span>{profile.notes}</p>
              )}
              {!profile.breed && !profile.gender && !profile.birthDate &&
                profile.weight == null && profile.sterilized == null && !profile.notes && (
                <p className="text-muted-foreground">Sin datos adicionales.</p>
              )}
            </div>
          )}
        </div>

        {/* Botones de registro */}
        {!activeForm && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setShowConsultation(true)} className="gap-1.5">
              🩺 Consulta
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setActiveForm("vaccine"); setForm({ ...INITIAL_FORM, type: "vaccine" }); }} className="gap-1.5">
              💉 Vacuna
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setActiveForm("deworming"); setForm({ ...INITIAL_FORM, type: "deworming" }); }} className="gap-1.5">
              💊 Desparasitación
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setActiveForm("allergy"); setForm({ ...INITIAL_FORM, type: "allergy" }); }} className="gap-1.5">
              🤧 Alergia
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setActiveForm("grooming"); setForm({ ...INITIAL_FORM, type: "note" }); }} className="gap-1.5">
              ✂️ Peluquería
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setActiveForm("note"); setForm({ ...INITIAL_FORM, type: "note" }); }} className="gap-1.5">
              📝 Nota
            </Button>
          </div>
        )}

        {activeForm === "vaccine" && (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-semibold">💉 Nueva vacuna</p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nombre de la vacuna *</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej. Antirrábica, Parvovirus, Moquillo…" autoFocus disabled={saving} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fecha de aplicación</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={saving} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Próxima vacunación</label>
                <Input type="date" value={vaccineNextDate} onChange={(e) => setVaccineNextDate(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Laboratorio / Lote (opcional)</label>
              <Input value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} placeholder="Ej. Nobivac, Lote 1234…" disabled={saving} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando…" : "Guardar vacuna"}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => { setActiveForm(null); setForm(INITIAL_FORM); setVaccineNextDate(""); setFormError(null); }}>Cancelar</Button>
            </div>
          </form>
        )}

        {activeForm === "deworming" && (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-semibold">💊 Nueva desparasitación</p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Producto / Nombre *</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej. Milbemax, Drontal, Nexgard Spectra…" autoFocus disabled={saving} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fecha de aplicación</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={saving} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Próxima desparasitación</label>
                <Input type="date" value={vaccineNextDate} onChange={(e) => setVaccineNextDate(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Dosis / Observaciones (opcional)</label>
              <Input value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} placeholder="Ej. 1 tableta, vía oral, peso 10 kg…" disabled={saving} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando…" : "Guardar desparasitación"}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => { setActiveForm(null); setForm(INITIAL_FORM); setVaccineNextDate(""); setFormError(null); }}>Cancelar</Button>
            </div>
          </form>
        )}

        {activeForm === "grooming" && (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-semibold">✂️ Peluquería / Grooming</p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Servicio realizado *</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej. Baño y corte, baño, corte de uñas…" autoFocus disabled={saving} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fecha del servicio</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={saving} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Próxima visita recomendada</label>
                <Input type="date" value={vaccineNextDate} onChange={(e) => setVaccineNextDate(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Observaciones (opcional)</label>
              <Input value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} placeholder="Ej. Pelaje en buen estado, solicitó corte estilo…" disabled={saving} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando…" : "Guardar peluquería"}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => { setActiveForm(null); setForm(INITIAL_FORM); setVaccineNextDate(""); setFormError(null); }}>Cancelar</Button>
            </div>
          </form>
        )}

        {activeForm === "allergy" && (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-semibold">🤧 Nueva alergia</p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Alergia / Sustancia *</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej. Pollo, penicilina, pasto…" autoFocus disabled={saving} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Reacción / descripción (opcional)</label>
              <Input value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} placeholder="Ej. Urticaria, vómito, dificultad respiratoria…" disabled={saving} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fecha detectada (opcional)</label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={saving} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando…" : "Guardar alergia"}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => { setActiveForm(null); setForm(INITIAL_FORM); setFormError(null); }}>Cancelar</Button>
            </div>
          </form>
        )}

        {activeForm === "note" && (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-semibold">📝 Nueva nota</p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Título *</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej. Desparasitación interna" autoFocus disabled={saving} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Detalle (opcional)</label>
              <Input value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} placeholder="Descripción adicional" disabled={saving} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fecha (opcional)</label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={saving} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando…" : "Guardar nota"}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => { setActiveForm(null); setForm(INITIAL_FORM); setFormError(null); }}>Cancelar</Button>
            </div>
          </form>
        )}

        {/* Línea de tiempo */}
        {loading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : timeline ? (
          <PetTimeline items={timeline.items} nextActions={timeline.nextActions} petId={pet.id} onReload={reloadTimeline} />
        ) : null}
      </div>

      <VetConsultationDialog
        open={showConsultation}
        onOpenChange={setShowConsultation}
        petId={pet.id}
        petName={pet.name}
        onSaved={async () => {
          const data = await reloadTimeline();
          setTimeline(data);
          onRecordAdded?.();
        }}
      />
    </>
  );
}

export function PetMedicalSheet({
  pet,
  open,
  onOpenChange,
  onRecordAdded,
}: PetMedicalSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {open && pet ? (
          <PetMedicalSheetContent key={pet.id} pet={pet} onRecordAdded={onRecordAdded} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
