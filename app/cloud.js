export const project = 'https://vlbheybdqnddaxykalth.supabase.co';
export const publishable = 'sb_publishable_YgaJxEM7IEkpZwhGFlBA2w_dX2oVMFb';

export class Cloud {
  constructor(client) {
    this.client = client;
  }

  async rpc(name, args) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw new Error(error.message, { cause: error });
    return data;
  }

  async read() {
    const { data, error } = await this.client.from('level_snapshots')
      .select('payload, schema_version, updated_at, generation').maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  save(state, current) {
    return this.rpc('level_save', {
      document: state, revision: current?.updated_at ?? null, epoch: current?.generation ?? null,
    });
  }

  export() {
    return this.rpc('level_export');
  }

  reset(revision, digest, phrase) {
    return this.rpc('level_reset', { revision, digest, phrase });
  }

  review(date, current) {
    return this.rpc('level_review', { context_day: date, epoch: current?.generation ?? null });
  }
}

export async function checksum(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function evidenceTransaction(mode, operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('level-evidence-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      const transaction = db.transaction('files', mode);
      const store = transaction.objectStore('files');
      let result;
      let failure;
      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onabort = () => {
        db.close();
        reject(failure || transaction.error || new Error('Хранилище файлов недоступно.'));
      };
      operation(store, value => { result = value; }, error => {
        failure = error;
        transaction.abort();
      });
    };
  });
}

function getEvidence() {
  return evidenceTransaction('readonly', (store, capture) => {
    const read = store.getAll();
    read.onsuccess = () => capture(read.result);
  });
}

function toDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function deviceArchive(owner = null, legacyOnly = false) {
  const metadata = JSON.parse(localStorage.getItem('level-life-sync-meta-v1') || '{}');
  const sameOwner = !metadata.userId || metadata.userId === owner;
  if (legacyOnly && !sameOwner) throw new Error('Войдите в аккаунт, с которым связаны старые данные устройства.');
  const keys = sameOwner ? ['level-life-v1', 'level-life-sync-meta-v1', 'level-sound-enabled'] : [];
  if (!legacyOnly) keys.push('level-workspace-v2');
  const evidence = sameOwner ? await getEvidence() : [];
  return {
    owner: sameOwner ? metadata.userId || null : null,
    includesEvidence: sameOwner,
    records: Object.fromEntries(keys.flatMap(key => {
      const value = localStorage.getItem(key);
      return value === null ? [] : [[key, value]];
    })),
    files: await Promise.all(evidence.map(async item => {
      const { blob, file, ...metadata } = item;
      const content = blob ?? file;
      return { ...metadata, content: content instanceof Blob ? await toDataURL(content) : content };
    })),
  };
}

export async function clearDeviceArchive(archive, owner = null, legacyOnly = false) {
  const now = await deviceArchive(owner, legacyOnly);
  if (JSON.stringify(now) !== JSON.stringify(archive)) {
    throw new Error('Данные устройства изменились после экспорта. Скачайте свежую копию.');
  }
  if (archive.includesEvidence) await evidenceTransaction('readwrite', (store, capture, abort) => {
    const read = store.getAllKeys();
    read.onsuccess = () => {
      const keys = archive.files.map(file => file.id).sort();
      if (JSON.stringify(read.result.sort()) !== JSON.stringify(keys) ||
          Object.entries(archive.records).some(([key,value]) => localStorage.getItem(key) !== value)) {
        abort(new Error('Данные устройства изменились после экспорта. Скачайте свежую копию.'));
      } else {
        store.clear();
      }
    };
  });
  for (const [key,value] of Object.entries(archive.records)) {
    if (localStorage.getItem(key) === value) localStorage.removeItem(key);
  }
}
