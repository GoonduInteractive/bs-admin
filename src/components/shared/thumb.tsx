import Image, { type ImageProps } from "next/image";
import { isUploaded } from "@/lib/upload-client";

/**
 * next/image that skips the optimiser for files from our upload route: the
 * optimiser fetches server-side without the admin's session cookie, so it
 * would be bounced to the login page.
 */
export function Thumb(props: ImageProps & { src: string }) {
  return <Image {...props} alt={props.alt} unoptimized={props.unoptimized || isUploaded(props.src)} />;
}
