/** Public-only BlockReq endpoints. No API keys in this demo. */
export const WS_URL = 'wss://solana-rpc.blockreq.com/v1/rpc/public';
export const HTTP_RPC = 'https://solana-rpc.blockreq.com/v1/rpc/public';

// Fallback (Solana public mainnet) — keep commented; default is BlockReq public:
// export const WS_URL = 'wss://api.mainnet-beta.solana.com';
// export const HTTP_RPC = 'https://api.mainnet-beta.solana.com';

export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export const MINT_LOG = /Instruction:\s*InitializeMint2?/i;

export function appendLog(el: HTMLElement, line: string) {
  el.textContent += line + '\n';
  el.scrollTop = el.scrollHeight;
  console.log(line);
}

export type ParsedIx = {
  programId?: string;
  parsed?: { type?: string; info?: { mint?: string } };
};

export async function fetchMintFromSig(signature: string): Promise<string | null> {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: [
      signature,
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      },
    ],
  };
  const res = await fetch(HTTP_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const tx = json.result;
  if (!tx) return null;

  const top = (tx.transaction?.message?.instructions || []) as ParsedIx[];
  const inner = ((tx.meta?.innerInstructions || []) as { instructions: ParsedIx[] }[])
    .flatMap((x) => x.instructions || []);
  const ixs = [...top, ...inner];

  for (const ix of ixs) {
    const prog = ix.programId;
    const type = ix.parsed?.type;
    if (
      (prog === TOKEN_PROGRAM || prog === TOKEN_2022_PROGRAM) &&
      typeof type === 'string' &&
      type.toLowerCase().includes('initializemint')
    ) {
      return ix.parsed?.info?.mint || null;
    }
  }
  return null;
}
