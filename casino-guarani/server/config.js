const env = process.env;
const prod = env.NODE_ENV === 'production';
const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export const cfg = {
  prod,
  port: Number(env.PORT) || 4000,
  dbPath: env.DB_PATH || './data/casino.db',
  appUrl: env.APP_URL || 'http://localhost:5173',
  webhookSecret: env.WEBHOOK_SECRET || 'dev-secret-cambiar',
  adminEmails: list(env.ADMIN_EMAILS),

  // DEMO_MODE=true  → sin dinero real: el banco se simula y la web muestra un aviso permanente.
  // DEMO_MODE=false → dinero real: exige LICENSE_ID (número de la habilitación de la autoridad de juegos).
  demoMode: env.DEMO_MODE ? env.DEMO_MODE === 'true' : !prod,
  licenseId: env.LICENSE_ID || '',

  bank: {
    banco: env.BANK_NAME || 'Banco Demo Paraguay',
    titular: env.BANK_HOLDER || 'Casino Guaraní S.A.',
    cuenta: env.BANK_ACCOUNT || '80-1234567-0',
    alias: env.BANK_ALIAS || 'casino.guarani',
  },

  minDeposit: 10000,
  maxDeposit: 5000000,
  maxDailyDeposit: Number(env.MAX_DAILY_DEPOSIT) || 2000000, // tope de la plataforma; el jugador puede bajarlo
  minWithdrawal: 50000,
  wagerMultiplier: Number(env.WAGER_MULTIPLIER ?? 1), // debe apostar ≥ X veces lo depositado antes de retirar
};

if (prod) {
  const errors = [];
  if ((env.WEBHOOK_SECRET || '').length < 32) errors.push('WEBHOOK_SECRET debe tener 32+ caracteres');
  if (!env.APP_URL?.startsWith('https://')) errors.push('APP_URL debe ser https://tu-dominio');
  if (!cfg.adminEmails.length) errors.push('ADMIN_EMAILS es obligatorio (quién aprueba pagos)');
  if (!cfg.demoMode) {
    if (!cfg.licenseId) errors.push('DEMO_MODE=false requiere LICENSE_ID (habilitación para operar juegos de azar online)');
    for (const k of ['BANK_NAME', 'BANK_HOLDER', 'BANK_ACCOUNT', 'BANK_ALIAS']) if (!env[k]) errors.push(`${k} es obligatorio con dinero real`);
  }
  if (errors.length) { console.error('Configuración inválida:\n- ' + errors.join('\n- ')); process.exit(1); }
}
