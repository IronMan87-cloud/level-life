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

function getEvidence() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('level-evidence-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('files').objectStore('files').getAll();
      read.onerror = () => {
        db.close();
        reject(read.error);
      };
      read.onsuccess = () => {
        db.close();
        resolve(read.result);
      };
    };
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

export async function deviceArchive() {
  const keys = ['level-life-v1', 'level-life-sync-meta-v1', 'level-sound-enabled', 'level-workspace-v2'];
  const metadata = JSON.parse(localStorage.getItem('level-life-sync-meta-v1') || '{}');
  const evidence = await getEvidence();
  return {
    owner: metadata.userId || null,
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

export async function clearDeviceArchive(archive) {
  const now = await deviceArchive();
  if (JSON.stringify(now) !== JSON.stringify(archive)) {
    throw new Error('Данные устройства изменились после экспорта. Скачайте свежую копию.');
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('level-evidence-v1');
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Закройте другие вкладки LEVEL и повторите операцию.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (blocked) return;
      for (const [key, value] of Object.entries(archive.records)) {
        if (localStorage.getItem(key) === value) localStorage.removeItem(key);
      }
      resolve();
    };
  });
}
