// La sesión viaja en una cookie httpOnly: el JavaScript del navegador nunca ve el token.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No pudimos conectar con el servidor.');
  return data;
}

export const gs = (n) => new Intl.NumberFormat('es-PY').format(n) + ' Gs.';
