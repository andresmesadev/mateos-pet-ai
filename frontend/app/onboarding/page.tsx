"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, HeartPulse, Scissors, ShoppingBag, ShieldCheck, LoaderCircle } from "lucide-react";
import { RegistrationShell } from "@/components/onboarding/registration-shell";
import styles from "@/components/onboarding/registration.module.css";
import { onboardingProvisioning, onboardingNotice, onboardingSupportHref, type OnboardingProvisioning } from "@/lib/onboarding-result";

const ACTIVITIES = [
  { id: "veterinary", label: "Veterinaria", icon: HeartPulse },
  { id: "grooming", label: "Peluquería", icon: Scissors },
  { id: "retail", label: "Pet shop", icon: ShoppingBag },
];
const STEPS = ["Tu negocio", "Tu acceso", "Revisar"];
type FormState = { name: string; slug: string; ownerName: string; email: string; password: string; activeModules: string[] };
type Availability = { slug: string; status: "checking" | "available" | "taken" | "error" };

function toSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63).replace(/-$/, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({ name: "", slug: "", ownerName: "", email: "", password: "", activeModules: ["veterinary"] });
  const [customSlug, setCustomSlug] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [retry, setRetry] = useState(0);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [provisioning, setProvisioning] = useState<OnboardingProvisioning>("unknown");
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const submitting = useRef(false);
  const created = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const validSlug = form.slug.length >= 2 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug);
  const status = availability?.slug === form.slug ? availability.status : "checking";
  const notice = registered ? onboardingNotice(provisioning) : null;

  useEffect(() => { title.current?.focus(); }, [step]);
  useEffect(() => {
    if (!validSlug) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAvailability({ slug: form.slug, status: "checking" });
      try {
        const response = await fetch(`/api/onboarding/verify/${encodeURIComponent(form.slug)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("verification");
        const data = await response.json();
        if (typeof data.available !== "boolean") throw new Error("verification");
        if (!controller.signal.aborted) setAvailability({ slug: form.slug, status: data.available ? "available" : "taken" });
      } catch {
        if (!controller.signal.aborted) setAvailability({ slug: form.slug, status: "error" });
      }
    }, 650);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.slug, retry, validSlug]);

  function change(field: keyof FormState, value: string) {
    setError(null); setErrorField(null);
    setForm(current => ({ ...current, [field]: value }));
  }
  function move(next: number) { setError(null); setErrorField(null); setStep(next); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || created.current) return;
    setError(null); setErrorField(null);
    if (step === 1) {
      if (!form.activeModules.length || !validSlug || status !== "available") return;
      setStep(2); return;
    }
    if (step === 2) {
      if (form.password !== confirmPassword) { setError("Las contraseñas no coinciden. Escríbelas de nuevo."); setErrorField("confirmPassword"); return; }
      setStep(3); return;
    }
    submitting.current = true; setBusy(true);
    try {
      const response = await fetch("/api/onboarding/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim(), ownerName: form.ownerName.trim(), email: form.email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (data?.field) { setStep(["name", "slug", "activeModules"].includes(data.field) ? 1 : 2); setErrorField(data.field); }
        throw new Error(data?.error || "No pudimos confirmar el registro. Intenta iniciar sesión antes de repetirlo.");
      }
      // Commit succeeded: any sign-in failure must never repeat registration.
      created.current = true;
      setRegistered(true);
      const preparation = onboardingProvisioning(data?.provisioning);
      setProvisioning(preparation);
      const password = form.password;
      setForm(current => ({ ...current, password: "" })); setConfirmPassword("");
      try {
        const result = await signIn("credentials", { email: form.email.trim().toLowerCase(), password, redirect: false });
        if (!result || result.error || result.ok !== true) throw new Error("signin");
        setSignedIn(true);
        if (preparation === "ready") { router.replace("/onboarding/success"); router.refresh(); }
      } catch { setError("Tu cuenta ya está creada. Inicia sesión con tu correo y contraseña para continuar."); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No pudimos confirmar el registro. Intenta iniciar sesión antes de repetirlo.");
    } finally { submitting.current = false; setBusy(false); }
  }

  return (
    <RegistrationShell>
      <ol className={styles.progress} aria-label="Pasos para crear tu cuenta">
        {STEPS.map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined}>
          <span className={`${styles.progressNumber} ${step > index + 1 ? styles.complete : ""}`}>{step > index + 1 ? <Check size={13} aria-label="Completado" /> : index + 1}</span>{label}
        </li>)}
      </ol>
      <p className={styles.stepLabel}>Paso {step} de 3</p>
      <h2 ref={title} tabIndex={-1} className={styles.title}>{step === 1 ? "Cuéntanos sobre tu negocio" : step === 2 ? "Crea tu acceso de administrador" : registered ? "Tu cuenta ya está creada" : "Todo listo para comenzar"}</h2>
      <p className={styles.description}>{registered ? "Continúa con tu cuenta existente. No necesitas repetir el registro." : step === 1 ? "Un espacio propio para tu veterinaria, peluquería o pet shop." : step === 2 ? "Usarás este correo y contraseña para ingresar y administrar tu negocio." : "Revisa tus datos antes de crear la cuenta."}</p>

      <form onSubmit={submit} className={styles.form}>
        {step === 1 && <>
          <div className={styles.field}>
            <label htmlFor="business-name">Nombre del negocio</label>
            <input id="business-name" name="organization" autoComplete="organization" placeholder="Ej. Mi negocio de mascotas" value={form.name} minLength={2} maxLength={120} required aria-invalid={errorField === "name"} onChange={event => {
              const name = event.target.value; setError(null); setErrorField(null);
              setForm(current => ({ ...current, name, slug: customSlug ? current.slug : toSlug(name) }));
            }} />
          </div>
          <fieldset className={styles.fieldGroup} aria-describedby="activities-hint">
            <legend className={styles.legend}>¿Qué servicios ofrece tu negocio?</legend>
            <div className={styles.moduleOptions}>{ACTIVITIES.map(({ id, label, icon: Icon }) => <label key={id} className={styles.moduleOption}>
              <input type="checkbox" name="activities" value={id} checked={form.activeModules.includes(id)} onChange={event => {
                setError(null); setForm(current => ({ ...current, activeModules: event.target.checked ? [...current.activeModules, id] : current.activeModules.filter(item => item !== id) }));
              }} /><Icon size={23} aria-hidden="true" />{label}
            </label>)}</div>
            <p id="activities-hint" className={styles.hint} style={{ marginTop: 9 }}>Puedes elegir varias actividades y ajustarlas después.</p>
            {!form.activeModules.length && <p className={`${styles.status} ${styles.error}`}>Selecciona al menos una actividad.</p>}
          </fieldset>
          <div>
            <details className={styles.customize} open={errorField === "slug" || undefined}>
              <summary>Personalizar el identificador del negocio</summary>
              <div className={styles.field}><label htmlFor="business-slug">Identificador del negocio</label><input id="business-slug" name="slug" value={form.slug} required minLength={2} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" spellCheck={false} aria-describedby="slug-hint slug-status" aria-invalid={status === "taken" || errorField === "slug"} onChange={event => {
                setCustomSlug(true); change("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }} /><p id="slug-hint" className={styles.hint}>Es un nombre único para distinguir tu negocio. Usa letras, números y guiones.</p></div>
            </details>
            {form.slug && <p className={styles.slugPreview}>Tu identificador: <strong>{form.slug}</strong></p>}
            <div id="slug-status" role="status" className={styles.status}>
              {validSlug && (status === "checking" ? "Comprobando disponibilidad…" : status === "available" ? <span className={styles.available}>Disponible para tu negocio</span> : status === "taken" ? <span className={styles.error}>Ese identificador ya está en uso. Personalízalo para continuar.</span> : <span className={styles.error}>No pudimos comprobarlo.<button className={styles.retry} type="button" onClick={() => { setAvailability(null); setRetry(value => value + 1); }}>Reintentar</button></span>)}
            </div>
          </div>
        </>}
        {step === 2 && <>
          <div className={styles.field}><label htmlFor="owner-name">Tu nombre</label><input id="owner-name" name="name" autoComplete="name" placeholder="Nombre y apellido" required minLength={2} maxLength={100} value={form.ownerName} aria-invalid={errorField === "ownerName"} onChange={event => change("ownerName", event.target.value)} /></div>
          <div className={styles.field}><label htmlFor="owner-email">Correo electrónico</label><input id="owner-email" name="email" type="email" autoComplete="username" autoCapitalize="none" placeholder="nombre@tunegocio.com" required maxLength={254} value={form.email} aria-invalid={errorField === "email"} aria-describedby="email-hint" onChange={event => change("email", event.target.value)} /><p id="email-hint" className={styles.hint}>Usa un correo real al que tengas acceso.</p></div>
          <div className={styles.field}><label htmlFor="owner-password">Contraseña</label><div className={styles.passwordWrap}><input id="owner-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required value={form.password} aria-describedby="password-hint" aria-invalid={errorField === "password"} onChange={event => change("password", event.target.value)} /><button type="button" className={styles.passwordToggle} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p id="password-hint" className={styles.hint}>Entre 12 y 128 caracteres. Puedes usar una frase fácil de recordar.</p></div>
          <div className={styles.field}><label htmlFor="confirm-password">Confirma tu contraseña</label><input id="confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required value={confirmPassword} aria-invalid={errorField === "confirmPassword"} onChange={event => { setConfirmPassword(event.target.value); setError(null); setErrorField(null); }} /></div>
        </>}
        {step === 3 && <>
          <dl className={styles.review}>
            <div><dt>Negocio</dt><dd>{form.name}<span>{form.slug}</span></dd></div>
            <div><dt>Actividades</dt><dd>{ACTIVITIES.filter(activity => form.activeModules.includes(activity.id)).map(activity => activity.label).join(", ")}</dd></div>
            <div><dt>Administrador</dt><dd>{form.ownerName}<span>{form.email.trim().toLowerCase()}</span></dd></div>
          </dl>
          {!registered && <><div className={styles.planNote}><ShieldCheck size={21} aria-hidden="true" /><div><strong>Empieza con acceso de evaluación</strong><p>Crear tu cuenta no genera un cobro. Podrás revisar y contratar un plan desde Facturación.</p></div></div>
          <p className={styles.notice}>Esta cuenta administrará un negocio nuevo. Si ya tienes uno registrado, <Link href="/login">ingresa con tu cuenta</Link>.</p></>}
        </>}
        {notice && <section className={styles.pendingNotice} role="status" aria-label="Preparación de la cuenta">
          <h3>{notice.title}</h3><p>{notice.description}</p>
          <p>Solicita al equipo de Huella Nex revisar el negocio <strong>{form.slug}</strong>. No vuelvas a crear la cuenta ni compartas tu contraseña.</p>
          <a href={onboardingSupportHref(form.slug)}>Solicitar revisión por correo</a>
          <p>La conexión de WhatsApp y la habilitación de IA se configuran por separado.</p>
        </section>}
        {error && <div className={styles.alert} role="alert"><p>{error}</p>{step === 3 && <Link href="/login">Ir a iniciar sesión</Link>}</div>}
        <div className={styles.actions}>
          {step > 1 && !registered && <button className={styles.secondary} type="button" disabled={busy} onClick={() => move(step - 1)}><ArrowLeft size={16} aria-hidden="true" />Atrás</button>}
          {registered && !busy ? <Link className={styles.primary} href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Entrar a mi negocio" : "Iniciar sesión"}<ArrowRight size={16} aria-hidden="true" /></Link> : <button className={styles.primary} type="submit" disabled={busy || (step === 1 && (!validSlug || status !== "available" || !form.activeModules.length || form.name.trim().length < 2))}>
            {busy ? <><LoaderCircle size={17} aria-hidden="true" />Creando tu acceso…</> : <>{step === 3 ? "Crear mi cuenta" : step === 2 ? "Revisar mis datos" : "Continuar"}<ArrowRight size={17} aria-hidden="true" /></>}
          </button>}
        </div>
        {step === 2 && <p className={styles.notice}>Serás administrador de este establecimiento. Después podrás crear los accesos de tu equipo.</p>}
      </form>
    </RegistrationShell>
  );
}
