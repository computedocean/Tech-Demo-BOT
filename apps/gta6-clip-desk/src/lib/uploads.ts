export type StoredUpload = {
  id: string
  title: string
  tags: string[]
  durationSec: number
  blob: Blob
}

const DB_NAME = 'clip-desk'
const STORE = 'uploads'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local clip storage.'))
  })
}

export async function loadUploads(): Promise<StoredUpload[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    request.onsuccess = () => {
      db.close()
      resolve((request.result as StoredUpload[]) ?? [])
    }
    request.onerror = () => {
      db.close()
      reject(request.error ?? new Error('Could not read local clips.'))
    }
  })
}

export async function saveUpload(upload: StoredUpload): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(upload)
    request.onsuccess = () => {
      db.close()
      resolve()
    }
    request.onerror = () => {
      db.close()
      reject(request.error ?? new Error('Could not store that video.'))
    }
  })
}

export async function deleteUpload(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)
    request.onsuccess = () => {
      db.close()
      resolve()
    }
    request.onerror = () => {
      db.close()
      reject(request.error ?? new Error('Could not delete that video.'))
    }
  })
}

export function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      cleanup()
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Could not read the duration of that video.'))
        return
      }
      resolve(duration)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Could not read that video.'))
    }
    video.src = url
  })
}
