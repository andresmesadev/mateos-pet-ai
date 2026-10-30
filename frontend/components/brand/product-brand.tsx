import Image from "next/image";
import { PRODUCT_NAME, PRODUCT_SYMBOL } from "@/lib/product-brand";
import styles from "./product-brand.module.css";

export function ProductBrand({ size = "md", subtitle, className = "" }: {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  className?: string;
}) {
  const pixels = { sm: 28, md: 40, lg: 48 }[size];
  return <span className={`${styles.brand} ${styles[size]} ${className}`}>
    <Image src={PRODUCT_SYMBOL} width={pixels} height={pixels} alt="" aria-hidden="true" className={styles.symbol} />
    <span className={styles.copy}>
      <span className={styles.name}>{PRODUCT_NAME}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </span>
  </span>;
}
