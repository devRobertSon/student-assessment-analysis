// src/lib/cloudfiles.ts
//
// 직접 올린 문제지·해설·출제표를 기기 사이에서 같이 쓰게 한다.
//
// Firestore 문서는 1MB가 한도라 PDF가 들어가지 않는다. 그래서 파일 자체는
// Firebase Storage에 두고, 시험지에는 그 경로(짧은 문자열)만 적는다.
// 경로는 Firestore로 같이 동기화되므로 다른 기기는 그 경로로 받아 간다.
//
// 받아 온 파일은 IndexedDB에 넣어 둔다. 다음부터는 내려받지 않는다.

import { deleteObject, getBlob, ref, uploadBytes } from 'firebase/storage';
import { AttachKind, Attachment, Exam } from './assessment';
import { CLOUD_DOC } from './cloud';
import { getExamFile, putExamFile } from './filestore';
import { storage } from './firebase';

/** Firestore의 sync/<CLOUD_DOC> 문서와 짝이 되는 Storage 경로. */
export function remotePath(examId: string, kind: AttachKind): string {
  return `sync/${CLOUD_DOC}/${examId}/${kind}`;
}

export const cloudFilesEnabled = !!storage;

export async function uploadToCloud(examId: string, kind: AttachKind, file: Blob): Promise<string> {
  if (!storage) throw new Error('클라우드가 꺼져 있습니다.');
  const path = remotePath(examId, kind);
  await uploadBytes(ref(storage, path), file, {
    contentType: file.type || 'application/octet-stream',
  });
  return path;
}

/** 클라우드에서 받아 이 기기에도 넣어 둔다. */
export async function pullFromCloud(examId: string, kind: AttachKind, path: string): Promise<Blob> {
  if (!storage) throw new Error('클라우드가 꺼져 있습니다.');
  const blob = await getBlob(ref(storage, path));
  await putExamFile(examId, kind, blob).catch(() => undefined);
  return blob;
}

/** 파일을 뗄 때 클라우드에서도 지운다. 이미 없으면 조용히 넘어간다. */
export async function removeFromCloud(path: string): Promise<void> {
  if (!storage) return;
  await deleteObject(ref(storage, path)).catch(() => undefined);
}

/**
 * 로그아웃 상태에서 올려 둔 파일을 뒤늦게 클라우드로 올린다.
 *
 * 올릴 게 있으면 고쳐진 exams를 돌려주고, 없으면 null. 한 개가 실패해도
 * 나머지는 올린다 — 실패한 것은 다음에 다시 시도된다.
 */
export async function pushPendingFiles(exams: Exam[]): Promise<Exam[] | null> {
  if (!storage) return null;
  let changed = false;
  const next = await Promise.all(
    exams.map(async (ex) => {
      if (!ex.files) return ex;
      const files: Partial<Record<AttachKind, Attachment>> = { ...ex.files };
      let mine = false;
      for (const [k, a] of Object.entries(files) as [AttachKind, Attachment][]) {
        if (a.src !== 'local' || a.remote) continue;
        const blob = await getExamFile(ex.id, k).catch(() => null);
        if (!blob) continue;
        try {
          files[k] = { ...a, remote: await uploadToCloud(ex.id, k, blob) };
          mine = true;
          changed = true;
        } catch {
          // 다음 로그인 때 다시 해 본다.
        }
      }
      return mine ? { ...ex, files } : ex;
    })
  );
  return changed ? next : null;
}
