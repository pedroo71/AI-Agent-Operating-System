import { stopServer } from './server';

export default async function globalTeardown() {
  stopServer();
}
