import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CircleDollarSign, Clock3, HeartPulse, MessageCircleMore, PawPrint, Scissors, Sparkles, UsersRound } from "lucide-react";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Mateos Pet AI | Una operación más simple para tu negocio de mascotas",
  description: "Organiza agenda, clientes, servicios, equipo y finanzas en una plataforma para negocios de salud y bienestar animal, con empleados digitales especializados.",
};

const capabilities = [
  { icon: CalendarDays, title: "Una agenda que sigue el ritmo de tu negocio", description: "Consulta citas, disponibilidad y servicios desde un mismo lugar. Tu equipo sabe qué viene y qué necesita atención.", tone: styles.mint },
  { icon: PawPrint, title: "Cada mascota tiene una historia", description: "Reúne clientes, mascotas y datos importantes para dar una atención más cercana en cada visita.", tone: styles.peach },
  { icon: CircleDollarSign, title: "La operación también se ve en números", description: "Lleva servicios, cobros, gastos y comisiones con información conectada a lo que ocurre cada día.", tone: styles.blue },
];

function Brand() {
  return <Link href="/" className={styles.brand} aria-label="Mateos Pet AI, inicio"><span className={styles.brandMark} aria-hidden="true"><PawPrint size={21} strokeWidth={2.5} /></span><span>mateos<span className={styles.brandAccent}>pet</span><span className={styles.brandAi}>ai</span></span></Link>;
}

function Header() {
  return <header className={styles.header}><div className={styles.headerInner}><Brand /><nav className={styles.desktopNav} aria-label="Navegación principal"><a href="#plataforma">La plataforma</a><a href="#como-funciona">Cómo funciona</a></nav><div className={styles.headerActions}><Link href="/login" className={styles.loginLink}>Ingresar</Link><Link href="/onboarding" className={styles.headerCta}>Crear mi cuenta <ArrowRight size={16} /></Link></div></div></header>;
}

function OperationPreview() {
  return <div className={styles.preview} aria-label="Vista ilustrativa de una jornada en la plataforma">
    <div className={styles.previewTop}><div className={styles.previewLogo}><PawPrint size={16} /> mateos pet</div><span className={styles.previewToday}>Tu operación, en un lugar</span></div>
    <div className={styles.previewBody}><div className={styles.previewIntro}><span>Hoy en tu negocio</span><strong>Todo empieza aquí.</strong></div><div className={styles.previewColumns}>
      <div className={styles.appointmentPanel}><div className={styles.panelTitle}><CalendarDays size={17} /> Agenda del día</div>
        <div className={styles.appointment}><span className={styles.time}>09:00</span><span className={styles.appointmentIcon}><Scissors size={17} /></span><span><strong>Baño y peluquería</strong><small>Una cita por atender</small></span><span className={styles.statusDot} /></div>
        <div className={styles.appointment}><span className={styles.time}>11:30</span><span className={styles.appointmentIcon}><HeartPulse size={17} /></span><span><strong>Consulta veterinaria</strong><small>Equipo preparado</small></span><span className={styles.statusDot} /></div>
        <div className={styles.appointment}><span className={styles.time}>15:00</span><span className={styles.appointmentIcon}><PawPrint size={17} /></span><span><strong>Control de mascota</strong><small>Próxima visita</small></span><span className={styles.statusDot} /></div>
      </div><div className={styles.sidePanel}><div className={styles.sidePanelIcon}><MessageCircleMore size={22} /></div><strong>Conversaciones al día</strong><p>La recepcionista digital ayuda a responder, coordinar citas y dar continuidad a cada conversación.</p><div className={styles.sidePanelFoot}><Sparkles size={15} /> Equipo humano + digital</div></div>
    </div></div><span className={styles.floatingNote}><Clock3 size={17} /> Más claridad para cada jornada</span>
  </div>;
}

function Hero() {
  return <section className={styles.hero}><div className={styles.heroInner}><div className={styles.heroCopy}><p className={styles.kicker}><span className={styles.kickerDot} /> Para quienes cuidan mascotas</p><h1>Tu negocio de mascotas, <span>en sintonía.</span></h1><p className={styles.heroDescription}>Agenda, clientes, servicios, equipo y finanzas conectados en una sola plataforma. Con empleados digitales que ayudan a que cada día fluya mejor.</p><div className={styles.heroActions}><Link href="/onboarding" className={styles.primaryButton}>Empieza con Mateos Pet <ArrowRight size={18} /></Link><a href="#plataforma" className={styles.textButton}>Conoce la plataforma <ArrowRight size={17} /></a></div><p className={styles.heroFootnote}>Para peluquerías y negocios veterinarios.</p></div><OperationPreview /></div></section>;
}

function Platform() {
  return <section id="plataforma" className={styles.platform}><div className={styles.sectionInner}><div className={styles.sectionHeading}><p className={styles.sectionEyebrow}>La plataforma</p><h2>Menos piezas sueltas.<br />Más tiempo para cuidar.</h2><p>Las tareas diarias se entienden mejor cuando la información del negocio vive en un mismo lugar.</p></div><div className={styles.capabilityGrid}>{capabilities.map(({ icon: Icon, title, description, tone }) => <article className={`${styles.capability} ${tone}`} key={title}><div className={styles.capabilityIcon}><Icon size={25} strokeWidth={1.8} /></div><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>;
}

function HowItWorks() {
  return <section id="como-funciona" className={styles.how}><div className={styles.howInner}><div className={styles.howCopy}><p className={styles.sectionEyebrow}>Personas y tecnología, juntas</p><h2>Tu equipo hace lo que mejor sabe hacer. La plataforma acompaña el resto.</h2><p>Mateos Pet AI reúne la operación del establecimiento y permite que empleados digitales especializados apoyen las tareas repetitivas, sin perder de vista el trabajo del equipo humano.</p><Link href="/onboarding" className={styles.darkButton}>Conocer los planes <ArrowRight size={18} /></Link></div><div className={styles.flow}>
    <div className={styles.flowItem}><span><UsersRound size={23} /></span><div><strong>Tu equipo</strong><p>Atiende a las mascotas y toma las decisiones importantes.</p></div><Check size={18} className={styles.flowCheck} /></div>
    <div className={styles.flowItem}><span><MessageCircleMore size={23} /></span><div><strong>Empleados digitales</strong><p>Apoyan conversaciones, citas y recordatorios.</p></div><Check size={18} className={styles.flowCheck} /></div>
    <div className={styles.flowItem}><span><Sparkles size={23} /></span><div><strong>Una operación conectada</strong><p>La información queda disponible para trabajar con más claridad.</p></div><Check size={18} className={styles.flowCheck} /></div>
  </div></div></section>;
}

function FinalCta() {
  return <section className={styles.finalCta}><div className={styles.finalInner}><div><p className={styles.finalEyebrow}>El siguiente paso</p><h2>Haz espacio para lo que más importa.</h2><p>Conoce los planes y empieza a organizar tu negocio con Mateos Pet AI.</p></div><Link href="/onboarding" className={styles.lightButton}>Crear mi cuenta <ArrowRight size={18} /></Link></div></section>;
}

export default function LandingPage() {
  return <div className={styles.page}><Header /><main><Hero /><Platform /><HowItWorks /><FinalCta /></main><footer className={styles.footer}><div className={styles.footerInner}><Brand /><span>Una operación más simple para quienes cuidan mascotas.</span><div><Link href="/login">Ingresar</Link><Link href="/onboarding">Crear cuenta</Link></div><small>© {new Date().getFullYear()} Mateos Pet AI</small></div></footer></div>;
}
