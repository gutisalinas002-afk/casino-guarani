# Casino Guaraní

## Desarrollo local
```bash
npm run install:all
npm run dev     # API :4000 · web http://localhost:5173 (modo demo)
```
La primera cuenta que se registre con un email de `ADMIN_EMAILS` ve el menú **Administración**.

## Publicar (VPS con Docker)
```bash
cp .env.example .env     # completar; WEBHOOK_SECRET: openssl rand -hex 32
docker compose up -d --build
```
Apuntá el DNS (registro A) del dominio a la IP del servidor antes de levantar: Caddy emite el HTTPS solo.

- **Modo demo** (`DEMO_MODE=true`): sin dinero real, con aviso permanente en la web.
- **Dinero real** (`DEMO_MODE=false`): la app no arranca sin `LICENSE_ID` y los datos bancarios.

## Webhook del banco
`POST /api/webhooks/bank` con header `x-signature` = HMAC-SHA256 (hex) del cuerpo crudo con `WEBHOOK_SECRET`.
Cuerpo: `{"reference":"CG-XXXXXX","amount":50000,"bankTxId":"único-del-banco"}`.
```bash
BODY='{"reference":"CG-XXXXXX","amount":50000,"bankTxId":"BNK-001"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')
curl -X POST https://tu-dominio/api/webhooks/bank -H "Content-Type: application/json" -H "x-signature: $SIG" -d "$BODY"
```
Si tu banco no ofrece webhook, los depósitos quedan en "Verificando" y los aprobás desde **Administración** viendo el extracto.

## Backups (diario)
```bash
docker compose exec app node --disable-warning=ExperimentalWarning backup.js
# cron: 0 4 * * *  cd /ruta/casino-guarani && docker compose exec -T app node --disable-warning=ExperimentalWarning backup.js
```
Copiá los archivos `backup-*.db` (volumen `casino-data`) fuera del servidor.

## Qué trae para uso real
Base SQLite con transacciones y saldo que no puede ser negativo · sesiones en cookie httpOnly · anti-CSRF · límite de intentos · cabeceras de seguridad ·
depósitos idempotentes · aprobación manual y retiros con auditoría · cédula y edad verificadas en el registro · límite diario de depósito y pausa de cuenta ·
rollover (apostar lo depositado antes de retirar).
