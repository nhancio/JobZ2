/**
 * Run before any other imports. Loads env and, if HTTPS_PROXY/HTTP_PROXY is set,
 * makes all fetch (including Supabase) go through that proxy so the worker works behind VPN/firewall.
 */
import 'dotenv/config';

const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) {
  const { setGlobalDispatcher, ProxyAgent } = await import('undici');
  setGlobalDispatcher(new ProxyAgent(proxy));
}
