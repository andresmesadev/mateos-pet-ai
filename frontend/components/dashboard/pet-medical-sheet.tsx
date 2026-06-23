"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  Syringe,
  Pill,
  Scissors,
  AlertCircle,
  StickyNote,
  Stethoscope,
  ChevronLeft,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
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
import { cn } from "@/lib/utils";

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

const INITIAL_FORM: AddRecordForm = { type: "note", title: "", detail: "", date: "" };

type ActiveForm = "vaccine" | "deworming" | "grooming" | "allergy" | "note" | "consultation";

const ACTION_BUTTONS: {
  id: ActiveForm;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  ring: string;
}[] = [
  { id: "consultation", label: "Consulta",        icon: Stethoscope, color: "text-sky-400",    bg: "bg-sky-500/10",    ring: "ring-sky-500/25 border-sky-500/20" },
  { id: "vaccine",      label: "Vacuna",           icon: Syringe,     color: "text-emerald-400",bg: "bg-emerald-500/10",ring: "ring-emerald-500/25 border-emerald-500/20" },
  { id: "deworming",    label: "Desparasitación",  icon: Pill,        color: "text-violet-400", bg: "bg-violet-500/10", ring: "ring-violet-500/25 border-violet-500/20" },
  { id: "grooming",     label: "Peluquería",       icon: Scissors,    color: "text-amber-400",  bg: "bg-amber-500/10",  ring: "ring-amber-500/25 border-amber-500/20" },
  { id: "allergy",      label: "Alergia",          icon: AlertCircle, color: "text-rose-400",   bg: "bg-rose-500/10",   ring: "ring-rose-500/25 border-rose-500/20" },
  { id: "note",         label: "Nota",             icon: StickyNote,  color: "text-muted-foreground", bg: "bg-accent/40", ring: "ring-white/10 border-white/[0.06]" },
];

const FORM_LABELS: Record<ActiveForm, { title: string; titlePlaceholder: string; detailLabel: string; detailPlaceholder: string; nextLabel?: string }> = {
  consultation: { title: "", titlePlaceholder: "", detailLabel: "", detailPlaceholder: "" },
  vaccine:   { title: "Nombre de la vacuna *",   titlePlaceholder: "Ej. Antirrábica, Parvovirus…", detailLabel: "Laboratorio / Lote (opcional)", detailPlaceholder: "Ej. Nobivac, Lote 1234…",         nextLabel: "Próxima vacunación" },
  deworming: { title: "Producto / Nombre *",      titlePlaceholder: "Ej. Milbemax, Drontal…",       detailLabel: "Dosis / Observaciones (opcional)", detailPlaceholder: "Ej. 1 tableta, vía oral…",   nextLabel: "Próxima desparasitación" },
  grooming:  { title: "Servicio realizado *",     titlePlaceholder: "Ej. Baño y corte, uñas…",      detailLabel: "Observaciones (opcional)",          detailPlaceholder: "Ej. Pelaje en buen estado…", nextLabel: "Próxima visita" },
  allergy:   { title: "Alergia / Sustancia *",    titlePlaceholder: "Ej. Pollo, penicilina…",       detailLabel: "Reacción / descripción (opcional)", detailPlaceholder: "Ej. Urticaria, vómito…" },
  note:      { title: "Título *",                 titlePlaceholder: "Ej. Observación post-cirugía", detailLabel: "Detalle (opcional)",                detailPlaceholder: "Descripción adicional" },
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring";

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
  petName: string; ownerName: string; ownerPhone: string;
  breed: string; gender: string; birthDate: string;
  weight: string; sterilized: string; notes: string;
};

function PetMedicalSheetContent({
  pet,
  onRecordAdded,
}: {
  pet: DashboardPet;
  onRecordAdded?: () => void;
}) {
  const { toast } = useToast();
  const [timeline, setTimeline]           = useState<PetTimelineData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [activeForm, setActiveForm]       = useState<ActiveForm | null>(null);
  const [showConsultation, setShowConsultation] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [form, setForm]                   = useState<AddRecordForm>(INITIAL_FORM);
  const [nextDate, setNextDate]           = useState("");
  const [formError, setFormError]         = useState<string | null>(null);
  const [editingProfile, setEditingProfile]   = useState(false);
  const [savingProfile, setSavingProfile]     = useState(false);
  const [profile, setProfile]             = useState<Partial<DashboardPet>>({
    breed: pet.breed, gender: pet.gender, birthDate: pet.birthDate,
    weight: pet.weight, sterilized: pet.sterilized, notes: pet.notes,
  });
  const [petName, setPetName]             = useState(pet.name);
  const [ownerName, setOwnerName]         = useState(pet.owner?.name ?? "");
  const [ownerPhone, setOwnerPhone]       = useState(pet.owner?.phone ?? "");
  const [profileForm, setProfileForm]     = useState<PetProfileForm>({
    petName:    pet.name,
    ownerName:  pet.owner?.name ?? "",
    ownerPhone: pet.owner?.phone ?? "",
    breed:      pet.breed ?? "",
    gender:     pet.gender ?? "",
    birthDate:  pet.birthDate ? pet.birthDate.slice(0, 10) : "",
    weight:     pet.weight != null ? String(pet.weight) : "",
    sterilized: pet.sterilized != null ? String(pet.sterilized) : "",
    notes:      pet.notes ?? "",
  });

  const reloadTimeline = useCallback(async () => {
    const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}/timeline`), { cache: "no-store" });
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

  function openForm(id: ActiveForm) {
    if (id === "consultation") { setShowConsultation(true); return; }
    setActiveForm(id);
    setForm({ ...INITIAL_FORM, type: id as MedicalRecordType });
    setNextDate("");
    setFormError(null);
  }

  function closeForm() {
    setActiveForm(null);
    setForm(INITIAL_FORM);
    setNextDate("");
    setFormError(null);
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      // Guardar mascota (nombre + datos clínicos)
      const petRes = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       profileForm.petName.trim() || pet.name,
          breed:      profileForm.breed || null,
          gender:     profileForm.gender || null,
          birthDate:  profileForm.birthDate || null,
          weight:     profileForm.weight ? Number(profileForm.weight) : null,
          sterilized: profileForm.sterilized === "true" ? true : profileForm.sterilized === "false" ? false : null,
          notes:      profileForm.notes || null,
        }),
      });
      if (!petRes.ok) throw new Error("Error al guardar mascota");
      const updatedPet = await petRes.json();
      setProfile(updatedPet);
      setPetName(profileForm.petName.trim() || pet.name);

      // Guardar propietario si tiene id
      if (pet.owner?.id) {
        const ownerRes = await fetch(proxyUrl(`/api/dashboard/clients/${pet.owner.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:  profileForm.ownerName.trim() || null,
            phone: profileForm.ownerPhone.trim() || null,
          }),
        });
        if (!ownerRes.ok) throw new Error("Error al guardar propietario");
        setOwnerName(profileForm.ownerName.trim());
        setOwnerPhone(profileForm.ownerPhone.trim());
      }

      setEditingProfile(false);
      toast("Ficha guardada.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se guardó. Intenta de nuevo.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) { setFormError("El título es obligatorio"); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}/records`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:           form.type,
          title,
          detail:         form.detail.trim() || null,
          date:           form.date || null,
          nextControlAt:  (form.type === "vaccine" || form.type === "deworming" || form.type === "grooming") && nextDate ? nextDate : null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo guardar el registro");
      }
      closeForm();
      const data = await reloadTimeline();
      setTimeline(data);
      onRecordAdded?.();
      toast("Registro guardado.", "success");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar registro");
    } finally {
      setSaving(false);
    }
  }

  const activeBtn = ACTION_BUTTONS.find((b) => b.id === activeForm);
  const labels    = activeForm && activeForm !== "consultation" ? FORM_LABELS[activeForm] : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-xl ring-1 ring-amber-500/25">
            {getPetEmoji(pet.type)}
          </div>
          <div>
            <DialogTitle className="text-base font-semibold tracking-tight">{petName}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {formatPetType(pet.type)}
              {ownerName ? ` · ${ownerName}` : ""}
              {ownerPhone ? ` · ${ownerPhone}` : ""}
            </DialogDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs tabular-nums">
            {timeline?.items.length ?? "–"} eventos
          </Badge>
          <Badge variant="outline" className="text-xs tabular-nums">
            {pet._count.appointments} citas
          </Badge>
          <a href={`/print/pets/${pet.id}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">

        {/* Ficha */}
        <div className="rounded-xl border border-white/[0.06] bg-card">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ficha clínica</p>
            {!editingProfile && (
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="text-xs text-primary hover:underline"
              >
                Editar
              </button>
            )}
          </div>

          {editingProfile ? (
            <div className="space-y-3 p-4">
              {/* Identificación */}
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nombre de la mascota</label>
                  <Input value={profileForm.petName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, petName: e.target.value }))}
                    placeholder="Ej. Max" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nombre del propietario</label>
                  <Input value={profileForm.ownerName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, ownerName: e.target.value }))}
                    placeholder="Ej. María López" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Teléfono / WhatsApp</label>
                  <Input value={profileForm.ownerPhone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, ownerPhone: e.target.value }))}
                    placeholder="+57 300 000 0000" />
                </div>
              </div>
              <div className="border-t border-white/[0.06] pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datos clínicos</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Raza</label>
                  <Input placeholder="Ej. Golden Retriever" value={profileForm.breed}
                    onChange={(e) => setProfileForm((f) => ({ ...f, breed: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Sexo</label>
                  <select value={profileForm.gender}
                    onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))}
                    className={SELECT_CLASS}>
                    <option value="">Sin especificar</option>
                    <option value="male">Macho</option>
                    <option value="female">Hembra</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Fecha de nacimiento</label>
                  <Input type="date" value={profileForm.birthDate}
                    onChange={(e) => setProfileForm((f) => ({ ...f, birthDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Peso (kg)</label>
                  <Input type="number" step="0.1" min="0" placeholder="Ej. 12.5" value={profileForm.weight}
                    onChange={(e) => setProfileForm((f) => ({ ...f, weight: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Esterilizado/a</label>
                  <select value={profileForm.sterilized}
                    onChange={(e) => setProfileForm((f) => ({ ...f, sterilized: e.target.value }))}
                    className={SELECT_CLASS}>
                    <option value="">Sin especificar</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Notas</label>
                  <Input placeholder="Observaciones generales" value={profileForm.notes}
                    onChange={(e) => setProfileForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? "Guardando…" : "Guardar ficha"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingProfile(false)} disabled={savingProfile}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {(
                [
                  profile.breed      ? ["Raza",           profile.breed] : null,
                  profile.gender     ? ["Sexo",           profile.gender === "male" ? "Macho" : "Hembra"] : null,
                  profile.birthDate  ? ["Nacimiento",     new Date(profile.birthDate).toLocaleDateString("es-CO")] : null,
                  profile.weight != null ? ["Peso",       `${profile.weight} kg`] : null,
                  profile.sterilized != null ? ["Esterilizado/a", profile.sterilized ? "Sí" : "No"] : null,
                  profile.notes      ? ["Notas",          profile.notes] : null,
                ] as ([string, string] | null)[]
              ).filter((row): row is [string, string] => row !== null).map(([label, value]) => (
                <div key={label} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                  <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
              {!profile.breed && !profile.gender && !profile.birthDate &&
                profile.weight == null && profile.sterilized == null && !profile.notes && (
                <p className="px-4 py-3 text-sm text-muted-foreground">Sin datos adicionales.</p>
              )}
            </div>
          )}
        </div>

        {/* Botones de acción */}
        {!activeForm && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agregar registro</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ACTION_BUTTONS.map((btn) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => openForm(btn.id)}
                    className={cn(
                      "group flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-150",
                      "hover:-translate-y-0.5 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]",
                      btn.ring,
                      btn.bg
                    )}
                  >
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-110", btn.bg, btn.ring)}>
                      <Icon className={cn("h-4 w-4", btn.color)} />
                    </div>
                    <span className={cn("text-[11px] font-medium leading-tight", btn.color)}>
                      {btn.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Formulario activo */}
        {activeForm && activeForm !== "consultation" && activeBtn && labels && (
          <div className={cn("rounded-xl border p-5", activeBtn.bg, activeBtn.ring)}>
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg ring-1", activeBtn.bg, activeBtn.ring)}>
                <activeBtn.icon className={cn("h-3.5 w-3.5", activeBtn.color)} />
              </div>
              <p className="text-sm font-semibold">{activeBtn.label}</p>
            </div>

            <form id="medical-record-form" onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{labels.title}</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={labels.titlePlaceholder}
                  autoFocus
                  disabled={saving}
                />
              </div>

              {labels.nextLabel ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                    <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={saving} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{labels.nextLabel}</label>
                    <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} disabled={saving} />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Fecha (opcional)</label>
                  <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={saving} />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{labels.detailLabel}</label>
                <Input
                  value={form.detail}
                  onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
                  placeholder={labels.detailPlaceholder}
                  disabled={saving}
                />
              </div>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </form>

            <div className="mt-4 flex gap-2">
              <Button type="submit" form="medical-record-form" size="sm" disabled={saving}>
                {saving ? "Guardando…" : `Guardar ${activeBtn.label.toLowerCase()}`}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historial</p>
          {loading ? (
            <TimelineSkeleton />
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error}
            </div>
          ) : timeline ? (
            <PetTimeline items={timeline.items} nextActions={timeline.nextActions} petId={pet.id} onReload={reloadTimeline} />
          ) : null}
        </div>
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
    </div>
  );
}

export function PetMedicalSheet({ pet, open, onOpenChange, onRecordAdded }: PetMedicalSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        {open && pet ? (
          <PetMedicalSheetContent key={pet.id} pet={pet} onRecordAdded={onRecordAdded} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
