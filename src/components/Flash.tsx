import { Toast } from "./Toast";

/** Shows ?ok= / ?error= messages as a floating toast. */
export function Flash({ params }: { params: { ok?: string; error?: string } }) {
  if (params.error) return <Toast kind="error" message={params.error} />;
  if (params.ok) return <Toast kind="ok" message={params.ok} />;
  return null;
}
