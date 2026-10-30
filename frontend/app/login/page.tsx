import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import { ProductBrand } from "@/components/brand/product-brand";
import { PRODUCT_DESCRIPTOR } from "@/lib/product-brand";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-muted/40 p-6">
      <Link href="/" aria-label="Huella Nex, inicio" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">
        <ProductBrand size="lg" subtitle={PRODUCT_DESCRIPTOR} />
      </Link>
      <LoginForm />
    </main>
  );
}
