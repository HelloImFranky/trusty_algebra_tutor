import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';

async function main() {
  await migrate();
  await seed(); // no-op when the curriculum is already present
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`algebra tutor API listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
