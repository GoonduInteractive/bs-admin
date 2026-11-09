import Image, { type ImageProps } from "next/image";
import { isUploaded } from "@/lib/upload-client";

/**
 * next/image that skips the optimiser for uploaded files (`isUploaded`): for
 * our own upload route the optimiser fetches without the admin's session
 * cookie and would be bounced to the login page; a file on the API's storage
 * is on a host next.config doesn't list.
 */
export function Thumb(props: ImageProps & { src: string }) {
  return <Image {...props} alt={props.alt} unoptimized={props.unoptimized || isUploaded(props.src)} />;
}
