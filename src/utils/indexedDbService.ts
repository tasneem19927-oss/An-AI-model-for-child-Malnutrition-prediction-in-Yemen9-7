import { Patient, Measurement, MalnutritionPrediction, ClinicalRecommendation, SyncLog } from "../types";

// Encryption secret key management for offline storage compliance
const ENCRYPTION_KEY_STORAGE_NAME = "yemen_platform_local_secret_key";
function getOrCreateSecretKey(): string {
  let key = localStorage.getItem(ENCRYPTION_KEY_STORAGE_NAME);
  if (!key) {
    // Generate a secure-looking random device encryption salt/key
    const array = new Uint32Array(8);
    window.crypto.getRandomValues(array);
    key = Array.from(array, (num) => num.toString(16).padStart(8, "0")).join("-");
    localStorage.setItem(ENCRYPTION_KEY_STORAGE_NAME, key);
  }
  return key;
}

const SECRET_KEY = getOrCreateSecretKey();

// XOR cipher combined with URI safe Base64 encoding for offline storage encryption
export function encryptData(data: any): string {
  const str = JSON.stringify(data);
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(unescape(encodeURIComponent(result)));
}

export function decryptData(encryptedStr: string): any {
  try {
    const decoded = decodeURIComponent(escape(atob(encryptedStr)));
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      result += String.fromCharCode(charCode);
    }
    return JSON.parse(result);
  } catch (e) {
    console.error("Failed to decrypt local record:", e);
    return null;
  }
}

// IndexedDB database definition
const DB_NAME = "YemenMalnutritionPlatformOfflineDB";
const DB_VERSION = 1;

export interface OfflineRecord {
  id: string; // TEMP-ID
  type: "patient" | "measurement";
  action: "create";
  data: any; // Encrypted string or raw payload (we will encrypt fields)
  timestamp: string;
  retryCount: number;
  lastError?: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  lastSync?: string;
  registeredAt: string;
}

export interface UploadHistory {
  id: string;
  recordId: string;
  recordType: string;
  syncedAt: string;
  status: "Success" | "Failed";
}

class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        
        // Patients store
        if (!db.objectStoreNames.contains("patients")) {
          db.createObjectStore("patients", { keyPath: "id" });
        }
        // Measurements store
        if (!db.objectStoreNames.contains("measurements")) {
          db.createObjectStore("measurements", { keyPath: "id" });
        }
        // Predictions store
        if (!db.objectStoreNames.contains("predictions")) {
          db.createObjectStore("predictions", { keyPath: "id" });
        }
        // Recommendations store
        if (!db.objectStoreNames.contains("recommendations")) {
          db.createObjectStore("recommendations", { keyPath: "id" });
        }
        // Sync queue / Offline records
        if (!db.objectStoreNames.contains("offline_records")) {
          db.createObjectStore("offline_records", { keyPath: "id" });
        }
        // Sync logs
        if (!db.objectStoreNames.contains("sync_logs")) {
          db.createObjectStore("sync_logs", { keyPath: "id" });
        }
        // Device registry
        if (!db.objectStoreNames.contains("device_registry")) {
          db.createObjectStore("device_registry", { keyPath: "id" });
        }
        // Upload history
        if (!db.objectStoreNames.contains("upload_history")) {
          db.createObjectStore("upload_history", { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- Helper transactional methods ---
  private async getStore(storeName: string, mode: IDBTransactionMode = "readonly"): Promise<IDBObjectStore> {
    const db = await this.initDb();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- Patients Methods ---
  public async savePatient(patient: Patient): Promise<void> {
    const store = await this.getStore("patients", "readwrite");
    // Encrypt sensitive demographic variables for medical privacy
    const encryptedPatient = {
      ...patient,
      name: encryptData(patient.name),
      parentName: encryptData(patient.parentName),
      contactNumber: encryptData(patient.contactNumber)
    };
    return new Promise((resolve, reject) => {
      const req = store.put(encryptedPatient);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getPatients(): Promise<Patient[]> {
    const store = await this.getStore("patients");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result as Patient[];
        const decryptedList = list.map((pat) => ({
          ...pat,
          name: decryptData(pat.name) || "Decryption Failed",
          parentName: decryptData(pat.parentName) || "Decryption Failed",
          contactNumber: decryptData(pat.contactNumber) || ""
        }));
        resolve(decryptedList);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Measurements Methods ---
  public async saveMeasurement(measurement: Measurement): Promise<void> {
    const store = await this.getStore("measurements", "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(measurement);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getMeasurements(): Promise<Measurement[]> {
    const store = await this.getStore("measurements");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  public async getMeasurementsForPatient(patientId: string): Promise<Measurement[]> {
    const list = await this.getMeasurements();
    return list.filter((m) => m.patientId === patientId);
  }

  // --- Predictions Methods ---
  public async savePrediction(prediction: MalnutritionPrediction): Promise<void> {
    const store = await this.getStore("predictions", "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(prediction);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getPredictionsForPatient(patientId: string): Promise<MalnutritionPrediction[]> {
    const store = await this.getStore("predictions");
    return new Promise<MalnutritionPrediction[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result as MalnutritionPrediction[];
        resolve(list.filter((p) => p.patientId === patientId));
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Recommendations Methods ---
  public async saveRecommendation(rec: ClinicalRecommendation): Promise<void> {
    const store = await this.getStore("recommendations", "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(rec);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getRecommendationsForPrediction(predictionId: string): Promise<ClinicalRecommendation[]> {
    const store = await this.getStore("recommendations");
    return new Promise<ClinicalRecommendation[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result as ClinicalRecommendation[];
        resolve(list.filter((r) => r.predictionId === predictionId));
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Offline records Queue Methods ---
  public async addOfflineRecord(record: OfflineRecord): Promise<void> {
    const store = await this.getStore("offline_records", "readwrite");
    // Encrypt raw payload in database queue
    const encryptedRecord = {
      ...record,
      data: encryptData(record.data)
    };
    return new Promise((resolve, reject) => {
      const req = store.put(encryptedRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getOfflineRecords(): Promise<OfflineRecord[]> {
    const store = await this.getStore("offline_records");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result as OfflineRecord[];
        const decryptedList = list.map((rec) => ({
          ...rec,
          data: decryptData(rec.data)
        }));
        resolve(decryptedList);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteOfflineRecord(id: string): Promise<void> {
    const store = await this.getStore("offline_records", "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async updateOfflineRecordError(id: string, errorMsg: string): Promise<void> {
    const store = await this.getStore("offline_records", "readwrite");
    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (getReq.result) {
          const updated = {
            ...getReq.result,
            retryCount: (getReq.result.retryCount || 0) + 1,
            lastError: errorMsg
          };
          const putReq = store.put(updated);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // --- Sync Logs Methods ---
  public async addSyncLog(log: SyncLog): Promise<void> {
    const store = await this.getStore("sync_logs", "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(log);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getSyncLogs(): Promise<SyncLog[]> {
    const store = await this.getStore("sync_logs");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Device Registry Methods ---
  public async getDeviceInfo(): Promise<DeviceInfo> {
    const store = await this.getStore("device_registry");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result as DeviceInfo[];
        if (results.length > 0) {
          resolve(results[0]);
        } else {
          // Initialize local device registry info
          const storedDeviceName = localStorage.getItem("yemen_platform_device_name");
          const deviceName = storedDeviceName || `Yemen-Mobile-Unit-${Math.floor(1000 + Math.random() * 9000)}`;
          if (!storedDeviceName) {
            localStorage.setItem("yemen_platform_device_name", deviceName);
          }
          const defaultInfo: DeviceInfo = {
            id: `DEV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            name: deviceName,
            registeredAt: new Date().toISOString()
          };
          this.saveDeviceInfo(defaultInfo).then(() => resolve(defaultInfo));
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async saveDeviceInfo(info: DeviceInfo): Promise<void> {
    const store = await this.getStore("device_registry", "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(info);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Upload History Methods ---
  public async addUploadHistory(history: UploadHistory): Promise<void> {
    const store = await this.getStore("upload_history", "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(history);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getUploadHistory(): Promise<UploadHistory[]> {
    const store = await this.getStore("upload_history");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Check if a record was already uploaded to prevent duplicates
  public async isAlreadyUploaded(recordId: string): Promise<boolean> {
    const list = await this.getUploadHistory();
    return list.some((item) => item.recordId === recordId && item.status === "Success");
  }

  // --- Clear Database for Testing ---
  public async clearAll(): Promise<void> {
    const db = await this.initDb();
    const stores = ["patients", "measurements", "predictions", "recommendations", "offline_records", "sync_logs", "upload_history"];
    const transaction = db.transaction(stores, "readwrite");
    stores.forEach((storeName) => {
      transaction.objectStore(storeName).clear();
    });
    return new Promise((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  }
}

export const indexedDbService = new IndexedDbService();
