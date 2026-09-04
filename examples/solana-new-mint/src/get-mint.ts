import { appendLog, fetchMintFromSig, HTTP_RPC } from './shared';

const out = document.getElementById('out') as HTMLPreElement;
const sigInput = document.getElementById('sig') as HTMLInputElement;
const btnFetch = document.getElementById('btnFetch') as HTMLButtonElement;
const btnClear = document.getElementById('btnClear') as HTMLButtonElement;

btnFetch.addEventListener('click', async () => {
  const signature = sigInput.value.trim();
  if (!signature) {
    out.textContent = 'Paste a transaction signature first.';
    return;
  }
  out.textContent = '';
  appendLog(out, 'POST getTransaction → ' + HTTP_RPC);
  appendLog(out, 'sig=' + signature);
  try {
    const mint = await fetchMintFromSig(signature);
    if (mint) appendLog(out, 'mint=' + mint);
    else appendLog(out, 'No initializeMint / initializeMint2 found in jsonParsed instructions.');
  } catch (err) {
    appendLog(out, 'error: ' + String(err));
  }
});

btnClear.addEventListener('click', () => {
  out.textContent = '';
  sigInput.value = '';
});
