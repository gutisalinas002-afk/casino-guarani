import { useState } from 'react';
import { api } from '../api';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', document: '', birthdate: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      onAuth(await api('/' + mode, { method: 'POST', body: f }));
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-casino grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full border border-gold/50 bg-ink-800 text-3xl shadow-[0_0_40px_#f5c54244]">🧉</div>
          <h1 className="gold-text font-display text-4xl font-extrabold tracking-wider">Casino Guaraní</h1>
          <p className="mt-2 text-sm text-zinc-400">Tragamonedas con depósitos automáticos desde tu banco.</p>
        </div>

        <form onSubmit={submit} className="card space-y-3 border-gold/20 p-6 shadow-[0_0_60px_#a855f722]">
          <div className="mb-2 grid grid-cols-2 rounded-xl bg-ink-900 p-1 text-sm font-semibold">
            {[['login', 'Ingresar'], ['register', 'Crear cuenta']].map(([k, l]) => (
              <button type="button" key={k} onClick={() => { setMode(k); setErr(''); }}
                className={`rounded-lg py-2 transition ${mode === k ? 'bg-gold text-ink-950' : 'text-zinc-400 hover:text-white'}`}>{l}</button>
            ))}
          </div>
          {mode === 'register' && <input className="input" placeholder="Nombre y apellido (como en tu cédula)" value={f.name} onChange={set('name')} autoComplete="name" />}
          {mode === 'register' && <input className="input" inputMode="numeric" placeholder="Cédula de identidad" value={f.document} onChange={set('document')} />}
          {mode === 'register' && (
            <label className="block text-xs text-zinc-400">Fecha de nacimiento
              <input className="input mt-1" type="date" value={f.birthdate} onChange={set('birthdate')} autoComplete="bday" />
            </label>
          )}
          <input className="input" type="email" placeholder="Email" value={f.email} onChange={set('email')} autoComplete="email" />
          <input className="input" type="password" placeholder="Contraseña" value={f.password} onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} />
          {mode === 'register' && <p className="text-xs text-zinc-500">Al crear tu cuenta confirmás que sos mayor de 18 años y que tus datos son verdaderos. Los verificamos antes de cualquier retiro.</p>}
          {err && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}
          <button className="btn-gold w-full py-3" disabled={busy}>{busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
        </form>
        <p className="mt-6 text-center text-xs text-zinc-500">+18 · Jugá con responsabilidad</p>
      </div>
    </div>
  );
}
