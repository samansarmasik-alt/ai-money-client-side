import readline from 'node:readline/promises';
import { DEFAULT_URL, FILE, loadConfig, saveConfig } from './config.js';
import { api } from './api.js';
import { mine, solveTasks } from './challenge.js';

export async function setup() {
  const cfg = loadConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('--- borsa-ai kayit ---');
  console.log('Agent basina bir kez yapilir. Anahtar ' + FILE + ' dosyasinda saklanir.');
  const defaultUrl = cfg.server_url || DEFAULT_URL;
  const urlAnswer = (await rl.question('Sunucu adresi [' + defaultUrl + ']: ')).trim();
  const serverUrl = (urlAnswer || defaultUrl).replace(/\/+$/, '');
  const nameAnswer = (await rl.question('Agent adi (leaderboard): ')).trim();
  const name = nameAnswer || 'agent-' + Math.random().toString(36).slice(2, 7);
  const descAnswer = (await rl.question('Kisa aciklama: ')).trim();
  const description = descAnswer || 'autonomous agent';
  rl.close();

  console.log('\nSunucuya baglaniliyor: ' + serverUrl);
  const challenge = await api('/v1/agents/register', { method: 'POST', base: serverUrl, noAuth: true, body: {} });
  console.log('Dogrulama testi alindi: ' + challenge.tasks.length + ' gorev + proof-of-work (zorluk ' + challenge.proof_of_work.difficulty + ')');
  for (const task of challenge.tasks) console.log('  [' + task.kind + '] ' + task.prompt);
  const answers = solveTasks(challenge.tasks);
  const nonce = mine(challenge.proof_of_work.prefix, challenge.proof_of_work.difficulty);
  console.log('Test cozuldu, nonce=' + nonce + '. Kayit gonderiliyor...');
  const result = await api('/v1/agents/verify', {
    method: 'POST',
    base: serverUrl,
    noAuth: true,
    body: { challenge_id: challenge.challenge_id, answers: answers, proof_of_work_nonce: nonce, name: name, description: description },
  });
  saveConfig({ server_url: serverUrl, agent_id: result.agent_id, api_key: result.api_key, name: name });
  console.log('\nKayit tamam. Agent ID: ' + result.agent_id);
  console.log('Baslangic bakiyesi: ' + result.starting_cash + ' CR');
  console.log('\nSirada ne var:');
  console.log('  borsa.bat mcp     -> MCP sunucusunu baslat, kendi agentini bagla');
  console.log('  borsa.bat watch   -> canli panel');
  console.log('  borsa.bat demo    -> ornek trading agent');
  return result;
}