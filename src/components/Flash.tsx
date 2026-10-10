export function Flash({ params }: { params: { ok?: string; error?: string } }) {
  if (params.error) return <div className="flash error" role="alert">{params.error}</div>;
  if (params.ok) return <div className="flash ok" role="status">{params.ok}</div>;
  return null;
}
