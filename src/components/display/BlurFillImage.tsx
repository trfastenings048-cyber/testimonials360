import Image from 'next/image';

/** The whole photo stays visible (contain); a blurred cover copy fills the space around it. */
export function BlurFillImage({ src, alt }: { src: string; alt: string }) {
  return (
    <>
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        sizes="100vw"
        className="pointer-events-none scale-110 object-cover opacity-60 blur-3xl"
      />
      <Image
        src={src}
        alt={alt}
        fill
        priority
        unoptimized
        sizes="100vw"
        className="pointer-events-none object-contain"
      />
    </>
  );
}
