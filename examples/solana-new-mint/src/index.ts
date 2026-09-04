import {
  WS_URL,
  TOKEN_PROGRAM,
  TOKEN_2022_PROGRAM,
  MINT_LOG,
  appendLog,
  fetchMintFromSig,
} from './shared';

const out = document.getElementById('out') as HTMLPreElement;
const statusEl = document.getElementById('status') as HTMLElement;
const btnStart = document.getElementById('btnStart') as HTMLButtonElement;
const btnStop = document.getElementById('btnStop') as HTMLButtonElement;
const btnClear = document.getElementById('btnClear') as HTMLButtonElement;

let ws: WebSocket | null = null;
let shouldRun = false;
let backoffMs = 1000;
const seen = new Set<string>();
const SEEN_MAX = 500;

function setStatus(text: string) {
  statusEl.textContent = text;
}

function subscribeLogs(socket: WebSocket, programId: string, reqId: number) {
  socket.send(
    JSON.stringify({
      jsonrpc: '2.0',
      id: reqId,
      method: 'logsSubscribe',
      params: [{ mentions: [programId] }, { commitment: 'confirmed' }],
    }),
  );
}

function trimSeen() {
  if (seen.size <= SEEN_MAX) return;
  const drop = seen.size - SEEN_MAX;
  let i = 0;
  for (const key of seen) {
    seen.delete(key);
    i += 1;
    if (i >= drop) break;
  }
}

function connect() {
  if (!shouldRun) return;
  setStatus('Connecting…');
  appendLog(out, `connecting ${WS_URL}`);
  const socket = new WebSocket(WS_URL);
  ws = socket;

  socket.onopen = () => {
    backoffMs = 1000;
    setStatus('Subscribed — waiting for InitializeMint / InitializeMint2');
    appendLog(out, 'WS open → subscribe Token + Token-2022');
    subscribeLogs(socket, TOKEN_PROGRAM, 1);
    subscribeLogs(socket, TOKEN_2022_PROGRAM, 2);
  };

  socket.onmessage = async (ev) => {
    let msg: any;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }

    if (msg.id && msg.result !== undefined && !msg.method) {
      appendLog(out, `subscribed id=${msg.id} → subscription=${msg.result}`);
      return;
    }

    if (msg.method !== 'logsNotification') return;

    const value = msg.params?.result?.value;
    if (!value || value.err) return;

    const signature: string = value.signature;
    const logs: string[] = value.logs || [];
    if (!logs.some((line) => MINT_LOG.test(line))) return;
    if (seen.has(signature)) return;
    seen.add(signature);
    trimSeen();

    const slot = msg.params?.result?.context?.slot;
    appendLog(out, `[mint?] slot=${slot} sig=${signature}`);

    try {
      const mint = await fetchMintFromSig(signature);
      if (mint) appendLog(out, `  mint=${mint}`);
      else appendLog(out, '  mint=(not found in jsonParsed — try get-mint.html)');
    } catch (err) {
      appendLog(out, `  getTransaction error: ${String(err)}`);
    }
  };

  socket.onclose = () => {
    ws = null;
    if (!shouldRun) {
      setStatus('Stopped');
      return;
    }
    setStatus(`WS closed — reconnect in ${backoffMs}ms`);
    appendLog(out, `WS closed — reconnect in ${backoffMs}ms`);
    const wait = backoffMs;
    backoffMs = Math.min(backoffMs * 2, 30000);
    setTimeout(connect, wait);
  };

  socket.onerror = () => {
    appendLog(out, 'WS error');
  };
}

btnStart.addEventListener('click', () => {
  if (shouldRun) return;
  shouldRun = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  connect();
});

btnStop.addEventListener('click', () => {
  shouldRun = false;
  btnStart.disabled = false;
  btnStop.disabled = true;
  ws?.close();
  ws = null;
  setStatus('Stopped');
});

btnClear.addEventListener('click', () => {
  out.textContent = '';
});

appendLog(out, 'Ready. Click Start (in StackBlitz: click Run first if needed).');
appendLog(out, `Default WSS: ${WS_URL}`);
