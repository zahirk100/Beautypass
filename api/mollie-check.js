// Beheer → Instellingen → Mollie → "Webhook testen": is the key valid, and in which mode?
import { handler, currentUser, requirePerm, mollie, mollieMode } from './_lib.js';

export default handler(async (req) => {
  const user = await currentUser(req);
  requirePerm(user, 'settings');
  await mollie('GET', '/methods');
  return { mode: mollieMode() };
});
