import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { RegistrationShell } from "@/components/onboarding/registration-shell";
import styles from "@/components/onboarding/registration.module.css";

export default async function OnboardingSuccessPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <RegistrationShell>
    <div className={styles.successIcon}><Check size={26} aria-hidden="true" /></div>
    <h2 className={styles.title}>Tu cuenta está lista.</h2>
    <p className={styles.description}>Ya ingresaste con tu cuenta, {session.user.name}. Ahora puedes preparar tu negocio antes de registrar la primera cita.</p>
    <ol className={styles.nextSteps}>
      <li><span>1</span><div><strong>Revisa tu negocio</strong><p>Completa tus datos y horarios en Configuración.</p></div></li>
      <li><span>2</span><div><strong>Prepara tus servicios y equipo</strong><p>Define precios y crea una cuenta para cada persona que usará el sistema.</p></div></li>
      <li><span>3</span><div><strong>Organiza tu primera jornada</strong><p>Comprueba la agenda y tus datos de apertura antes de empezar la operación real.</p></div></li>
    </ol>
    <p className={styles.description}>WhatsApp puede esperar. Tu dashboard ya está disponible para comenzar la configuración.</p>
    <Link href="/dashboard" className={styles.primary} style={{ width: "100%" }}>Entrar a mi negocio<ArrowRight size={17} aria-hidden="true" /></Link>
  </RegistrationShell>;
}
