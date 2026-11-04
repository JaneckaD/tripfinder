import { openDb } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;
const db = await openDb();
const app = createApp(db);
app.listen(port, () => console.log(`TripFinder běží na http://localhost:${port}${db.remote ? ' (databáze Turso)' : ''}`));
