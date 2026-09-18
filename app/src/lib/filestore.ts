// src/lib/filestore.ts
//
// 시험지에 올린 문제지·해설·출제표 파일을 브라우저에 담아 둔다.
//
// localStorage는 5~10MB가 한계고 문자열만 담을 수 있어 PDF가 안 들어간다.
// IndexedDB는 Blob을 그대로 담고 용량도 훨씬 크므로 여기에 둔다.
// 다만 이 기기에만 남는다 — 구글 로그인 동기화로 따라가지 않는다.
// 어느 기기에서나 열려야 하는 인쇄물은 사이트의 papers/ 에 올려 두고
// Attachment.src를 'site'로 둔다.

const DB = 'sda.files';
const STORE = 'exam-files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const keyOf = (examId: string, kind: string) => `${examId}:${kind}`;

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function putExamFile(examId: string, kind: string, file: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put(file, keyOf(examId, kind)));
}

export async function getExamFile(examId: string, kind: string): Promise<Blob | null> {
  const v = await tx<Blob | undefined>('readonly', (s) => s.get(keyOf(examId, kind)));
  return v ?? null;
}

export async function delExamFile(examId: string, kind: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(keyOf(examId, kind)));
}

/** 시험지를 지울 때 딸린 파일도 같이 치운다. 안 그러면 용량만 잡아먹는다. */
export async function delExamFiles(examId: string, kinds: readonly string[]): Promise<void> {
  await Promise.all(kinds.map((k) => delExamFile(examId, k).catch(() => undefined)));
}

/** 브라우저에 담아 둔 파일을 내려받게 한다. */
export function saveBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
