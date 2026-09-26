import Link from "next/link";

type LogoImageProps = {
  className?: string;
  alt?: string;
};

export function KpmLogoImage({ className = "h-8 w-auto", alt = "KPM" }: LogoImageProps) {
  return <img src="/brand/kpm-logo.png" alt={alt} className={`object-contain ${className}`} />;
}

export function KpmLogo({
  href = "/dashboard",
  className = "h-8 w-auto",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} className="inline-flex items-center rounded-md">
      <KpmLogoImage className={className} />
    </Link>
  );
}
