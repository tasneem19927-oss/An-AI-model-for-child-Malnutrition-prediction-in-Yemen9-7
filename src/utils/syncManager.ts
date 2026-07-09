import { indexedDbService, OfflineRecord } from "./indexedDbService";

export interface SyncStatus {
  online: boolean;
  pendingRecordsCount: number;
  lastSyncTime: string | null;
  syncInProgress: boolean;
  deviceName: string;
  deviceId: string;
}

type SyncListener = (status: SyncStatus) => void;

class SyncManager {
  private listeners: Set<SyncListener> = new Set();
  private onlineStatus: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private lastSyncTime: string | null = null;
  private deviceName: string = "";
  private deviceId: string = "";

  constructor() {
    this.init();
  }

  private async init() {
    // Listen to browser network connectivity events
    window.addEventListener("online", () => this.handleNetworkChange(true));
    window.addEventListener("offline", () => this.handleNetworkChange(false));

    // Retrieve device info
    try {
      const info = await indexedDbService.getDeviceInfo();
      this.deviceId = info.id;
      this.deviceName = info.name;
    } catch (e) {
      console.error("Failed to load device info:", e);
    }

    this.lastSyncTime = localStorage.getItem("yemen_platform_last_sync_time");
    this.notify();

    // Run initial auto sync if we are online on startup
    if (this.onlineStatus) {
      setTimeout(() => this.synchronize(), 3000);
    }
  }

  private handleNetworkChange(online: boolean) {
    this.onlineStatus = online;
    this.notify();

    // Trigger notification callback in window
    const event = new CustomEvent("network-status-changed", { detail: { online } });
    window.dispatchEvent(event);

    if (online) {
      console.log("Internet connection restored. Triggering automatic background synchronization...");
      this.synchronize();
    }
  }

  // Add listener for real-time reactive updates
  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Provide initial state
    this.getSyncStatus().then((status) => listener(status));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notify() {
    const status = await this.getSyncStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  public async getSyncStatus(): Promise<SyncStatus> {
    const pending = await indexedDbService.getOfflineRecords();
    return {
      online: this.onlineStatus,
      pendingRecordsCount: pending.length,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      deviceName: this.deviceName,
      deviceId: this.deviceId
    };
  }

  // Manual toggle for simulation
  public toggleOnlineSimulator(simulateOnline: boolean) {
    this.handleNetworkChange(simulateOnline);
  }

  // Securely upload local queue to server
  public async synchronize(): Promise<{ success: boolean; syncedCount: number; message: string }> {
    if (this.syncInProgress) {
      return { success: false, syncedCount: 0, message: "Sync already in progress." };
    }
    if (!this.onlineStatus) {
      return { success: false, syncedCount: 0, message: "Cannot sync: Device is offline." };
    }

    const pending = await indexedDbService.getOfflineRecords();
    if (pending.length === 0) {
      return { success: true, syncedCount: 0, message: "No pending records to synchronize." };
    }

    this.syncInProgress = true;
    this.notify();

    try {
      // 1. Group records into patients and measurements to guarantee sequential relational sync
      const patientsToSync: any[] = [];
      const measurementsToSync: any[] = [];

      pending.forEach((rec) => {
        if (rec.type === "patient") {
          patientsToSync.push(rec.data);
        } else if (rec.type === "measurement") {
          measurementsToSync.push(rec.data);
        }
      });

      // Prepare payload
      const payload = {
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        patients: patientsToSync,
        measurements: measurementsToSync
      };

      // 2. Transmit to server via secure channel (JWT)
      // Standard header token used for edge authentication sync
      const jwtToken = "DEMO_CLINICIAN_JWT_TOKEN";

      const res = await fetch("/api/sync/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server returned error status: ${res.status}`);
      }

      const outcome = await res.json();
      if (!outcome.success) {
        throw new Error(outcome.message || "Failed to finalize server-side sync database write.");
      }

      // 3. Resolve conflict/temporary ID mappings locally inside IndexedDB
      const idMap = outcome.idMap || {};
      
      // Update local storage models so subsequent edits are bound to central IDs
      if (idMap && Object.keys(idMap).length > 0) {
        const localPatients = await indexedDbService.getPatients();
        const localMeasurements = await indexedDbService.getMeasurements();

        // Remap local patient records
        for (const localPat of localPatients) {
          if (idMap[localPat.id]) {
            // Re-save patient with new server ID and delete old TEMP ID
            const newId = idMap[localPat.id];
            const updatedPatient = { ...localPat, id: newId };
            await indexedDbService.savePatient(updatedPatient);
            
            // Delete temp patient record in indexedDB
            const db = await (indexedDbService as any).initDb();
            const tx = db.transaction("patients", "readwrite");
            tx.objectStore("patients").delete(localPat.id);
          }
        }

        // Remap local measurement foreign keys
        for (const localMeas of localMeasurements) {
          if (idMap[localMeas.patientId]) {
            const updatedMeas = { ...localMeas, patientId: idMap[localMeas.patientId] };
            await indexedDbService.saveMeasurement(updatedMeas);
          }
        }
      }

      // 4. Mark pending records as successfully uploaded
      for (const rec of pending) {
        await indexedDbService.addUploadHistory({
          id: `UH-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          recordId: rec.id,
          recordType: rec.type,
          syncedAt: new Date().toISOString(),
          status: "Success"
        });
        // Remove from offline queue
        await indexedDbService.deleteOfflineRecord(rec.id);
      }

      // 5. Update local lastSync timestamp
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem("yemen_platform_last_sync_time", this.lastSyncTime || "");

      // Register a local sync log
      const localLog = {
        id: outcome.log?.id || `SYNC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        type: "Upload" as const,
        recordsSynced: pending.length,
        status: "Success" as const,
        details: `Successfully uploaded ${pending.length} queued records to central registry. Deduplicated and verified.`
      };
      await indexedDbService.addSyncLog(localLog);

      // Trigger a success notification event in window
      const syncEvent = new CustomEvent("synchronization-completed", { 
        detail: { recordsCount: pending.length } 
      });
      window.dispatchEvent(syncEvent);

      this.syncInProgress = false;
      this.notify();

      return {
        success: true,
        syncedCount: pending.length,
        message: `Synchronization completed successfully! Uploaded ${pending.length} cached records.`
      };

    } catch (e: any) {
      console.error("Background sync failed:", e);
      
      // Update retry counts and log errors on pending items in queue
      for (const rec of pending) {
        await indexedDbService.updateOfflineRecordError(rec.id, e.message || "Connection timeout");
      }

      const syncFailLog = {
        id: `SYNC-FAIL-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "Upload" as const,
        recordsSynced: 0,
        status: "Failed" as const,
        details: `Synchronization failed: ${e.message || "Network timeout / server unavailable"}. Retry queued.`
      };
      await indexedDbService.addSyncLog(syncFailLog);

      this.syncInProgress = false;
      this.notify();

      return {
        success: false,
        syncedCount: 0,
        message: `Synchronization failed: ${e.message || "Failed to reach server. Retry scheduled."}`
      };
    }
  }

  // Queue a new operation offline
  public async queuePatientOffline(patientData: any): Promise<void> {
    const tempId = `TEMP-PAT-${Date.now()}`;
    const newPatient = {
      ...patientData,
      id: tempId,
      createdAt: new Date().toISOString()
    };

    // Save to local secure Patients store (encrypted)
    await indexedDbService.savePatient(newPatient);

    // Add to pending sync queue
    const queueRecord: OfflineRecord = {
      id: `QR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      type: "patient",
      action: "create",
      data: newPatient,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    await indexedDbService.addOfflineRecord(queueRecord);
    
    this.notify();
  }

  public async queueMeasurementOffline(measurementData: any): Promise<void> {
    const tempId = `TEMP-MEAS-${Date.now()}`;
    const newMeasurement = {
      ...measurementData,
      id: tempId,
      createdAt: new Date().toISOString()
    };

    // Save to local secure Measurements store
    await indexedDbService.saveMeasurement(newMeasurement);

    // Add to pending sync queue
    const queueRecord: OfflineRecord = {
      id: `QR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      type: "measurement",
      action: "create",
      data: newMeasurement,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    await indexedDbService.addOfflineRecord(queueRecord);

    this.notify();
  }
}

export const syncManager = new SyncManager();
