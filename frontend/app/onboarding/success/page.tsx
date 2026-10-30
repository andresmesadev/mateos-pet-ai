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
    <p className={styles.description}>Ya ingresaste con tu cuenta, {session.user.name}. Ahora puedes preparar tu negocio antes de registrar tu primera atención o venta.</p>
    <ol className={styles.nextSteps}>
      <li><span>1</span><div><strong>Elige cómo opera tu negocio</strong><p>Revisa tus datos y activa Veterinaria, Peluquería o Pet shop.</p></div></li>
      <li><span>2</span><div><strong>Prepara lo que necesitas</strong><p>Configura servicios, horarios y equipo, o productos y existencias para vender.</p></div></li>
      <li><span>3</span><div><strong>Organiza tu primera jornada</strong><p>Confirma la base de caja y sigue la guía hasta la primera atención o venta y su cierre.</p></div></li>
    </ol>
    <p className={styles.description}>WhatsApp puede esperar. Tu dashboard ya está disponible para comenzar la configuración.</p>
    <Link href="/dashboard/settings?guide=1" className={styles.primary} style={{ width: "100%" }}>Preparar mi negocio<ArrowRight size={17} aria-hidden="true" /></Link>
  </RegistrationShell>;
}
