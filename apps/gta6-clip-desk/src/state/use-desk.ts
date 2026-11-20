import { useEffect, useMemo, useReducer, useRef } from 'react'
import { BUNDLED_CLIPS, filterClips, type ClipRecord } from '../domain/clips.ts'
import {
  createInitialDeskState,
  deskReducer,
  selectedClip,
  selectedDraft,
} from '../domain/desk.ts'
import { createId } from '../domain/queue.ts'
import { savePlan, loadPlan } from '../lib/persist.ts'
import { deleteUpload, loadUploads, probeVideoDuration, saveUpload } from '../lib/uploads.ts'

const UPLOAD_LICENSE = 'Local upload. Stored only in this browser and never sent on the default path.'
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const MAX_UPLOAD_SECONDS = 30

function bundledClips(): ClipRecord[] {
  return BUNDLED_CLIPS.map((clip) => ({ ...clip, tags: [...clip.tags] }))
}

export function useDesk() {
  const [state, dispatch] = useReducer(deskReducer, undefined, createInitialDeskState)
  const ready = useRef(false)
  const urls = useRef<string[]>([])

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const [plan, uploads] = await Promise.all([Promise.resolve(loadPlan()), loadUploads()])
        if (cancel) return
        const uploadClips = uploads.map((upload) => {
          const src = URL.createObjectURL(upload.blob)
          urls.current.push(src)
          return {
            id: upload.id,
            title: upload.title,
            tags: [...upload.tags],
            durationSec: upload.durationSec,
            src,
            origin: 'upload' as const,
            license: UPLOAD_LICENSE,
          }
        })
        dispatch({ type: 'hydrate', clips: [...bundledClips(), ...uploadClips], plan })
        ready.current = true
      } catch {
        if (!cancel) {
          dispatch({
            type: 'setNotice',
            notice: 'Saved uploads could not be read. Bundled placeholders are still available.',
          })
        }
      }
    })()
    return () => {
      cancel = true
      for (const url of urls.current) URL.revokeObjectURL(url)
      urls.current = []
    }
  }, [])

  useEffect(() => {
    if (!ready.current) return
    savePlan(state)
  }, [state])

  const clip = selectedClip(state)
  const draft = selectedDraft(state)
  const filtered = useMemo(
    () => filterClips(state.clips, state.tagFilter),
    [state.clips, state.tagFilter],
  )

  async function addUpload(file: File) {
    if (!file.type.startsWith('video/')) {
      dispatch({ type: 'setNotice', notice: 'Choose a video file. It stays in this browser.' })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      dispatch({ type: 'setNotice', notice: 'Choose a video under 25 MB.' })
      return
    }
    try {
      const duration = await probeVideoDuration(file)
      if (duration > MAX_UPLOAD_SECONDS) {
        dispatch({
          type: 'setNotice',
          notice: 'Choose a video of 30 seconds or less. Uploads stay in this browser.',
        })
        return
      }
      const id = createId('upload')
      const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80) || 'Local upload'
      const tags = ['upload']
      const durationSec = Math.round(duration * 100) / 100
      await saveUpload({ id, title, tags, durationSec, blob: file })
      const src = URL.createObjectURL(file)
      urls.current.push(src)
      dispatch({
        type: 'addClip',
        clip: { id, title, tags, durationSec, src, origin: 'upload', license: UPLOAD_LICENSE },
      })
    } catch (error) {
      dispatch({
        type: 'setNotice',
        notice: error instanceof Error ? error.message : 'Could not add that video.',
      })
    }
  }

  async function removeUpload(clipId: string) {
    const target = state.clips.find((item) => item.id === clipId)
    if (!target || target.origin !== 'upload') return
    await deleteUpload(clipId)
    if (target.src.startsWith('blob:')) URL.revokeObjectURL(target.src)
    dispatch({ type: 'removeClip', clipId })
  }

  return { state, dispatch, clip, draft, filtered, addUpload, removeUpload }
}
