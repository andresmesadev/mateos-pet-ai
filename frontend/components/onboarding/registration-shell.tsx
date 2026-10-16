import Link from "next/link";
import { CalendarDays, PawPrint, UsersRound, ArrowLeft, Check } from "lucide-react";
import styles from "./registration.module.css";

export function RegistrationShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Mateos Pet AI, inicio">
          <span className={styles.brandMark}><PawPrint size={23} aria-hidden="true" /></span>
          <span>mateos<span className={styles.brandAccent}>pet</span><span className={styles.brandAi}>ai</span></span>
        </Link>
        <p>¿Ya tienes una cuenta? <Link href="/login">Ingresar</Link></p>
      </header>
      <main className={styles.layout}>
        <aside className={styles.intro} aria-label="Empieza con Mateos Pet">
          <Link href="/" className={styles.backLink}><ArrowLeft size={16} aria-hidden="true" /> Volver al inicio</Link>
          <h1>Un nuevo comienzo<br /> para tu negocio.</h1>
          <p className={styles.introText}>Crea tu espacio en Mateos Pet y organiza el día a día de quienes cuidan mascotas.</p>
          <div className={styles.benefits}>
            <div><CalendarDays size={21} aria-hidden="true" /><p><strong>Tu agenda, en orden</strong><span>Empieza con tus servicios y primeras citas.</span></p></div>
            <div><PawPrint size={21} aria-hidden="true" /><p><strong>Cada mascota, presente</strong><span>Reúne clientes, mascotas y sus datos importantes.</span></p></div>
            <div><UsersRound size={21} aria-hidden="true" /><p><strong>Un espacio para tu equipo</strong><span>Invita a cada persona con el acceso que necesita.</span></p></div>
          </div>
          <div className={styles.introNote}><Check size={18} aria-hidden="true" /><p>Puedes comenzar desde el dashboard.<br />WhatsApp se configura después.</p></div>
        </aside>
        <section className={styles.workspace} aria-label="Registro de cuenta">{children}</section>
      </main>
      <footer className={styles.footer}>Mateos Pet AI · Para quienes cuidan mascotas.</footer>
    </div>
  );
}
