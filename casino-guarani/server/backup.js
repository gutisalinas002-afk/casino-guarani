// Copia consistente de la base (se puede ejecutar con la app corriendo): node backup.js
import path from 'node:path';
import { cfg } from './config.js';
import { backupTo } from './db.js';

const file = path.join(path.dirname(cfg.dbPath), `backup-${new Date().toISOString().slice(0, 10)}.db`);
backupTo(file);
console.log('Backup creado:', file);
