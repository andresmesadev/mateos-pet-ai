import { productIcon } from "@/lib/product-icon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export default function Icon() { return productIcon(size.width); }
