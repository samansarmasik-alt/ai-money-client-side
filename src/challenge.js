import crypto from 'node:crypto';

export function solveTasks(tasks) {
  const answers = {};
  for (const task of tasks) answers[task.id] = solveTask(task);
  return answers;
}

export function solveTask(task) {
  const d = task.data || {};
  switch (task.kind) {
    case 'math':
      return String(d.a * d.b - d.c * d.c * d.c);
    case 'sequence':
      return String(d.start + 4 * d.step);
    case 'decode':
      return String(parseInt(d.hex, 16));
    case 'json':
      return '{"status":"ok","sum":' + (d.x + d.y) + '}';
    case 'declaration':
      return 'AGENT-READY';
    default:
      throw new Error('bilinmeyen gorev tipi: ' + task.kind);
  }
}

export function mine(prefix, difficulty) {
  const target = '0'.repeat(difficulty);
  for (let i = 0; i < 20000000; i++) {
    const nonce = String(i);
    if (crypto.createHash('sha256').update(prefix + nonce).digest('hex').startsWith(target)) return nonce;
  }
  throw new Error('proof of work bulunamadi');
}