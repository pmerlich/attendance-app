export type QueuedOperation = {
  id: string;
  action: string;
  values: Record<string, unknown>;
  createdAt: string;
};

const DATABASE_NAME = "menahel-avoda-offline";
const DATABASE_VERSION = 1;
const STATE_STORE = "state";
const QUEUE_STORE = "operations";
const STATE_KEY = "latest";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) database.createObjectStore(STATE_STORE);
      if (!database.objectStoreNames.contains(QUEUE_STORE)) database.createObjectStore(QUEUE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("פתיחת האחסון המקומי נכשלה"));
  });
}

async function transact<T>(storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => { database.close(); reject(request.error ?? new Error("הגישה לאחסון המקומי נכשלה")); };
    transaction.oncomplete = () => { database.close(); resolve(result); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("שמירת הנתונים המקומית נכשלה")); };
  });
}

export function readCachedState<T>() {
  return transact<T | undefined>(STATE_STORE, "readonly", (store) => store.get(STATE_KEY));
}

export function writeCachedState<T>(state: T) {
  return transact<IDBValidKey>(STATE_STORE, "readwrite", (store) => store.put(state, STATE_KEY)).then(() => undefined);
}

export function readQueuedOperations() {
  return transact<QueuedOperation[]>(QUEUE_STORE, "readonly", (store) => store.getAll())
    .then((items) => items.sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
}

export function enqueueOperation(operation: QueuedOperation) {
  return transact<IDBValidKey>(QUEUE_STORE, "readwrite", (store) => store.put(operation)).then(() => undefined);
}

export function removeQueuedOperation(id: string) {
  return transact<undefined>(QUEUE_STORE, "readwrite", (store) => store.delete(id)).then(() => undefined);
}
