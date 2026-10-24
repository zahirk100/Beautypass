// Public, non-secret settings for the apps: which payment mode is active (demo / test / live / off)
import { handler, mollieMode } from './_lib.js';

export default handler(async () => ({ payments: mollieMode() }), { methods: ['GET'] });
