import { createServer } from 'node:net';

/** Give each test instance its own port so concurrent checks cannot hit another database. */
export async function getTestPort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return port;
}
